# vLLM Diagrams — Text Transcriptions & Analysis

Every figure from the "Inside vLLM: Anatomy of a High-Throughput LLM Inference System" blog, transcribed to text so the content is searchable without opening the images. Source images live in `assets/images/`. Each entry lists the filename, what it depicts, and a full text rendering of every label, arrow, and annotation.

Ordered to match the blog flow.

---

## 1. `engine_constructor.png` — LLM Engine / Engine Core architecture

**Depicts:** The top-level object graph of a vLLM engine plus the two-tier KV memory system (CPU index + GPU memory).

**Top — request flow (left → right):**
- `vLLM config` (top box) → arrow labeled **"configures LLM engine"** points into the engine.
- `requests in` → **`processor`** → **`engine core client`** (outer box) → **`output processor`** → `result out`.
- Inside `engine core client` sits **`engine core`** (red box) containing:
  - **`model executor`** (green box).
  - **`scheduler`** (blue box) holding a **`waiting`** queue, a **`running`** queue, and the **`KV cache manager`** (orange box).
  - **`SOM`** = Structured Output Manager (bottom strip).

**Middle — "indexing structure" (CPU):**
- The **`KV cache manager`** owns a **`block_pool`**: the **`free_block_queue` of KV cache index blocks**.
- Doubly-linked list of index blocks: `block_id=1 ⇄ block_id=2 ⇄ block_id=3 ⇄ … ⇄ block_id=N`.
- These are lightweight index objects on CPU (pointers/metadata), NOT the tensors.

**Bottom — "actual KV memory" (GPU):**
- **`paged KV cache memory`**: physical tensor blocks `blk 1, blk 2, blk 3, blk 4 … blk N-3, blk N-2, blk N-1, blk N`.
- Each CPU `block_id` maps to one physical GPU `blk`.

**Key idea:** the scheduler/KV-cache-manager manipulate cheap CPU-side index blocks; the heavy KV tensors live in paged GPU memory. This indirection is what enables paged attention.

---

## 2. `engine_loop.png` — The generate() step loop ("life of a prompt")

**Depicts:** How a prompt string becomes a Request and is driven by the core scheduling loop.

- Top: prompt string `"Hello, my name is"`.
- ↓ becomes a dict: `{ "prompt": "Hello, my name is", "prompt_token_ids": [1,2,3,4,5], "type": "token" } + misc metadata`.
- ↓ **"pack into Request"**.
- ↓ added to the **`waiting queue`** (blue bar; the new request is the hatched green segment at the head).
- The head request feeds the central red **loop** of three stages (clockwise):
  - **`schedule`** (top) → **`forward pass`** (right) → **`postprocess`** (left) → back to schedule.

**Key idea:** `llm.generate()` repeatedly calls `step()` = schedule → forward pass → postprocess until requests finish.

---

## 3. `kv_cache_blocks.png` — Block allocation in allocate_slots (no prefix caching)

**Depicts:** How `allocate_slots` computes and reserves KV blocks for a prompt.

**Top example:**
- `prompt_token_ids = [1,2,3,4,5,6,7,8,9,10]`
- `block_size = 4`
- `=> we need ceil(10/4) = 3 KV cache blocks!`

**CPU block objects** (three pink rounded boxes), each:
- `block_id = 1 / 2 / 3`
- `ref_cnt = 1`
- `block_hash` → arrow → **`None`**
- Annotation (green): **"None because we're not using prefix caching yet."**

**Bottom — free block queue after removing the first 3 blocks:**
- `KV cache manager` → `block_id=4 ⇄ block_id=5 ⇄ block_id=6 ⇄ … ⇄ block_id=N`.
- Caption: **"We removed first 3 blocks from the free block queue."**

**Key idea:** blocks needed = `ceil(num_tokens / block_size)`; allocation pops blocks off the head of the free queue and sets `ref_cnt=1`.

---

## 4. `fwd_pass.png` — Continuous batching + paged KV across prefill & decode (THE key diagram)

**Depicts:** The complete worked example of 3 prompts flowing through one prefill step then one decode step, showing flattening, slot_mapping, and KV block state. This is the most information-dense figure.

**Setup:**
- `prompts = ["Hi, my name is", "Today is a beautiful summer day", "Hello there"]`
- After tokenization: `[1,2,3,4,5]`, `[6,8,2,9,4,10,12]`, `[11,2,13]` (3 sequences).
- `block_size = 4`.
- `allocate_slots` gives CPU block objects (pink, with `block_id / ref_cnt / block_hash`).

**Continuous batching — flatten the sequences into one "super sequence":**
- `input_ids = [1,2,3,4,5, 6,8,2,9,4,10,12, 11,2,13]`
- `positions = [0,1,2,3,4, 0,1,2,3,4,5,6, 0,1,2]`
- i.e. all sequences are concatenated into a single flat batch.

**slot_mapping** (tells where each token's KV goes in paged memory):
- `slot_mapping = [4,5,6,7,8, 12,13,14,15,16,17,18, 20,21,22]`
- Annotation: slot_mapping tells where KVs belonging to tokens from each sequence go inside the KV cache paged memory.
- Example: 2nd sequence has 7 tokens → blocks with id 3 and 4, one slot of block 4 used (positions 12..18); 3rd sequence's 3 tokens populate the 3rd block fully at 95% / use of block 16.

**GPU state — initial:** all blocks grey/empty (`blk 1 … blk N`).

**State after 1st fwd pass (PREFILL):**
- Inside the attention layer, during prefill we compute KVs and store them in paged memory.
- Blocks now colored: **KVs for 5 tokens of 1st sequence** (blue), **KVs for 7 tokens of 2nd sequence** (green), **KVs for 3 tokens of 3rd sequence** (yellow/gold).
- `reshape_and_cache_flush` is responsible for updating the paged memory.
- Additional metadata: `query_start_loc = [0,5,12,15]`, `seq_lens = [5,7,3]`, `num_actual_tokens = 15`.

**Decode step — "let's continue to decode now":**
- Sampled 1 new token per sequence: `[14,15,16]` across the 3 sequences.
- Continuous batching makes input: `input_ids = [14,15,16]` (appended 14/15/16 to sequences).
- `positions = [5,7,3]` (updated to reflect new state).

**State after 2nd fwd pass (DECODE):**
- Now we **reuse** the prefill KVs and only compute 1 new token per sequence — possible thanks to attention metadata.
- Blocks: KVs for 6 tokens of 1st seq, 8 tokens of 2nd seq, 4 tokens of 3rd seq.
- Relevant metadata: `query_start_loc = [0,1,2,3]`, `seq_lens = [6,8,4]`, `num_actual_tokens = 3`.

**Key idea:** Prefill computes & stores KV for all prompt tokens at once (compute-bound); decode appends one row per sequence and reuses cached KV (memory-bandwidth-bound). Continuous batching flattens all sequences into one forward pass.

---

## 5. `chunked_pt1.png` — Chunked prefill

**Depicts:** Splitting a long prompt across multiple forward passes so it doesn't monopolize a step.

**Example:**
- `long_prefill_token_threshold = 8 toks`
- `block_size = 4`
- `prompt_token_ids = [1,2,…,18]` (18 tokens)

**1st fwd pass:** LLM processes tokens `1 2 3 4 5 6 7 8` (first 8).
- GPU KV paged memory: after 1st pass, 2 blocks contain KVs (8 tokens) → `blk 1, blk 2` filled (gold); `blk 3..blk 8` empty (grey).

**2nd fwd pass:** LLM processes tokens `9 10 11 12 13 14 15 16` (next chunk).
- After 2nd pass, 4 blocks contain KVs (16 tokens) → `blk 1, blk 2, blk 3, blk 4` filled (gold); rest empty.

**Key idea:** a prompt longer than the chunk threshold is prefilled in fixed-size chunks across successive steps, capping per-step prefill work and letting decodes interleave.

---

## 6. `prefix_pt1.png` — Prefix caching: hashing prompt blocks

**Depicts:** How block hashes are computed on the first request (cold cache).

**Example:**
- `block_size = 4`
- `long_prefix = "Today is a nice and warm summer day!"`
- `long_prefix_tokens = [1,2,3,4,5,6,7,8]` ("in reality token ids are pulled from a vocab table").
- `prompts = ["My name is", "His name is"]`; `prompts_tokens = [9,10,2], [12,10,2]`.
- First call we pass: `long_prefix + prompts[0] → [1,2,3,4,5,6,7,8,9,10,2]`.

**`hash_request_tokens` does:**
1. Splits input into `[1,2,3,4]`, `[5,6,7,8]` and discards the last one `[9,10,2]` as incomplete.
2. Computes a hash for the first 2 chunks → call those `"abc"` and `"def"`.
3. Returns a list of 2 `BlockHash` objects.

**`ret =`** two token-id/hash records:
- `{ token_ids: [1,2,3,4], hash_value: "abc" }`
- `{ token_ids: [5,6,7,8], hash_value: "def" }`
- ("in reality these are big numbers").

**Hash chaining:** `none_hash → hash([1,2,3,4]) = "abc" → hash([5,6,7,8]) = "def"` (each block hash folds in the previous block's hash — prefix-dependent).

- `find_longest_cache_hit` returns `[]` because `cached_block_hash_to_block = {}` (empty).
- Caption: makes sense — we haven't done a fwd pass yet, so we haven't computed KVs for these 2 blocks.

**Key idea:** prefix caching hashes each *complete* block of tokens, chaining in the previous block's hash so identical prefixes map to identical hashes. Incomplete trailing block is not hashed.

---

## 7. `prefix_pt2.png` — Prefix caching: registering blocks after prefill

**Depicts:** State after the first request's forward pass populates the cache.

**CPU:** `cached_block_hash_to_block = { … }` now holds:
- `block_id=1, ref_cnt=1, block_hash` → `token_ids:[1,2,3,4], hash_value:"abc"`
- `block_id=2, ref_cnt=1, block_hash` → `token_ids:[5,6,7,8], hash_value:"def"`
- `block_id=3, ref_cnt=1, block_hash` → `None (incomplete block)`

**GPU KV paged memory:** after 1st fwd pass, **2.75 blocks** contain KVs (4+4+3 tokens) → `blk 1, blk 2` full + `blk 3` partially filled (gold); `blk 4..blk 8` empty.

**Key idea:** completed blocks get registered in `cached_block_hash_to_block` so future requests with the same prefix can hit them; the incomplete block stays unhashed.

---

## 8. `prefix_pt3.png` — Prefix caching: second request reuses cached blocks

**Depicts:** A second request (`long_prefix + "His name is"`) reusing the first two cached blocks.

**CPU:** reusing the 2 KV blocks (ids = 1,2):
- `block_id=1, ref_cnt=2` → `[1,2,3,4]/"abc"` (ref_cnt bumped to 2 — shared!)
- `block_id=2, ref_cnt=2` → `[5,6,7,8]/"def"`
- `block_id=6, ref_cnt=1` → `None (incomplete block)` (new block for the divergent suffix).
- Annotation: "We are reusing these 2 KV blocks (ids = 1,2)."

**GPU KV paged memory:** assuming the first request populated **4.25 blocks**:
- `blk 1, blk 2` reused (shared prefix), `blk 3, blk 4` from first request, `blk 5` for the new request's tokens.
- Because the first 5 KV blocks were allocated, the first free block is `blk 6` → that's what we get when we call `allocate_slots`.
- Caption: after 1st fwd pass with the second request we populate 0.75 of the 6th blk (we have 3 new tokens and 8 cached).

**Key idea:** shared prefixes increment `ref_cnt` instead of recomputing/reallocating; only the divergent suffix needs new blocks and a fresh forward pass.

---

## 9. `fsm.png` — Guided decoding: finite state machine

**Depicts:** A trivial grammar FSM with 2 accepting paths, constraining generation to either "Positive" or "Negative".

- **`start state`** (yellow) branches two ways:
  - Top (green) path: `P → o → s → i → t → i → v → e` (**end state** = double-circle "e"). Spells **"Positive"**.
  - Bottom (pink) path: `N → e → g → a → t → i → v → e` (**end state** = double-circle "e"). Spells **"Negative"**.
- Title: "Extremely trivial FSM w/ 2 end states."

**Key idea:** guided/structured decoding walks a grammar FSM; at each state only transitions valid in the grammar are allowed, forcing output into legal strings (here, exactly "Positive" or "Negative").

---

## 10. `fsm2.png` — Guided decoding: grammar bitmask applied to logits

**Depicts:** How the FSM's allowed-token set becomes a bitmask that masks logits to -inf.

**Example** (8-bit integers, vocab size 8):
- `example_grammar_bitmask = 1 0 1 0 1 0 0 0` (packed; "efficient mem representation").
- Expand to an array of 8 elements: `[1, 0, 1, 0, 1, 0, 0, 0]`.
- `logits = [-3.23, 1.22, 0.02, -0.33, 2.29, 2.2, 1.5, -20.3]`.
- Bitmask value `0` ⇒ that logit is set to `-Inf` (positions with 0 are masked; the hatched cells 1.22, -0.33, 2.2, 1.5, -20.3).
- `masked logits = [-3.23, -inf, 0.02, -inf, 2.29, -inf, -inf, -inf]`.

**Key idea:** allowed tokens (bit=1) keep their logits; disallowed tokens (bit=0) are set to -inf so they can never be sampled. The bitmask is stored packed (1 bit/token) and expanded at apply time.

---

## 11. `specdec_pt1.png` — Speculative decoding: prefill + draft

**Depicts:** Steps 1–2 of speculative decoding with a draft model.

**Setup:**
- Assume the large LM would sample: **"Hello, my name is Aleksa Gordic"**.
- Given prompt: **"Hello, my"**.
- Tokenization: `["Hello", ",", "my", "name", "is", "Ale", "ksa", "Gor", "dic"]`.

**Step 1 — prefill w/ target model:** Large LM (e.g. 70B Llama) prefills `hello , my` and produces next token `name`.

**Step 2 — draft k=4 tokens:** small LM (e.g. 1.1B Tiny Llama) autoregressively samples 4 draft tokens given `hello , my name`:
- `is`, `Ale`, `ksa`, **`ndar`** ← labeled **"error!"** (the draft's last token is wrong).
- Note: this is autoregressive sampling; intermediate steps omitted.

**Key idea:** a cheap draft model proposes `k` tokens; the expensive target model will verify them in a single pass (next figure).

---

## 12. `specdec_pt2.png` — Speculative decoding: verify + rejection sampling

**Depicts:** Steps 3–4 — the target model verifies all draft tokens in one forward pass, then rejection sampling decides accept/reject.

**Step 3 — verify w/ target model:**
- Large LM (70B) takes `Hello , my name is Ale ksa ndar` and produces **k+1 target prob distributions** in a single forward pass (parallel verification).
- Copy over `k draft prob distributions` from the draft LM for comparison.

**Step 4 — rejection sampling:**
- Compare draft vs target distributions per position (green = accept, red = reject).
- **Accept 3 tokens: `["is", "Ale", "ksa"]`. Reject 1 token: `["ndar"]`.**
- The k+1-th target distribution after the rejected token is **"not utilized because we rejected before it."**
- Assumptions/rules:
  - For tokens `"is"` and `"Ale"`: target prob > draft prob ⇒ **accept**.
  - For token `"ksa"`: target prob < draft prob but after sampling we ended up keeping it.
  - For token `"ndar"`: target prob << draft prob so we end up **rejecting** it.
- "We end up feeding `["Hello", ",", "my", "name", "is", "Ale", "ksa"]` into the drafter — and the loop continues!"

**Key idea:** speculative decoding verifies `k` draft tokens with one target forward pass; rejection sampling guarantees the output distribution equals the target model's. Accepted tokens = speedup; first rejection truncates the rest.

---

## 13. `pd.png` — Disaggregated Prefill / Decode (P/D)

**Depicts:** Separating prefill and decode onto different engine-core instances/GPUs, with KVs transferred between them via a connector (NIXL backend).

**Prefill instance (cuda:0):** engine core with `model executor`, `KV connector role: worker`, `scheduler`, `KV connector role: scheduler`, `KV cache manager`. Its `paged KV cache memory` on **GPU cuda:0**.

**Decode instance (cuda:1):** mirror structure with its own `paged KV cache memory` on **GPU cuda:1**.

**Numbered flow:**
- **Step 1:** compute KVs on prefill instance (cuda:0) by doing a fwd pass (the 70B LLM runs here).
- **Step 2:** KV connector (scheduler) delegates to KV connector (worker), who starts the transfer once prefill fwd pass is completed.
- **Step 3:** KVs from prefill instance (cuda:0) are copied over to decode instance (cuda:1) using the **NIXL** backend.
- **Step 4:** decode instance reuses the KVs from the prefill instance and computes (paged attn) the next token.

**Key idea:** because prefill is compute-bound and decode is memory-bandwidth-bound, splitting them onto separate instances lets each be optimized/scaled independently; KV cache is shipped from prefill→decode over a fast connector.

---

## 14. `multiprocexecutor.png` — MultiProcExecutor (tensor parallelism)

**Depicts:** How the main process broadcasts work to TP worker processes, one per GPU.

- **`main process`** holds `rpc_broadcast_mq` (a message queue).
- Orange arrows fan out from main's `rpc_broadcast_mq` to each worker's `rpc_broadcast_mq`.
- **Worker 0 (cuda:0)** = **driver worker, TP rank = 0**: has both `worker_response_mq` (blue) and `rpc_broadcast_mq` (orange).
- **Worker 1 (cuda:1) … Worker 7 (cuda:7):** each has `worker_response_mq` and `rpc_broadcast_mq`.
- Blue arrow: main process **"reads from this one"** = Worker 0's `worker_response_mq`.

**Key idea:** the driver broadcasts RPCs (e.g. forward pass) to all TP workers via per-worker broadcast queues; results come back through worker response queues, but the executor only needs to read rank 0's response (the others are identical/sharded).

---

## 15. `server_setup.png` — Multi-node serving topology (TP=4 across 2 nodes)

**Depicts:** A model needing TP=4, configured across two 8×H100 nodes — one headless, one with the API server.

- **Headless node (8×H100):** `vLLM 0, tp=4` and `vLLM 1, tp=4`.
- **API-server node (8×H100):** `vLLM 2, tp=4` and `vLLM 3, tp=4`, plus the **`API server`** (green).
- `clients` connect to the `API server` (top).
- Arrows show the API server dispatching to / collecting from the headless node's vLLM instances as well as its local ones.

**Key idea:** with TP=4 you fit 2 model replicas per 8-GPU node; multiple nodes are tied together, with one node running the API server and others running headless engine replicas.

---

## 16. `dpenginecoreproc.png` — Distributed data-parallel serving (DPEngineCoreProc)

**Depicts:** Data-parallel deployment: 4 DP replicas coordinated under a DP coordinator and API server.

- Top: **`API server`** ⇄ **`DP coordinator`** (arrow labeled **"exchange LB info, etc."** — load-balancing info).
- **DP coordinator** connects down to 4 replicas.
- **headless server** (dashed box) contains **DP replica 0** and **DP replica 1**.
- **DP replica 2** and **DP replica 3** are separate.
- Each replica is a **`DPEngineCoreProc`** (blue box) whose **`main thread`** (red box) contains:
  - **`EngineCore`** + **`MultiProc Executor`**, an **`input queue`** and **`output queue`**.
  - An **`input thread`** and **`output thread`** outside the red main-thread box (handle IO to/from the coordinator).

**Key idea:** each DP replica is a full engine (`DPEngineCoreProc`) with input/output threads decoupling network IO from the compute main thread; the DP coordinator load-balances requests across replicas and exchanges LB info with the API server.

---

## 17. `latency_diagram.png` — Latency metrics (TTFT, ITL, E2E)

**Depicts:** Timeline of a request showing the standard serving latency metrics.

- Top: **`vLLM inference server`**; bottom: **`User`**.
- `query` goes up to the server; tokens come back down to the user over time: `token 1`, `token 2`, …, `token n`.
- **TTFT** (Time To First Token) = from `query` to `token 1`.
- **ITL** (Inter-Token Latency) = gap between `token 1` and `token 2`.
- **(e2e) latency** = full span from `query` to `token n`.

**Key idea:** TTFT measures prefill responsiveness; ITL/TPOT measures decode speed; E2E is the whole request. (Blog also mentions TPOT and Goodput.)

---

## 18. `roofline.png` — Roofline model (memory-bound vs compute-bound)

**Depicts:** The roofline performance model used to reason about why batch size matters.

- X-axis: **arithmetic intensity (FLOPs/byte)**; Y-axis: **perf (FLOPs/second)**.
- Diagonal line (blue) = **mem bw bound** region; rising slope; above/left is **"unattainable perf."**
- Horizontal line (red) = **compute bound** ceiling; above is **"unattainable perf."**
- The knee (dotted vertical) separates memory-bound (left) from compute-bound (right).
- Orange arrows in the **"suboptimal perf zone"** point toward the rooflines (where you actually operate before optimization).

**Key idea:** at low arithmetic intensity (small batch, e.g. decode) you're memory-bandwidth bound; increasing batch size B raises arithmetic intensity until you hit the compute-bound ceiling. Prefill is naturally compute-bound; decode is memory-bound — which motivates large batching and P/D disaggregation.

# vLLM Concepts Glossary

Cross-referenced index of key terms. Each entry: definition + where covered (B=blog `blog-anatomy-of-vllm.md`, D=diagram # in `diagrams-explained.md`, T1=transcript `transcript-life-of-a-prompt.txt`, T2=transcript `transcript-how-does-vllm-work.txt`).

## Core engine

- **LLM Engine / Engine Core** — vLLM's fundamental building block; enables high-throughput *offline* inference. Composed of processor, engine core client, output processor; engine core holds model executor, scheduler, KV cache manager, structured output manager (SOM). [B, D1]
- **step() loop** — the core loop driving generation: **schedule → forward pass → postprocess**, repeated until requests finish. `llm.generate()` runs it. [B, D2, T]
- **Request** — a prompt packed into an object: `{prompt, prompt_token_ids, type, +metadata}`. Enters the waiting queue. [B, D2]
- **Processor / Output processor** — input tokenization/packing and output detokenization/streaming around the engine core. [B, D1]
- **UniprocExecutor / MultiProcExecutor** — single-process (1 GPU) vs multi-process (multi-GPU, one worker process per GPU) model execution. [B, D14]

## Scheduling & batching

- **Waiting queue / Running queue** — waiting = requests not yet (fully) prefilled; running = prefilled requests in the decode phase. Scheduler moves requests between them. Decode is generally prioritized. [B, D1, T]
- **Prefill** — process all prompt tokens at once to compute & store their KV cache; produces the first new token. **Compute-bound.** [B, D4, T]
- **Decode** — generate one new token per sequence per step, reusing cached KV. **Memory-bandwidth-bound.** [B, D4, D18, T]
- **Continuous batching** — flatten multiple sequences into one "super sequence" for a single forward pass; finished sequences free their slots immediately so new work starts without waiting. Contrast **static batching**, which wastes slots until the whole batch finishes. [B, D4, T]
- **Token budget** — max tokens processed in one engine iteration (default `2048` per the transcript / `max_num_batched_tokens`). [B, T]
- **allocate_slots** — scheduler/KV-cache-manager function that computes blocks needed = `ceil(num_tokens / block_size)`, checks availability, and pops blocks off the free queue. [B, D3, D4]

## KV cache & memory

- **KV cache** — stored key/value matrices from previous tokens so they aren't recomputed each step; the foundational efficiency trick of inference. [B, D4, T]
- **Block** — fixed-size unit of KV storage. `block_size` = 16 tokens by default (transcript uses 16; blog examples use 4 for illustration). One block = `2 (K&V) × block_size × num_kv_heads × head_dim × bytes_per_elem`. [B, D3, T]
- **Paged KV cache / Paged attention** — KV stored in non-contiguous physical blocks (like OS virtual memory paging); a page table maps logical sequence positions → physical blocks. Eliminates fragmentation and enables sharing. [B, D1, D4, T]
- **block_pool / free_block_queue** — doubly-linked list of free KV index blocks on CPU; the KV cache manager allocates from its head. [B, D1, D3]
- **Page table** — CPU-side list of pointers mapping each sequence to its allocated physical blocks; itself takes negligible memory. [D1, T]
- **slot_mapping** — per-token index telling `reshape_and_cache_flush` where in paged memory each token's KV goes. [D4]
- **CPU blocks / swap space** — CPU memory (default 4 GB/GPU in vLLM) for offloading KV/activations and bringing them back. Transcript derives 11,915 CPU blocks at 0.34375 MB/block. [B, T]
- **GPU VRAM partitioning** — VRAM split among: model weights (~2 GB for TinyLlama), activations (~0.3 GB), non-torch memory (~0.05 GB), and the rest (~10.86 GB) reserved for KV cache. Transcript derives 32,357 GPU KV blocks. [T]
- **ref_cnt** — reference count on a block; >1 when a block is shared across requests (prefix caching). [D3, D6–D8]

## Memory fragmentation & the OS-paging analogy (the *why* behind PagedAttention)

- **Internal fragmentation** — pre-vLLM, each request was given a contiguous block sized for `max_tokens`. A request that needs only 12.5 MB but is allocated 256 MB wastes the remaining ~243.5 MB. Capping at `max_len=2048` tokens × 128 KB/token = 256 MB/request. [T2]
- **External fragmentation** — when requests get differently-sized contiguous reservations (e.g. chatbot=500, code=2048, summarization=1000 tokens), free gaps can't satisfy a new request even when total free space is enough, because the free space isn't *contiguous* → out-of-memory error. [T2]
- **Can't-share memory** — without paging, the shared prompt for N candidate responses (e.g. "pick one of 3 answers") must be copied N times; the prompt KV is constant but gets duplicated. Paging lets the candidates share the prompt's blocks. [T2]
- **OS virtual-memory paging (the inspiration)** — a process sees a contiguous *virtual* address space (page 0,1,2…) that the **page table** + **MMU** (hardware chip in CPU) map to scattered *physical* RAM frames; a **TLB** caches lookups. vLLM mirrors this: **blocks ↔ pages, tokens ↔ bytes, requests ↔ processes**. [T2]
- **vLLM's mapping** — the per-request "contiguous" logical blocks (block 0,1,2) map to arbitrary physical VRAM blocks (e.g. 502, 12, 811). The lookup is done in **software** by the **Block Manager** (vs the OS's hardware MMU). Empty slots in a block are filled by generated output tokens before a new block is requested → minimizes internal fragmentation. [T2]
- **Token KV size math** — a token's KV size depends on model architecture, not word length (words → IDs via tokenizer). Example: Llama-3 8B FP16 → ~128 KB/token; vLLM default `block_size`=16 tokens → ~2 MB/physical block. [T2]
- **Concurrency win (worked example)** — A100 40 GB, 13B model: 26 GB weights + 2 GB overhead + ~12 GB KV. Naive contiguous @256 MB/request → only ~40 (or 32 in the 8 GB/4096-block framing) concurrent requests. With PagedAttention, an avg 256-token request grabs just 16 blocks (~32 MB) anywhere in the pool → ~256 concurrent requests. **~8× more throughput.** [T2]

## Advanced features

- **Chunked prefill** — split a long prompt (> `long_prefill_token_threshold`) into fixed chunks across successive forward passes, capping per-step prefill cost and letting decodes interleave. [B, D5]
- **Prefix caching** — hash each *complete* block of tokens (chaining the previous block's hash) so requests sharing a prefix reuse cached KV blocks (`ref_cnt++`) instead of recomputing. `cached_block_hash_to_block`, `find_longest_cache_hit`, `hash_request_tokens`. [B, D6, D7, D8]
- **Guided / structured decoding (FSM)** — constrain output to a grammar via a finite state machine; allowed tokens form a packed **grammar bitmask** that masks disallowed logits to `-inf`. Backends e.g. xgrammar. [B, D9, D10]
- **Speculative decoding** — a cheap **draft model** proposes `k` tokens; the **target model** verifies all of them in one forward pass; **rejection sampling** accepts a prefix and guarantees the target's output distribution. Methods: n-gram, EAGLE, Medusa. [B, D11, D12]
- **Disaggregated P/D** — run prefill and decode on separate instances/GPUs (each optimized for its bound); ship KV cache prefill→decode via a **KV connector** (e.g. **NIXL** backend, LMCache). [B, D13]

## Scaling & serving

- **Tensor parallelism (TP)** — shard each layer's compute across GPUs; driver broadcasts RPCs via `rpc_broadcast_mq`, collects via `worker_response_mq`. Preferred over PP because intranode bandwidth is higher. [B, D14]
- **Pipeline parallelism (PP)** — split layers across GPUs/nodes; used to span nodes. [B]
- **Data parallelism (DP)** — replicate the whole engine; `DPEngineCoreProc` replicas with input/output threads, coordinated by a **DP coordinator** that load-balances and exchanges LB info with the API server. [B, D16]
- **Headless node vs API server node** — headless nodes run engine replicas only; the API-server node also exposes the HTTP endpoint to clients. [B, D15, D16]
- **AsyncLLM / FastAPI / Uvicorn** — the async serving layer wrapping the engine for online serving. [B]

## Metrics & performance

- **TTFT** — Time To First Token (prefill responsiveness). [B, D17]
- **ITL / TPOT** — Inter-Token Latency / Time Per Output Token (decode speed). [B, D17]
- **E2E latency** — full query→last-token span. [B, D17]
- **Goodput** — throughput that meets latency SLOs. [B]
- **Roofline model** — perf vs arithmetic intensity (FLOPs/byte); low intensity = memory-bw bound (decode), high = compute bound (prefill). Raising batch size B moves you rightward toward the compute ceiling. [B, D18]
- **vllm bench {serve,latency,throughput}** — CLI for benchmarking. [B]

## Transcript auto-transcription corrections

Both YouTube transcripts (AWS Transcribe) mis-hear several terms. Additional T2-specific ones: "paced attention"/"phasing"/"pacing" → **paged attention/paging**; "paces"/"bases"/"pase" → **pages**; "KV cash pack"/"KVC" → **KV cache**; "VRAAM"/"VR RAM" → **VRAM**; "Lalama 38 billion"/"Lalama 3" → **Llama-3 8B**; "2 megabits"/"128 kilobits" → **2 megabytes / 128 kilobytes** (bytes, not bits); "MMU"/"TLB" are correct (memory management unit / translation lookaside buffer). Common readings:

| Transcript says | Means |
|---|---|
| "page detention", "page retention", "spaced attention", "beach" (page table) | **paged attention** / page table |
| "Kiwi cache", "Qa blocks", "QA blocks", "Q blocks", "KV cash" | **KV cache** / KV blocks |
| "Quda blocks", "Kuda blocks" | **CUDA (GPU) blocks** |
| "GPUVAP", "GPU VR RAM", "VRAP" | **GPU VRAM** |
| "tiny lama" | **TinyLlama** (~1.1B params, 22 layers) |
| "VLLL", "ELLL", "VLLA", "VLLF" | **vLLM** |
| "top B" (= 0.95) | **top-p** (nucleus sampling) |
| "elderM" | **LLM** |
| "WIP Wednesday" | (model's generated text, not a vLLM term) |

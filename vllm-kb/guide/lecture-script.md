# vLLM, Explained Simply — A Spoken Lecture

*A companion narration to the visual guide (`index.html`). Written to be read aloud or listened to on its own — no diagrams required. Each part maps to a section of the webpage, so you can follow along or just listen. Estimated 22–26 minutes spoken.*

---

## Prologue — Why you'd want to know this

Hello, and welcome. In the next twenty-odd minutes, we're going to open up one of the most important pieces of modern AI infrastructure — a system called vLLM — and we're going to do it without assuming you know anything about machine learning.

Here's the question we're really answering: when you type a message to an AI like ChatGPT or Claude, and it types back, what actually happens in the machine? And more specifically — how does a company serve that experience to millions of people at once without spending an absolute fortune on hardware?

The answer turns out to be a beautiful story about memory — about not wasting it. And the punchline is a clever idea borrowed from the operating system already running on your laptop. So let's build up to it, one small step at a time. Nothing scary. Just one idea stacked on the next.

---

## Part 0 — Why vLLM was built

Before we dive into how it works, let's understand why it exists — because that frames everything. vLLM came out of UC Berkeley's Sky Computing Lab in twenty twenty-three, and to appreciate it, you have to picture what serving large language models looked like just before.

The earliest approach was naïve, or static, batching: you'd group a handful of requests, run them together, and wait for the slowest one to finish before letting any new request in. Short requests would finish early and just sit there holding their place while a long one dragged on — so the GPU spent much of its time half-empty. Then there was NVIDIA's FasterTransformer, which had beautifully optimized math kernels — fast for a single request — but still used static batching and still reserved memory in big contiguous blocks. HuggingFace had Text Generation Inference, or TGI, which made deployment easy and became popular in production, but at the time carried the same memory inefficiency. And then, in twenty twenty-two, came the real research breakthrough just before vLLM: a system called Orca, which introduced continuous batching — the idea of swapping requests in and out on every single step instead of waiting for a whole batch. That was a big scheduling win.

But here's what the Berkeley team noticed when they profiled all of these. The real bottleneck wasn't the math — it was wasted GPU memory. The existing engines were throwing away sixty to eighty percent of their KV cache memory to fragmentation and over-reservation — problems we'll dissect shortly. Orca had fixed the *scheduling* problem, but nobody had fixed the *memory* problem. And memory was being managed in a surprisingly primitive way — one big contiguous block per request, the way computer programs managed RAM back in the 1950s. Meanwhile, operating systems had solved exactly this problem decades ago, with virtual memory and paging. So the question that launched the whole project was simply: what if we applied paging to the KV cache? That idea became PagedAttention; pairing it with Orca-style continuous batching became vLLM — and on the original benchmarks it delivered up to twenty-four times the throughput of plain HuggingFace Transformers, comfortably beating TGI and Orca too. So that's our destination. Let's start at the very bottom and build up to it.

---

## Part 1 — What a language model actually does

Let's start at the very bottom. A large language model — an "LLM" — is the thing behind these AI chatbots. And despite all the hype, it has exactly one core skill: **it predicts the next word.** That's genuinely it. Everything else is that one trick, repeated very, very fast.

Now, computers don't actually read English. So the first thing that happens to your sentence is that it gets chopped into little pieces called **tokens**. A token is roughly a word or a fragment of a word. And each token gets swapped for a number — an ID — pulled from the model's dictionary. This step is called **tokenization**. So "Hi, my name is" might become five numbers, something like 154, 1112, 42, 756, 298. From this moment on, the model never sees your words again. It only ever sees numbers.

Here's a thing worth pausing on: the size of a token in the computer's memory has nothing to do with how long the word is. The word "a" and the word "antidisestablishmentarianism" both just become token IDs. Length of the word doesn't matter. Remember that — it'll come back.

Now, that "dictionary" has a proper name: the **vocabulary**. It's a fixed, finite set of tokens that the model knows — every model is built around its own. And here's the key idea: any text you ever type is expressed *only* as combinations of those known pieces. There is nothing outside the vocabulary. The number of tokens a model knows is called its vocabulary size, and it varies quite a bit. To give you a feel for the numbers: the older GPT-2 had about fifty thousand tokens. Llama 2 — and the little TinyLlama model used in some of these examples — has thirty-two thousand. Llama 3 jumped to about a hundred and twenty-eight thousand. GPT-4o is around two hundred thousand, and Google's Gemma is roughly two hundred fifty-six thousand. A bigger vocabulary means each token carries more meaning, so a sentence needs fewer of them — but it also means a longer list to deal with at every step. Hold onto that vocabulary number, because it quietly comes back twice later: it's the length of the list of probabilities the model produces each step, and it's the size of the mask used in guided decoding.

Okay. So the model reads all your tokens, and here's what it actually produces: not a single answer, but a **probability score for every single token in the vocabulary** — basically, "how likely is each of my known tokens to come next?" Then it picks one from that list. And a subtle but important point: it usually doesn't just grab the single most likely token. It **samples** from the list, with a bit of controlled randomness. Two dials govern this: **temperature**, which controls how adventurous the pick is — higher temperature, more surprising choices — and **top-p**, which restricts the choice to the most probable tokens that together cover, say, ninety-five percent of the probability. This sampling is exactly why, if you ask ChatGPT the same question twice, you rarely get the identical wording back. Once it picks a token, it **appends** that token to your text, and does the whole thing again. It reads everything, including the token it just produced, and scores the next one. And again. And again. This loop is called **autoregression**, and it keeps going until the model produces a special "I'm finished" token.

Now here's the catch, and it's the seed of our whole story. To produce *each* new token, the model re-reads the *entire* sequence so far. By the time it's generating the five-hundredth token, it is re-reading five hundred tokens, every single step. That is a staggering amount of repeated work. Hold onto that thought — that waste is exactly what vLLM exists to eliminate.

So the mental model for Part 1: an LLM is an extremely well-read autocomplete. It doesn't plan ahead. It commits to one token, then reconsiders everything to pick the next one.

---

## Part 2 — Why this is so expensive

All of this math runs on a **GPU** — a graphics processing unit. Originally built for video games, GPUs turn out to be brilliant at the kind of massive parallel arithmetic that neural networks need.

But here's the constraint that shapes everything: the scarce resource isn't really speed. It's **memory** — specifically the GPU's onboard memory, called **VRAM**. The entire world of the model has to fit inside VRAM, and VRAM is both small and expensive.

Let me make that concrete. Picture a GPU's memory as a plot of land that several tenants have to share. Take one NVIDIA A100 with 40 gigabytes of VRAM, running a 13-billion-parameter model. Roughly 26 gigabytes goes to the model's weights — that's the fixed "brain" of the model, and we can't shrink it. Where does twenty-six come from? Each of those thirteen billion parameters needs storage, and in the common half-precision format — FP16 — each one takes two bytes. Thirteen billion times two is about twenty-six gigabytes, just to hold the model before anything else. Another couple of gigabytes goes to system overhead. That leaves about 12 gigabytes. And *that* 12 gigabytes is the only part we get to manage cleverly. It's used for something called the KV cache, which we'll meet in a moment.

So here's the business case for everything that follows, in one sentence: **better memory management means more users per GPU, which means a lower cost for every answer.** That's it. That's why vLLM matters and why people get excited about it.

---

## Part 3 — The KV cache: stop redoing your work

Remember the waste from Part 1 — re-reading the whole sequence for every new token? Let's fix it.

To predict the next token, the model uses a mechanism called **attention** — each token "looks back" over the earlier tokens and decides which ones matter. To make that work, every token gets turned into three little vectors: a **Query**, meaning "what am I looking for"; a **Key**, meaning "here's what I'm about"; and a **Value**, meaning "here's the information I carry." A token's Query is compared against every earlier token's Key to score how relevant each one is, and those scores are used to blend the Values together. That's attention in a nutshell.

Now here's the part people most often get muddled, so let me be precise — and it's exactly where vLLM's world begins. Where do those Query, Key, and Value vectors come from? Each one is produced by multiplying the token by a **projection matrix** — there's a W-Q matrix, a W-K matrix, and a W-V matrix. And here is the crucial distinction. Those *matrices* — W-Q, W-K, W-V, plus an output matrix W-O — are exactly what gets **learned during training**. Once training is finished, they are **frozen**. They never change again; they ship inside the model's weights, that twenty-six gigabytes we talked about. vLLM is an *inference* engine — it runs an already-trained model — so for everything we discuss, those matrices are read-only constants.

What *is* computed fresh, at inference time, are the actual Key and Value **vectors** — one set per token — by multiplying each token's representation by those frozen matrices. So when I say "compute the Key and Value," I do not mean the matrices; those are fixed. I mean the per-token k and v vectors that come out of them. The matrix is the rubber stamp that never changes; the vectors are the fresh imprints it makes on each new token.

And now the insight that makes caching possible: because of **causal attention** — a token can only attend to tokens *before* it, never after — an earlier token's Key and Value vectors don't depend on anything that comes later. So once a token's k and v are computed, they are final. They never change.

But that raises a great question: if we have three vectors per token — Query, Key, and Value — why do we cache only the Key and the Value, and not the Query? Why is it the KV cache and not the QKV cache? The answer is in how each one gets used, and it's worth slowing down for. Picture the model generating token number t. It computes just one new query for the current position — call it q-t. The attention for this step is: take q-t, compare it against every earlier token's key to get relevance scores, and use those scores to blend the earlier tokens' values together. Now watch the asymmetry over the whole generation. Every old token's key and value get read *again* at every future step — token three's key and value are needed when generating token four, then five, then six, forever after. Used over and over, so caching them saves enormous recomputation. But a token's query is used in exactly *one* step — the single step that generates that token. It asks its question once, the token comes out, and that query is never needed again. Thanks to causal masking, no future token ever looks back using an *old* query; each future token looks back with its *own* query. So the query is used once and thrown away — caching it would just waste memory. That's the whole reason: Key and Value are the "looked-at" side, read by many future queries, so we cache them; Query is the "looking" side, a single momentary question, so we discard it. Hence: KV cache.

So the fix is almost embarrassingly obvious once you see it: **compute each token's Key and Value vectors once, then just save them.** That saved store is called the **KV cache** — and to be clear, it holds those computed k and v *vectors*, not the W matrices. The matrices already live in the model weights, shared by every token and every user; the cache holds the per-token output of applying them. That's also why the cache grows with the *number of tokens* you're serving, while the weights stay a flat, fixed cost. Now, when the model generates a new token, it only has to compute the Key and Value for that one new token, and it reuses everything else straight from the cache.

The difference is night and day. Without the cache, step five hundred does five hundred tokens of work. With the cache, step five hundred computes one new token and reads the other four hundred ninety-nine from memory. The KV cache is the single most important efficiency trick in LLM inference, and almost everything else is built around managing it well.

Now, this naturally splits generation into two phases, and these two phases will explain nearly every design decision in vLLM, so let's name them clearly.

The first phase is **prefill**. This is where you process *all* of your prompt's tokens at once, to fill up the KV cache and produce the very first new token. It's a big burst of parallel math. We say it's **compute-bound** — the limit is the raw arithmetic horsepower of the GPU.

The second phase is **decode**. This is where you generate the rest of the answer, one token at a time, reusing the cache. There's very little math per step, but a lot of memory shuffling. We say decode is **memory-bandwidth-bound** — the limit is how fast you can move data in and out of memory, not how fast you can compute.

Here's an analogy that sticks. Prefill is like prepping every ingredient before you start cooking — one big upfront burst of chopping and measuring. Decode is like plating one dish at a time, reusing all that prep. Two completely different bottlenecks. Tuck that away — compute-bound prefill, memory-bound decode — because it comes back again and again.

---

## Part 4 — The problem vLLM was born to solve

So we have this precious KV cache living in scarce GPU memory. The obvious next question is: how do you store it? And to appreciate vLLM, we first need to understand exactly how the *older* systems did it — engines like FasterTransformer, HuggingFace's TGI, and a research system called Orca. They all shared one design choice: each request's KV cache was stored as a single **contiguous slab** — one unbroken stretch of VRAM. There was no paging; the slab had to be one continuous piece.

Let me clear up what's actually in that slab, because it's a common point of confusion. It does *not* store your prompt text, and it does not store the answer text. It stores the key and value vectors for every token processed so far — your prompt tokens, written during prefill, plus every token generated after. It grows by one token's worth each decode step.

Now, the costly question: how big a slab does each request get? The old systems reserved it up front, sized for the *maximum* answer the request could ever produce — say two thousand forty-eight tokens — because a contiguous slab can't grow into its neighbors later; it has to claim its worst case immediately, on arrival. And what happens if a request needs more than its slab? It can't — the slab *is* the maximum, so it never runs out mid-answer. That's the whole point of over-reserving. And it's also exactly why it bleeds memory: almost every request reserves far more than it ends up using.

Out of that one design choice fall three villains. **Villain one: internal fragmentation.** This is waste *inside* a slab you were already given. Say a request reserves room for two thousand forty-eight tokens — about 256 megabytes — but only generates a hundred tokens, about twelve and a half megabytes. The other 243 megabytes are reserved, untouchable, and wasted. It's called "internal" because the wasted space is locked *inside an allocation that belongs to one request*. Now do the math across a 12-gigabyte KV budget at 256 megabytes each: twelve divided by 256 megabytes is about forty-eight requests, and in practice around forty once other overhead is counted — on a GPU that could serve hundreds.

**Villain two: external fragmentation.** Some systems tried to be clever and guessed smaller sizes by task — give a chatbot prompt 500 tokens, a code task two thousand, a summary a thousand. But that created a different waste. Imagine memory now has a 500-token free gap, then a slab in use, then a 1,000-token free gap. That's 1,500 tokens free in total. But a new request needs 1,200 *contiguous* tokens, and neither gap is big enough on its own. Out-of-memory error, even though the space objectively exists — it's just in the wrong shape. This one is called "external" because the wasted space sits *outside every allocation, in the gaps between them*.

Here's the easy way to remember the two names — picture a parking lot. Internal fragmentation is renting a whole bus bay for your bicycle: wasted space *within your own spot*. External fragmentation is three single gaps scattered around the lot when a delivery truck needs three *adjacent* spots and can't fit: wasted space *between* other people's spots.

**Villain three: no sharing.** When you ask an AI for, say, three alternative answers to the same prompt, the old system stored your prompt's KV cache three separate times — three identical copies — because each answer got its own contiguous slab. But the prompt's vectors never change. Storing them three times is pure waste.

So there are our three villains — internal fragmentation, external fragmentation, and no sharing — and notice they all trace back to one root cause: contiguous, reserve-the-maximum allocation. Now — here's the lovely part — vLLM kills the root cause with a single idea, and that idea was sitting in plain sight the whole time.

---

## Part 5 — PagedAttention: the big idea

Here's the insight. Your operating system — Windows, macOS, Linux — solved this exact problem decades ago, for regular computer memory.

When a program runs, it *thinks* it has one long, continuous block of memory to write into. But that's an illusion the OS maintains. Behind the scenes, the OS chops memory into small, fixed-size pieces called **pages**, and it scatters them all over physical RAM wherever there's room. Then it keeps a little lookup table — a **page table** — that remembers where each page actually lives. The program writes to what feels like a tidy continuous space; the reality is scattered; and the page table quietly translates between the two.

vLLM said: let's do exactly that, but for the KV cache. And they called it **PagedAttention.**

Here is the one line to memorize, the Rosetta Stone of this whole system: **blocks are pages, tokens are bytes, and a request is a process.** Everything else follows from that mapping.

So concretely: instead of one giant contiguous reservation, the KV cache is chopped into many small **blocks**. By default, each block holds 16 tokens. When a request needs memory, it grabs only as many blocks as it actually needs — and those blocks can sit *anywhere* in physical VRAM, in any order. A lightweight page table — in vLLM it's called the Block Manager — maps the request's neat logical sequence, block 0, block 1, block 2, onto the scattered physical reality, maybe physical block 502, then 12, then 811.

Look at what this fixes. Because we no longer need one big contiguous reservation, **external fragmentation is gone** — any free block, anywhere, can be used. And because blocks are small, the only waste is in the final, partly-filled block — at most 15 tokens' worth — so **internal fragmentation almost vanishes** too. And vLLM is greedy about it: it fills the empty slots in a request's current block before requesting a new one.

Now, here's where the name "PagedAttention" really earns itself — because scattering the cache creates a new problem. Remember, the attention step needs to read *all* of a sequence's Keys and Values. But we've just deliberately spread them across blocks all over the GPU. So vLLM ships a custom piece of GPU code — an attention **kernel** — that knows how to follow the page table and read directly from those scattered blocks, without first copying them into one neat place. That custom kernel is the actual "attention" part of PagedAttention. The block bookkeeping we just described is only half the trick; the kernel that reads scattered memory efficiently is the other half.

And sharing? Sharing is now basically free. Three answers to the same prompt simply *point at the same prompt blocks*. vLLM keeps a **reference count** on each block — literally a little counter that says "how many requests are using me right now." Shared blocks just bump the counter up instead of copying the data. So that third villain falls too. One idea — paging — beats all three.

Quick aside on the numbers, for the curious: how big is one block, really? A block stores the keys and values for its tokens, across all the model's attention layers. For a model like Llama-3 8B in 16-bit precision, one token's worth of KV is about 128 kilobytes, so a default 16-token block is about 2 megabytes. If you've got 8 gigabytes of VRAM left for the cache, that's roughly 4,096 blocks to hand out.

And that connects to a practical question: what actually happens when vLLM starts up on a GPU? It runs a one-time setup, in order. First, it loads the model weights into VRAM — the frozen W matrices, around sixteen gigabytes for Llama-3 8B in half precision. Second, it runs a profiling pass — one dummy forward pass — to measure the peak working memory the model needs to actually run. Third, it takes whatever VRAM is left over, up to a configurable fraction called gpu-memory-utilization — about ninety percent by default — and carves it into those fixed-size blocks. This is when vLLM prints a line like "number of GPU blocks: four thousand ninety-six." Fourth, it also reserves some CPU blocks as overflow swap space — system RAM it can temporarily offload a request's KV to under heavy pressure, then pull back.

One clarification worth making, because the word "block" is overloaded. The KV blocks we've been talking about are a *memory* concept — slots of VRAM holding key and value vectors. They are *not* the same thing as CUDA thread blocks, which are a *compute* concept — groups of GPU threads that a kernel launches to do math in parallel. One is where data lives; the other is how work gets scheduled. vLLM's whole cleverness is about the memory kind — the KV blocks. The compute kind is handled by the GPU kernels underneath.

It also helps to measure vLLM's jump against a real predecessor. The state-of-the-art research engine right before it was Orca, from twenty twenty-two. Orca actually introduced the big *scheduling* win — iteration-level, or continuous, batching, which we're about to cover. But here's the thing: Orca still stored each request's KV in a contiguous, reserve-the-maximum slab, so it kept every fragmentation problem from Part 4. vLLM took Orca's smart scheduling *and* added smart memory management — paged blocks, allocated on demand, with sharing. By recovering all the memory Orca wasted and spending it on a bigger batch, the vLLM paper reported throughput up to two to four times higher. The lesson is that better scheduling alone wasn't enough; the two improvements compound.

---

## Part 6 — Continuous batching: never let the GPU rest

We've solved memory. Now let's talk about keeping the GPU busy, because an idle GPU is wasted money.

First, what even is a batch, and why do we bother? A batch is simply a group of requests the GPU processes together, in one pass, instead of one at a time. Why does that help so much? A GPU has thousands of tiny math cores. Running a single request leaves almost all of them idle — it's like driving a fifty-seat bus with one passenger. Batching fills the seats. Here's a practical example: four users send questions in the same second. Handle them one by one, and each waits for the previous to finish. Put all four in a batch, and the GPU answers them together in roughly the time it took to do *one* — because the real bottleneck was loading the model weights from memory, and all four requests now share that single load. So batching is essential. The only question is *how* you batch — and that's where vLLM beats the old approach.

The old way was **static batching.** You'd gather a batch of requests, run them all together, and wait for the entire batch to finish before starting anything new. The problem? Requests finish at different times. A short answer finishes early, but its slot just sits there, idle, while a long answer in the same batch keeps running. You're paying for GPU time that does nothing.

vLLM uses **continuous batching** instead. The instant a request finishes, its blocks are freed and a waiting request *immediately* takes its place. No idle gaps, ever. The GPU is always full. And notice — this only works *because* PagedAttention made freeing and reusing blocks instant and painless. The two ideas are partners.

Let me walk you through a concrete run, because it ties everything together. Say three prompts arrive, of lengths 5, 7, and 2 tokens. vLLM flattens them into one combined batch. Each prompt gets its blocks from the free pool. Then comes **prefill**: all the prompt tokens get processed at once, the KV cache fills up, and each prompt produces its first new token. Then **decode** begins: each step, every prompt gets one new token appended, reusing its cached KV — no recomputation. And the moment one of those prompts hits its "I'm done" token, its block is freed right then and handed to whoever's waiting. That's the rhythm of vLLM: schedule, generate, free, repeat.

Two bits of vocabulary while we're here. New requests sit in a **waiting queue**. Once they've been prefilled, they graduate to the **running queue** for decoding. And there's a **token budget** — a cap, often around 2,048 tokens, on how much work fits into a single step. If a prompt is longer than that, it gets split up — which is the perfect cue for our advanced features.

---

## Part 7 — The whole machine, assembled

Let's put the pieces together into the actual architecture. Picture a request flowing from left to right.

Your **requests** come in as plain text. They hit the **Processor**, which tokenizes them and packs them into a tidy Request object. That goes into the **Engine Core** — the brain of vLLM — which does the actual work. The results come out through the **Output Processor**, which turns token IDs back into readable text and streams it to you, word by word. That's the outer pipeline.

Now zoom into the Engine Core, because that's where the magic lives. It has three key parts. First, the **Model Executor** — this runs the actual neural-network math on the GPU, the forward pass that predicts the next tokens. Second, the **Scheduler** — the traffic controller. It holds those two queues we mentioned, waiting and running, and every step it decides which requests run and how many tokens to process, staying within the token budget. Third, the **KV Cache Manager** — this is the page table from Part 5 made real. It owns the pool of blocks, hands them out, tracks the reference counts for sharing, and frees blocks when requests finish.

And the whole thing runs a simple loop — the heartbeat of vLLM. When you call "generate," all that really happens is this loop runs over and over. Each turn is one **step**, and a step has three stages: **schedule** — pick the requests and their blocks; **forward pass** — the GPU predicts the next tokens; **postprocess** — collect those tokens and free anything that just finished. Schedule, forward, postprocess. Around and around, until every request is done. That's the engine.

---

## Part 8 — The clever extras

Everything up to here is the core, and honestly, if you understand the core, you understand vLLM. But there are six upgrades that bolt on top. You don't need every detail — just the *why* of each.

**One: chunked prefill.** A really long prompt — say ten thousand tokens — would hog an entire step and stall everyone else's decoding. So vLLM splits a long prompt into chunks and prefills it across several steps, letting quick decodes slip in between. Nobody gets blocked by one greedy request.

**Two: prefix caching.** If lots of requests start with the same text — a long system prompt, or the same document — why recompute its KV cache every single time? vLLM hashes each completed block of tokens, cleverly chaining in the previous block's hash so the hash represents the entire prefix up to that point. When a new request shows up with the same opening, vLLM recognizes the hash, reuses those cached blocks — just bumps the reference count — and jumps straight to the new part. For chatbots and document Q&A, this is an enormous saving.

**Three: guided decoding.** Sometimes you need the output to follow strict rules — always valid JSON, or only ever the words "Positive" or "Negative." vLLM uses a **finite state machine**, which is just a little grammar that knows which tokens are legal at each point. At every step, the illegal tokens have their scores forced to negative infinity using a bitmask — so they simply cannot be chosen. The model gets gently railroaded into producing only valid output.

**Four: speculative decoding.** Decode is slow because it's strictly one token at a time. So here's a trick: use a tiny, fast "draft" model to *guess* the next several tokens. Then the big, accurate model checks all of those guesses in a *single* pass. The guesses that are right get accepted for free; the first wrong one gets rejected and corrected. There's a technique called rejection sampling that mathematically guarantees the final output is *identical* to what the big model would have produced on its own — you just got there faster. vLLM supports several flavors of this — n-gram, EAGLE, and Medusa.

**Five: disaggregated prefill and decode.** Remember how prefill is compute-bound and decode is memory-bound — opposite appetites? So why run them on the same GPU? In this setup, you put them on *separate* machines, each tuned for its job. The prefill machine computes the KV cache, then ships it over a fast connection to the decode machine, which generates the answer. Now each side can be scaled independently. Elegant.

**Six: multi-LoRA serving.** Here's a problem that sounds unrelated to memory but uses the same paging trick. A LoRA adapter is a tiny "diff" — often just tens of megabytes — that fine-tunes a big base model for one specific task: a support bot, a coding assistant, a legal summarizer. Now suppose you have a hundred such fine-tunes. The naïve way is a hundred separate deployments — a hundred copies of the multi-gigabyte base model on a hundred GPUs. That's absurd, because they all share the same base. vLLM's fix is to load the base model just once, keep each small adapter in memory alongside it, and — here's the clever part — serve requests for *different* adapters in the *same batch*. Every token still flows through the shared base weights, and each request's own little adapter is applied on top, using specialized GPU kernels — vLLM calls them the Punica, or SGMV, kernels — that do this mixed-adapter math efficiently in a single pass. The result: you serve dozens or hundreds of fine-tuned variants from one base-model deployment. You turn it on with a flag called enable-lora, and tune how many adapters share a batch with max-loras. And notice — adapters not currently needed sit parked in CPU memory and get swapped to the GPU on demand. That's paging again, applied to adapters this time.

---

## Part 9 — Scaling to many GPUs and machines

Before we scale out, one practical question worth answering: where does a running vLLM actually live? It's a Python process on a host machine that drives one or more GPUs. The CPU side does the orchestration — the HTTP API server, the tokenizer, the scheduler, the block manager. The GPU side holds the model weights and the KV cache and runs the math kernels. In practice it's almost always packaged as a Docker container — the official image is called vllm-openai, and it exposes an OpenAI-compatible API on port eight thousand. How many containers? Typically just one per node. A model that needs four GPUs through tensor parallelism runs as *one* container, with *one* main process that spawns one worker process per GPU — four of them here. You do *not* run one container per GPU. To handle more traffic, you run more replicas — more containers, more nodes — behind a load balancer, which is data parallelism. With that picture in mind, here are the ways to grow.

What happens when one GPU just isn't enough — either because the model is too big to fit, or because you have too much traffic? Three strategies, and real systems mix all of them.

**Tensor parallelism** splits each individual layer's math across several GPUs inside one machine. A driver GPU broadcasts the work, and all the GPUs compute their shard together. This is preferred *inside* a single machine because those GPUs are connected by very fast links.

**Pipeline parallelism** puts different layers on different machines, like an assembly line — the data flows from one machine to the next, layer by layer. This is how you span across machines when one box can't hold the whole model.

**Data parallelism** just runs several complete copies — replicas — of the engine, with a coordinator load-balancing users across them. This is how you handle more *traffic* rather than a bigger model.

And one organizational detail: typically one machine runs the public-facing API server, while other "headless" machines just run engine replicas behind it. Clients only ever talk to the API node.

Here's the analogy. Tensor parallelism is many workers building one car together. Pipeline parallelism is an assembly line passing the car down the stations. Data parallelism is many identical factories. Big deployments use all three at once.

---

## Part 10 — Measuring "fast"

Finally — how do we even measure whether this is fast? Because "fast" means two different things, and they pull against each other.

The first is **latency** — how happy one individual user is. There are three numbers here. **TTFT**, time to first token: how long until you see *anything* appear — that's set by prefill. **ITL**, or inter-token latency, sometimes called TPOT: the time between tokens, basically how fast it seems to "type" — that's set by decode. And **end-to-end latency**: the total time for the whole answer.

The second meaning is **throughput** — how happy the *operator's wallet* is. That's the total tokens per second across *all* users combined. Bigger batches give more throughput, though any single user might wait a hair longer. And there's a lovely term, **goodput** — that's throughput that *still meets your latency promises*. Raw throughput is easy; goodput is the honest number.

And now the one chart that ties the entire lecture together: the **roofline model.** Picture a hill with two slopes. There's a rising diagonal slope, and then a flat ceiling at the top.

The diagonal slope is the **memory-bandwidth-bound** region — this is where decode lives. Down here, the GPU's math units are mostly sitting idle, twiddling their thumbs, waiting for data to arrive from memory. You're not limited by computing power; you're limited by how fast you can fetch data. The flat ceiling at the top is the **compute-bound** region — where prefill lives, and where the GPU is finally fully utilized, doing math as fast as it physically can.

Here's the key move. When you batch more requests together — continuous batching, our hero from Part 6 — you increase the amount of useful work done per byte of memory fetched. That pushes you *up the slope, toward the ceiling.* You go from a half-idle GPU to a fully-used one. And *that* is the deepest reason batching sits at the very heart of vLLM: it's how you climb off the wasteful memory-bound slope and actually use the expensive hardware you're paying for.

---

## Epilogue — The whole story in one breath

Let's put it all together, because you genuinely understand this now.

A language model predicts one token at a time, re-reading everything at each step. To stop that waste, it saves each token's Key and Value in the KV cache. That cache lives in scarce, expensive GPU memory — and the old way of storing it in big contiguous chunks wasted most of it, through internal and external fragmentation, and couldn't share identical data.

vLLM borrowed the operating system's idea of paging: chop the KV cache into small blocks, map them with a page table, and reference-count them for sharing. That's PagedAttention. On top of that, continuous batching keeps the GPU perpetually busy by swapping finished requests for waiting ones the instant a slot frees up.

The engine runs a simple loop — schedule, forward pass, postprocess — splitting work into compute-bound prefill and memory-bound decode. A handful of extras — chunked prefill, prefix caching, guided and speculative decoding, and prefill/decode disaggregation — wring out still more speed. And the whole thing scales across many GPUs and machines through tensor, pipeline, and data parallelism.

And the payoff, in one number from our example: the old contiguous approach served about 40 requests on that A100. With vLLM's paging, it's around 256. Same hardware. Roughly six to eight times more users — purely by managing memory the way an operating system does.

That's the magic. And now you know exactly how it works. Thanks for listening.

---

*Companion to the visual guide at `index.html`. Source material: "Inside vLLM: Anatomy of a High-Throughput LLM Inference System" by Aleksa Gordic, plus the lecture transcripts in this knowledge base. For exact, current APIs and defaults, always consult [docs.vllm.ai](https://docs.vllm.ai/).*

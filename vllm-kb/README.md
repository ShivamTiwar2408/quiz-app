# vLLM Knowledge Base

A self-contained knowledge base on vLLM internals — how a high-throughput LLM inference engine works, from paged attention to multi-node serving. Built so the full content (prose **and** diagrams) is available as searchable text without opening images or going online.

## Contents

| File | What it is | Source |
|------|-----------|--------|
| `blog-anatomy-of-vllm.md` | Full text of "Inside vLLM: Anatomy of a High-Throughput LLM Inference System" by Aleksa Gordic (vLLM blog, 2025-09-05). Image links rewritten to local `assets/images/`. | https://vllm.ai/blog/2025-09-05-anatomy-of-vllm (canonical MD from the vllm-project GitHub) |
| `diagrams-explained.md` | **Text transcriptions of all 18 diagrams** — every label, arrow, formula, and annotation converted to prose so diagram content is searchable. | Vision analysis of `assets/images/*.png` |
| `transcript-life-of-a-prompt.txt` | Transcript of the YouTube lecture "Life of a Prompt Through LLM Inference" (video `QyHHbeXqgrQ`), generated via AWS Transcribe. | YouTube → AWS Transcribe |
| `transcript-how-does-vllm-work.txt` | Transcript of the YouTube video "How does vLLM actually work? 🤔" (video `F_sxTy71v4k`, 21 min), generated via AWS Transcribe. Focuses on the OS-paging analogy, internal/external fragmentation, memory sharing, and the block-count math behind PagedAttention. | YouTube → AWS Transcribe |
| `concepts-glossary.md` | Cross-referenced glossary of every key term, mapping each concept to where it's covered in the blog, diagrams, and transcripts. | Synthesized |
| `assets/images/` | The 18 source diagram PNGs. | vLLM blog assets |

## Topic map (where to look)

- **Engine architecture / engine core / scheduler** → blog §"LLM Engine & Engine Core"; diagrams 1, 2.
- **KV cache, blocks, paged attention** → blog §"Scheduler"/"allocate_slots"; diagrams 1, 3, 4; transcript (blocks, page table, free block queue).
- **Prefill vs decode, continuous batching** → blog §"Scheduler"; diagram 4; transcript (prefill/decode, static vs continuous batching).
- **Chunked prefill** → blog §"Chunked prefill"; diagram 5.
- **Prefix caching** → blog §"Prefix Caching"; diagrams 6, 7, 8.
- **Guided / structured decoding (FSM)** → blog §"Guided Decoding (FSM)"; diagrams 9, 10.
- **Speculative decoding** → blog §"Speculative Decoding"; diagrams 11, 12.
- **Disaggregated P/D** → blog §"Disaggregated P/D"; diagram 13.
- **Tensor parallelism / MultiProcExecutor** → blog §"From UniprocExecutor to MultiProcExecutor"; diagram 14.
- **Distributed / multi-node serving** → blog §"Distributed system serving vLLM"; diagrams 15, 16.
- **Benchmarks: latency vs throughput, roofline** → blog §"Benchmarks and auto-tuning"; diagrams 17, 18.

## Sources, three altitudes

- The **blog** is the precise, code-level reference (commit `42172ad`, V1 engine): exact function names, data structures, config flags.
- **Transcript "life of a prompt"** (`QyHHbeXqgrQ`) is the intuitive, visual walkthrough ("put yourself in the shoes of the prompt"): great for mental models of blocks, prefill/decode, and continuous batching.
- **Transcript "how does vLLM actually work"** (`F_sxTy71v4k`) is the *motivation/analogy* layer: why naive contiguous KV allocation wastes memory (internal & external fragmentation), how OS virtual-memory paging inspired PagedAttention, memory sharing across samples, and the concrete block-count math (e.g. 32 vs 256 concurrent requests on an A100).

Note: both transcripts are auto-transcribed, so some technical terms are mis-heard — see `concepts-glossary.md` for corrections (e.g. "page detention/retention" → paged attention, "Kiwi/Qa cache" → KV cache, "paced/phasing attention" → paged attention).

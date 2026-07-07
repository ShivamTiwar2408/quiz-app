# Deep Dives — read, then quiz yourself

A self-contained reading page for **deep dives on anything worth understanding
properly**. Each article explains a topic from first principles, links back to
its source, and ends with an interactive quiz. The collection is deliberately
open-ended — any subject can land here.

- **Live:** https://shivamtiwar2408.github.io/quiz-app/deep-dives/
- `index.html` — the reading app (left section→article tree, right reading pane,
  deep-linkable via `#/<article-id>`). Same engine as `systems-problems-kb`,
  generalized so sections are arbitrary and colored by position.
- `data.json` — all content (the single source of truth the page renders).

## Sections

Sections are just top-level buckets; add, rename, or reorder them freely in
`data.json`. Current buckets:

- **Systems & Infrastructure** — distributed systems, networking, orchestration, protocols.
- **Languages & Runtimes** — how languages, compilers, and runtimes work under the hood *(coming soon)*.
- **Theory & Foundations** — algorithms, data structures, CS fundamentals *(coming soon)*.
- **Everything Else** — anything that doesn't fit a neat box *(coming soon)*.

## Articles

All current articles live under **Systems & Infrastructure** and share a theme:
OS-level design tradeoffs where a primitive optimal in one context is wrong in
another. Every article is written from first principles — a "Before we start —
building blocks" section explains the prerequisite OS/Linux/hardware constructs
before the problem — and ends with an interactive quiz.

1. **Why STDIO transport is incompatible with Kubernetes** — parent–child pipes
   vs. ephemeral network-oriented pods; the sidecar mitigation. (Kartik Sarda,
   Medium 2026.)
2. **Same Machine, Wrong Wire: the local IPC performance hierarchy** — shared
   memory > pipes > Unix domain sockets > loopback TCP; the mirror image of the
   STDIO case. (UW-Madison IPC study; goldsborough/ipc-bench.)
3. **Are You Sure You Want to mmap Your Database?** — mmap vs a purpose-built
   buffer pool: WAL ordering, page-fault stalls, TLB shootdowns. (Crotty/Leis/
   Pavlo, CIDR 2022.)
4. **A fork() in the Road** — fork() vs posix_spawn(): fails to compose, breaks
   with threads and accelerators, cost scales with memory. (Baumann et al.,
   HotOS 2019.)
5. **The Byte-Stream Tax: TCP, QUIC, and head-of-line blocking** — one ordered
   stream vs independent streams over UDP; kernel ossification. (Langley et al.,
   SIGCOMM 2017; RFC 9000.)
6. **One Thread Per Connection Doesn't Scale: the C10K problem** — blocking
   thread-per-connection vs event-driven epoll/kqueue; O(n) vs O(active).
   (Kegel's C10K; Gammo et al., 2004.)
7. **Why Wall-Clock Time Can't Order Distributed Events** — physical vs logical
   (Lamport) clocks; happened-before, partial order, TrueTime. (Lamport, CACM
   1978.)
8. **The Location-Transparency Fallacy** — local calls vs remote objects along
   latency, memory, partial failure, concurrency. (Waldo et al., 1994.)

## Adding an article

Append a topic object to the relevant section's `topics` array in `data.json`.
Fields the renderer understands (most are optional):

```
id, name, premise, why            (core)
year        — shown as "Context" (optional)
deepDive    — long body; blank lines separate paragraphs (optional)
diagram     — inline <svg> string (optional)
solutions   — [[heading, detail], …] shown as "How it's addressed" (optional)
caseStudies — [{title, body}, …] (optional)
papers      — references string (optional)
links       — [[label, url], …] (optional)
takeaway    — italic key-takeaway callout (optional)
mcqs        — [{q, options[], answer (0-based index), explanation}, …] (optional)
```

Empty sections render as greyed-out "coming soon" cards on the intro and are
hidden from the sidebar tree until they have at least one article.

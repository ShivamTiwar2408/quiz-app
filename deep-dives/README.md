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

- **Why STDIO transport is incompatible with Kubernetes** *(Systems & Infrastructure)* —
  the parent–child process / pipe model of STDIO vs. Kubernetes' ephemeral,
  network-oriented pods; why the pipe cannot cross pods or survive restarts; and
  the sidecar mitigation. Absorbed from Kartik Sarda, *"The Fundamental
  Incompatibility Between STDIO Transport and Kubernetes"* (Medium, Feb 2026).

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

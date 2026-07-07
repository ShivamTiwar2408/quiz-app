# MCP in Production — a field guide

A self-contained reading page on the **Model Context Protocol (MCP)** as it behaves
outside local development: its transports, their trade-offs, and what survives a
real deployment. Each article ends with an interactive quiz.

- **Live:** https://shivamtiwar2408.github.io/quiz-app/mcp-kb/
- `index.html` — the reading app (left section→article tree, right reading pane,
  deep-linkable via `#/<article-id>`). Same engine as `systems-problems-kb`.
- `data.json` — all content (the single source of truth the page renders).

## Sections

- **Foundations** — what MCP is and the client/server model *(coming soon)*.
- **Transports** — STDIO, SSE, Streamable HTTP *(coming soon)*.
- **Production & Kubernetes** — what breaks when MCP meets orchestration.

## Articles

- **Why STDIO transport is incompatible with Kubernetes** — the parent–child
  process / pipe model of STDIO vs. Kubernetes' ephemeral, network-oriented pods;
  why the pipe cannot cross pods or survive restarts; and the sidecar mitigation.
  Absorbed from Kartik Sarda, *"The Fundamental Incompatibility Between STDIO
  Transport and Kubernetes"* (Medium, Feb 2026).

## Adding an article

Append a topic object to the relevant section's `topics` array in `data.json`.
Fields the renderer understands (most are optional):

```
id, name, premise, why            (required-ish core)
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

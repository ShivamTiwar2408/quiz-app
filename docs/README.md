# Recallr — Documentation

A spaced-repetition quiz platform built with React + TypeScript, backed by
**Firebase** (Cloud Firestore + Google Sign-In). Fully serverless and
client-side; the spaced-repetition (SM-2) and quiz-generation logic run in the
browser.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Firebase Setup & Deployment](./FIREBASE-SETUP.md) | Project setup, Firestore data model, local dev, and deployment (CLI + CI) |
| [SM-2 Algorithm](./SM2-ALGORITHM.md) | The spaced-repetition algorithm and scheduling details |

See the [root README](../README.md) for an architecture overview and quick start.

## Question bank

All quiz content is consolidated into a single bundle at
`public/questions-data.json` by `scripts/build-questions.js` (run automatically
via the `prebuild` / `prestart` npm hooks). Sources:

- `questions/<Topic>/<Subtopic>.json` — system-design + electronics banks.
- `quiz/data/sets/bhagavatam-*.json` — Śrīmad Bhāgavatam (Canto 3).

The React app derives its topic tree dynamically from the bundle, so adding a
new source file surfaces in the app on the next build — no code changes needed.

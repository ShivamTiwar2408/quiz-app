# Recallr — Spaced Repetition Quiz Platform

A React + TypeScript app for mastering system design (and more) through
**SM-2 spaced repetition**. Users sign in with Google, and their progress,
mistakes, and review schedule sync to **Cloud Firestore** so the platform
resurfaces the questions they got wrong at scientifically-spaced intervals.

> **Serverless & free:** runs entirely on the client against Firebase
> (Auth + Firestore). No server to operate. See
> [`docs/FIREBASE-SETUP.md`](docs/FIREBASE-SETUP.md).

## Architecture

- **Frontend**: React 18 + TypeScript (Create React App), PWA.
- **Auth**: Firebase Authentication — Google Sign-In.
- **Database**: Cloud Firestore — per-user progress / attempts / sessions / notes.
- **Domain logic**: pure, client-side modules in `src/lib/` (SM-2 algorithm,
  quiz-generation strategies). Fully unit-tested, zero I/O.
- **Question bank**: bundled static asset (`public/questions-data.json`).

```
src/
  api.ts                     single data boundary (stable signatures)
  auth.ts                    Firebase Google Sign-In
  firebase.ts                Firebase app/Auth/Firestore init
  lib/                       PURE logic — sm2, quizStrategies, quizGenerator
  data/
    questionBank.ts          loads + caches the bundled questions
    repositories.ts          typed Firestore CRUD (users/{uid}/…)
    progressService.ts       orchestrates repos + lib (SM-2, aggregation)
```

The legacy AWS CDK backend (`infrastructure/`) is retained for reference but is
no longer used; the pure logic in `src/lib/` was ported from it verbatim.

## Local Development

```bash
cp .env.example .env.local    # fill REACT_APP_FIREBASE_* (see FIREBASE-SETUP.md)
npm install
npm start                     # http://localhost:3000
```

```bash
npm run typecheck             # tsc --noEmit
npm test                      # jest
npm run build                 # production build
```

## Deployment

Google Sign-In requires an authorized domain, so the app is deployed to
**Firebase Hosting**:

```bash
npm run deploy:rules          # firestore.rules + indexes (one-time / on change)
npm run deploy:hosting        # build + deploy the app
```

Full instructions: [`docs/FIREBASE-SETUP.md`](docs/FIREBASE-SETUP.md).

## Features

- **SM-2 spaced repetition** — confidence-weighted scheduling with ease factor,
  intervals, streaks, and `learning/reviewing/mastered/struggling` status.
- **"Remind me of my mistakes"** — Spaced Review surfaces overdue questions and
  Weak Area auto-targets struggling topics.
- **6 quiz modes**: Adaptive, Spaced Review, Topic Focused, Weak Area, Exam Prep,
  Random.
- **Cross-device sync** via Firestore; **offline-first** persistent cache.
- Analytics dashboard, notes, confidence feedback (0–5), PWA support.

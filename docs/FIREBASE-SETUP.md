# Firebase Setup & Deployment

Recallr now runs **fully serverless on the client**: the React SPA talks
directly to **Cloud Firestore** (per-user progress, attempts, sessions, notes)
and authenticates with **Firebase Auth (Google Sign-In)**. The spaced-repetition
(SM-2) and quiz-generation logic runs in the browser (`src/lib/`), and the
question bank is a bundled static asset (`public/questions-data.json`).

There is **no backend to run** — no API Gateway, Lambda, or DynamoDB.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    React SPA (build/)                        │
│                                                              │
│  UI (screens / components)                                   │
│        │                                                     │
│        ▼                                                     │
│  src/api.ts  ── single data boundary (unchanged signatures)  │
│    ├── src/auth.ts ............ Firebase Auth (Google)       │
│    ├── src/data/progressService.ts ── orchestration         │
│    │      └── src/lib/  (PURE: sm2, quizStrategies,          │
│    │                     quizGenerator)  ◄── ported as-is    │
│    ├── src/data/repositories.ts ── Firestore CRUD            │
│    └── src/data/questionBank.ts ── bundled questions JSON    │
└───────────────┬──────────────────────────────────────────────┘
                ▼
        Cloud Firestore (free tier)
        users/{uid}/progress|attempts|sessions|notes
```

Why this is clean & scalable:

- **One data boundary.** Every screen/hook still imports from `src/api.ts`; only
  its implementation changed. Swapping AWS → Firestore touched no UI code.
- **Pure domain logic.** `src/lib/` has zero I/O — fully unit-testable and
  reused verbatim from the original Lambda `shared/` modules.
- **Per-user data isolation.** Each user's documents live under `users/{uid}/…`,
  enforced by `firestore.rules`. No cross-user scans → cheap and secure.
- **Offline-first.** Firestore persistent cache means progress is written
  locally and synced when online; works on flaky networks.

## Fastest path: one-command bootstrap

`scripts/firebase-bootstrap.sh` automates every CLI-scriptable step — install
the CLI, log in, create the project, create Firestore, register a Web app and
write `.env.local`, deploy rules/indexes, build, and deploy Hosting:

```bash
./scripts/firebase-bootstrap.sh            # uses a default project id
./scripts/firebase-bootstrap.sh my-recallr # or pass your own (must be globally unique)
```

It is idempotent (safe to re-run) and pauses once at the **only** step the CLI
cannot do: enabling Google Sign-In in the console (it prints the exact link).

Prefer to do it by hand? Follow the steps below.

## One-time Firebase project setup

1. Create a project at https://console.firebase.google.com.
2. **Build → Authentication → Sign-in method →** enable **Google**.
3. **Build → Firestore Database → Create database** (production mode).
4. **Project settings → General → Your apps →** add a **Web app**; copy the
   config values.
5. Copy `.env.example` to `.env.local` and fill in the `REACT_APP_FIREBASE_*`
   values.
6. Under **Authentication → Settings → Authorized domains**, add the domain(s)
   you'll serve from (e.g. `localhost`, `<project>.web.app`, and your custom
   domain). Google Sign-In only works on authorized domains.

## Deploy security rules & indexes

```bash
npm install -g firebase-tools
firebase login
firebase use --add            # select your project
npm run deploy:rules          # firestore.rules + firestore.indexes.json
```

## Run locally

```bash
cp .env.example .env.local    # fill in values
npm install
npm start                     # http://localhost:3000
```

Without Firebase env vars the app still renders the sign-in screen but
persistence/auth are disabled (graceful degradation) — useful for UI work.

## Deploy the app (Firebase Hosting)

Google Sign-In requires an authorized domain, so the React app is hosted on
**Firebase Hosting** (the static guides + landing page remain on GitHub Pages).

```bash
npm run deploy:hosting        # build + firebase deploy --only hosting
# or everything (hosting + rules + indexes):
npm run deploy
```

The app will be live at `https://<project>.web.app`.

## Auto-deploy on push (GitHub Actions)

`.github/workflows/deploy-firebase.yml` builds, typechecks, tests, and deploys
the app (Hosting + Firestore rules/indexes) on every push to `main` that touches
the app. Set these up once:

1. Generate a deploy service account — easiest via:
   ```bash
   firebase init hosting:github
   ```
   This creates a service account and stores its key as the
   `FIREBASE_SERVICE_ACCOUNT_*` repo secret automatically. Rename/copy it to
   **`FIREBASE_SERVICE_ACCOUNT`** (the name this workflow expects), or set that
   secret manually with the service-account JSON.
2. Add the remaining repository secrets (Settings → Secrets and variables →
   Actions):
   - `FIREBASE_PROJECT_ID`
   - `REACT_APP_FIREBASE_API_KEY`, `..._AUTH_DOMAIN`, `..._PROJECT_ID`,
     `..._STORAGE_BUCKET`, `..._MESSAGING_SENDER_ID`, `..._APP_ID`
3. Push to `main` (or run the workflow manually via **Actions →
   Deploy Recallr to Firebase Hosting → Run workflow**).

The service account needs the **Firebase Hosting Admin** and **Cloud Datastore
Index Admin** roles to deploy hosting and rules/indexes respectively.

## Data model (Firestore)

| Path | Document |
|------|----------|
| `users/{uid}/progress/{questionId}` | SM-2 state per question (`UserQuestionProgress`) |
| `users/{uid}/attempts/{attemptId}`  | Every answer — powers "past mistakes" history |
| `users/{uid}/sessions/{sessionId}`  | Quiz runs |
| `users/{uid}/notes/{noteId}`        | User notes |

## Spaced repetition & "remind me of past mistakes"

- After each answer, `submitAnswer` runs the SM-2 update and writes the new
  `nextReviewDate`, ease factor, interval, streak, and `userStatus`
  (`learning` / `reviewing` / `mastered` / `struggling`) to Firestore.
- The **Spaced Review** quiz type prioritizes overdue questions; **Weak Area**
  targets topics/questions the user is `struggling` with — i.e. their past
  mistakes resurface automatically at SM-2-scheduled intervals.

## Migrating off AWS

The legacy AWS backend (`infrastructure/`) is retained for reference but is no
longer used by the app. Once Firestore is verified in production it can be
torn down with `cdk destroy` from `infrastructure/`.

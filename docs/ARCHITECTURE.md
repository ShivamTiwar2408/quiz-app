# Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CloudFront CDN                                  │
│                        (d2sa2ctd5invsq.cloudfront.net)                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
        ┌───────────────────┐               ┌───────────────────────┐
        │     S3 Bucket     │               │    API Gateway        │
        │  (Static Assets)  │               │  (REST API + CORS)    │
        │   React SPA       │               │  Cognito Authorizer   │
        └───────────────────┘               └───────────────────────┘
                                                       │
                    ┌──────────────────────────────────┼──────────────────────┐
                    │                                  │                      │
                    ▼                                  ▼                      ▼
        ┌───────────────────┐           ┌───────────────────┐    ┌───────────────────┐
        │  Quiz Lambdas     │           │  Analytics Lambdas│    │  Notes Lambdas    │
        │  - generateQuiz   │           │  - getAnalytics   │    │  - getNotes       │
        │  - submitAnswer   │           │  - getAttempts    │    │  - saveNote       │
        │  - getTopics      │           │  - getSessions    │    │  - deleteNote     │
        │  - getProgress    │           │  - getStats       │    └───────────────────┘
        │  - manageQuestions│           └───────────────────┘
        └───────────────────┘
                    │                                  │
                    └──────────────────┬───────────────┘
                                       ▼
        ┌─────────────────────────────────────────────────────────────────────┐
        │                         DynamoDB Tables                              │
        │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────────┐  │
        │  │  Progress   │ │  Attempts   │ │  Sessions   │ │    Notes      │  │
        │  │  (SM-2 data)│ │  (history)  │ │  (quizzes)  │ │  (user notes) │  │
        │  └─────────────┘ └─────────────┘ └─────────────┘ └───────────────┘  │
        │  ┌─────────────────────┐                                            │
        │  │  CustomQuestions    │                                            │
        │  │  (user-created)     │                                            │
        │  └─────────────────────┘                                            │
        └─────────────────────────────────────────────────────────────────────┘
```

## Component Overview

### Frontend (React SPA)

| Component | Purpose |
|-----------|---------|
| `App.tsx` | Main router, screen management, quiz flow orchestration |
| `AuthScreen` | Sign up, sign in, email confirmation |
| `QuizQuestion` | Question display, answer selection, confidence rating |
| `AnalyticsScreen` | Progress tracking, topic breakdown, history |
| `QuestionManager` | CRUD for custom questions |
| `NotesScreen` | Note management with pin/quiz-me features |
| `Sidebar` | Navigation, topic browser, quick actions |

### Backend (AWS Lambda)

| Lambda | Endpoint | Purpose |
|--------|----------|---------|
| `generateQuiz` | POST /quiz/generate | Create quiz with SM-2 selection |
| `submitAnswer` | POST /quiz/submit | Process answer, update SM-2 state |
| `getTopics` | GET /topics | Return topic hierarchy |
| `getProgress` | GET /progress | User's SM-2 progress data |
| `getStats` | GET /stats | Aggregated statistics |
| `getAttempts` | GET /attempts | Attempt history |
| `getSessions` | GET /sessions | Quiz session history |
| `getAnalytics` | GET /analytics | Comprehensive analytics |
| `manageQuestions` | /questions (CRUD) | Custom question management |
| `getNotes` | GET /notes | Fetch user notes |
| `saveNote` | POST /notes | Create/update note |
| `deleteNote` | DELETE /notes/{id} | Remove note |

### Shared Modules

| Module | Purpose |
|--------|---------|
| `sm2.ts` | SM-2 algorithm implementation |
| `quizGenerator.ts` | Question selection strategies |
| `db.ts` | DynamoDB client singleton |
| `auth.ts` | User ID extraction from JWT |
| `response.ts` | Standardized API responses |
| `types.ts` | TypeScript interfaces |
| `constants.ts` | SM-2 parameters, thresholds |

## Data Flow

### Quiz Generation Flow
```
1. User selects quiz type → Frontend
2. POST /quiz/generate with {quizType, count, topic?} → API Gateway
3. Lambda queries Progress table for user's SM-2 state
4. QuizGenerator selects questions based on:
   - Due dates (spaced repetition)
   - Performance history
   - Topic distribution
   - Quiz type strategy
5. Creates Session record in Sessions table
6. Returns questions with sessionId → Frontend
7. Frontend displays questions one at a time
```

### Answer Submission Flow
```
1. User answers + rates confidence → Frontend
2. POST /quiz/submit with {sessionId, questionId, answers, confidence, timeMs}
3. Lambda:
   a. Validates answer correctness
   b. Calculates new SM-2 parameters (EF, interval, repetitions)
   c. Updates Progress table with new review date
   d. Records attempt in Attempts table
   e. Updates Session statistics
4. Returns {isCorrect, newProgress, explanation} → Frontend
5. Frontend shows result + explanation
```

## Security

- **Authentication**: AWS Cognito User Pools with email verification
- **Authorization**: Cognito JWT tokens validated by API Gateway authorizer
- **Data Isolation**: All queries filtered by userId from JWT
- **CORS**: Configured for all origins (development flexibility)
- **HTTPS**: Enforced via CloudFront

## Scalability

- **Serverless**: Auto-scaling Lambda functions
- **DynamoDB**: On-demand capacity, no provisioning needed
- **CloudFront**: Global edge caching for static assets
- **Stateless**: All state in DynamoDB, Lambdas are stateless

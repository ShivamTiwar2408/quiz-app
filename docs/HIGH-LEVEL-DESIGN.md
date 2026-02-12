# High-Level Design (HLD) - Recallr Quiz Application

## 1. Executive Summary

Recallr is a serverless spaced repetition learning platform built on AWS. It implements the SM-2 algorithm to optimize knowledge retention through intelligent quiz scheduling. The system supports multiple quiz modes, custom question creation, note-taking, and comprehensive analytics.

**Key Characteristics:**
- Fully serverless architecture (zero server management)
- Multi-tenant with user isolation via Cognito
- Real-time progress tracking with SM-2 algorithm
- Progressive Web App (PWA) capable frontend

---

## 2. System Context Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    EXTERNAL ACTORS                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│    ┌──────────────┐         ┌──────────────┐         ┌──────────────┐              │
│    │    User      │         │   Admin      │         │  Content     │              │
│    │  (Learner)   │         │  (Future)    │         │  Creator     │              │
│    └──────┬───────┘         └──────────────┘         └──────┬───────┘              │
│           │                                                  │                       │
│           │  HTTPS                                          │ JSON Files            │
│           ▼                                                  ▼                       │
│    ┌─────────────────────────────────────────────────────────────────────────┐      │
│    │                                                                          │      │
│    │                        RECALLR QUIZ SYSTEM                              │      │
│    │                                                                          │      │
│    │   ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐    │      │
│    │   │  Frontend   │◄──►│   Backend   │◄──►│     Data Layer          │    │      │
│    │   │  (React)    │    │   (Lambda)  │    │     (DynamoDB)          │    │      │
│    │   └─────────────┘    └─────────────┘    └─────────────────────────┘    │      │
│    │                                                                          │      │
│    └─────────────────────────────────────────────────────────────────────────┘      │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                         CloudFront CDN (Global Edge)                           │  │
│  │                      d2sa2ctd5invsq.cloudfront.net                            │  │
│  │  • HTTPS termination  • Caching  • Geo-distribution  • DDoS protection        │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                             │
│              ┌─────────────────────────┴─────────────────────────┐                  │
│              ▼                                                   ▼                  │
│  ┌─────────────────────────┐                     ┌─────────────────────────────┐   │
│  │      S3 Bucket          │                     │      API Gateway            │   │
│  │   (Static Hosting)      │                     │      (REST API)             │   │
│  │                         │                     │                             │   │
│  │  • React SPA Bundle     │                     │  • Route Management         │   │
│  │  • CSS/JS Assets        │                     │  • Request Validation       │   │
│  │  • Service Worker       │                     │  • CORS Handling            │   │
│  │  • Manifest (PWA)       │                     │  • Rate Limiting            │   │
│  └─────────────────────────┘                     └──────────────┬──────────────┘   │
└──────────────────────────────────────────────────────────────────┼──────────────────┘
                                                                   │
┌──────────────────────────────────────────────────────────────────┼──────────────────┐
│                              SECURITY LAYER                      │                   │
│  ┌───────────────────────────────────────────────────────────────┼───────────────┐  │
│  │                      Cognito User Pool                        │               │  │
│  │                                                               ▼               │  │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────────┐   │  │
│  │  │   Sign Up   │    │   Sign In   │    │     JWT Token Validation        │   │  │
│  │  │   + Email   │    │   + MFA     │    │     (Cognito Authorizer)        │   │  │
│  │  │   Verify    │    │   (future)  │    │                                 │   │  │
│  │  └─────────────┘    └─────────────┘    └─────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```


---

## 4. Application Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              APPLICATION LAYER (Lambda Functions)                    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                           QUIZ DOMAIN                                        │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │    │
│  │  │  generateQuiz   │  │  submitAnswer   │  │   getTopics     │              │    │
│  │  │  ─────────────  │  │  ─────────────  │  │  ─────────────  │              │    │
│  │  │  POST /quiz/    │  │  POST /quiz/    │  │  GET /topics    │              │    │
│  │  │  generate       │  │  submit         │  │                 │              │    │
│  │  │                 │  │                 │  │  Returns topic  │              │    │
│  │  │  • SM-2 based   │  │  • Validates    │  │  hierarchy from │              │    │
│  │  │    selection    │  │    answers      │  │  static JSON    │              │    │
│  │  │  • 6 quiz modes │  │  • Updates SM-2 │  │                 │              │    │
│  │  │  • Session mgmt │  │  • Records      │  │  Memory: 256MB  │              │    │
│  │  │                 │  │    attempts     │  └─────────────────┘              │    │
│  │  │  Memory: 512MB  │  │                 │                                   │    │
│  │  └─────────────────┘  │  Memory: 256MB  │                                   │    │
│  │                       └─────────────────┘                                   │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         ANALYTICS DOMAIN                                     │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │    │
│  │  │  getProgress    │  │   getStats      │  │  getAnalytics   │              │    │
│  │  │  ─────────────  │  │  ─────────────  │  │  ─────────────  │              │    │
│  │  │  GET /progress  │  │  GET /stats     │  │  GET /analytics │              │    │
│  │  │                 │  │                 │  │                 │              │    │
│  │  │  • User's SM-2  │  │  • Aggregated   │  │  • Dashboard    │              │    │
│  │  │    state        │  │    statistics   │  │    data         │              │    │
│  │  │  • Due reviews  │  │  • Topic stats  │  │  • Daily trends │              │    │
│  │  │                 │  │  • Streaks      │  │  • Sessions     │              │    │
│  │  │  Memory: 256MB  │  │  Memory: 256MB  │  │  Memory: 512MB  │              │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘              │    │
│  │                                                                              │    │
│  │  ┌─────────────────┐  ┌─────────────────┐                                   │    │
│  │  │  getAttempts    │  │  getSessions    │                                   │    │
│  │  │  ─────────────  │  │  ─────────────  │                                   │    │
│  │  │  GET /attempts  │  │  GET /sessions  │                                   │    │
│  │  │                 │  │                 │                                   │    │
│  │  │  • Attempt      │  │  • Quiz session │                                   │    │
│  │  │    history      │  │    history      │                                   │    │
│  │  │  • Per-question │  │  • Completion   │                                   │    │
│  │  │    filtering    │  │    stats        │                                   │    │
│  │  │  Memory: 256MB  │  │  Memory: 256MB  │                                   │    │
│  │  └─────────────────┘  └─────────────────┘                                   │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         CONTENT DOMAIN                                       │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │    │
│  │  │ manageQuestions │  │  hideQuestion   │  │    getNotes     │              │    │
│  │  │  ─────────────  │  │  ─────────────  │  │  ─────────────  │              │    │
│  │  │  /questions     │  │  /hidden-       │  │  GET /notes     │              │    │
│  │  │  (CRUD)         │  │  questions      │  │                 │              │    │
│  │  │                 │  │                 │  │  • Fetch user   │              │    │
│  │  │  • Create       │  │  • Hide/unhide  │  │    notes        │              │    │
│  │  │  • Read         │  │    questions    │  │  • Filter by    │              │    │
│  │  │  • Update       │  │  • Per-user     │  │    pinned/quiz  │              │    │
│  │  │  • Delete       │  │    preferences  │  │                 │              │    │
│  │  │  Memory: 256MB  │  │  Memory: 256MB  │  │  Memory: 256MB  │              │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘              │    │
│  │                                                                              │    │
│  │  ┌─────────────────┐  ┌─────────────────┐                                   │    │
│  │  │    saveNote     │  │   deleteNote    │                                   │    │
│  │  │  ─────────────  │  │  ─────────────  │                                   │    │
│  │  │  POST /notes    │  │  DELETE /notes/ │                                   │    │
│  │  │                 │  │  {noteId}       │                                   │    │
│  │  │  • Create/      │  │                 │                                   │    │
│  │  │    update notes │  │  • Remove note  │                                   │    │
│  │  │  • Markdown     │  │                 │                                   │    │
│  │  │    support      │  │  Memory: 256MB  │                                   │    │
│  │  │  Memory: 256MB  │  └─────────────────┘                                   │    │
│  │  └─────────────────┘                                                        │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```


---

## 5. Data Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER (DynamoDB)                                   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         RecallrProgress                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────────────┐    │    │
│  │  │  PK: userId    SK: questionId                                        │    │    │
│  │  │                                                                      │    │    │
│  │  │  Purpose: SM-2 spaced repetition state per user-question pair        │    │    │
│  │  │                                                                      │    │    │
│  │  │  Key Attributes:                                                     │    │    │
│  │  │  • easeFactor (1.3-2.5)    • interval (days)                        │    │    │
│  │  │  • repetitions             • nextReviewDate                          │    │    │
│  │  │  • totalAttempts           • correctAttempts                         │    │    │
│  │  │  • userStatus              • averageConfidenceRating                 │    │    │
│  │  │                                                                      │    │    │
│  │  │  GSIs:                                                               │    │    │
│  │  │  • ReviewDateIndex (userId, nextReviewDate) - Find due questions     │    │    │
│  │  │  • TopicIndex (userId, topic) - Filter by topic                      │    │    │
│  │  │  • StatusIndex (userId, userStatus) - Filter by mastery              │    │    │
│  │  └─────────────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         RecallrAttempts                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────────────┐    │    │
│  │  │  PK: userId    SK: attemptId (timestamp_uuid)                        │    │    │
│  │  │                                                                      │    │    │
│  │  │  Purpose: Complete history of all quiz attempts                      │    │    │
│  │  │                                                                      │    │    │
│  │  │  Key Attributes:                                                     │    │    │
│  │  │  • questionId              • selectedAnswers[]                       │    │    │
│  │  │  • isCorrect               • confidenceRating (0-5)                  │    │    │
│  │  │  • responseTimeMs          • quizType                                │    │    │
│  │  │  • ttl (90 days)                                                     │    │    │
│  │  │                                                                      │    │    │
│  │  │  GSI: QuestionIndex (questionId, attemptedAt)                        │    │    │
│  │  └─────────────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         RecallrSessions                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────────────┐    │    │
│  │  │  PK: userId    SK: sessionId (UUID)                                  │    │    │
│  │  │                                                                      │    │    │
│  │  │  Purpose: Quiz session tracking for analytics and resumption         │    │    │
│  │  │                                                                      │    │    │
│  │  │  Key Attributes:                                                     │    │    │
│  │  │  • quizType                • questionIds[]                           │    │    │
│  │  │  • totalQuestions          • questionsAnswered                       │    │    │
│  │  │  • correctAnswers          • startedAt / completedAt                 │    │    │
│  │  │  • ttl (7 days)                                                      │    │    │
│  │  └─────────────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────────┐         │
│  │       RecallrNotes              │  │    RecallrCustomQuestions        │         │
│  │  ┌────────────────────────────┐ │  │  ┌────────────────────────────┐  │         │
│  │  │  PK: userId  SK: noteId    │ │  │  │  PK: userId  SK: questionId│  │         │
│  │  │                            │ │  │  │                            │  │         │
│  │  │  • title, content          │ │  │  │  • topic, subtopic         │  │         │
│  │  │  • color, pinned           │ │  │  │  • question, options       │  │         │
│  │  │  • quizMe flag             │ │  │  │  • correct_answers         │  │         │
│  │  │                            │ │  │  │  • explanation             │  │         │
│  │  │                            │ │  │  │                            │  │         │
│  │  │                            │ │  │  │  GSI: TopicIndex           │  │         │
│  │  └────────────────────────────┘ │  │  └────────────────────────────┘  │         │
│  └──────────────────────────────────┘  └──────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────────────┘
```


---

## 6. Frontend Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React SPA)                                    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                           COMPONENT HIERARCHY                                │    │
│  │                                                                              │    │
│  │                              ┌─────────────┐                                 │    │
│  │                              │   App.tsx   │                                 │    │
│  │                              │  (Router)   │                                 │    │
│  │                              └──────┬──────┘                                 │    │
│  │                                     │                                        │    │
│  │         ┌───────────────────────────┼───────────────────────────┐           │    │
│  │         │                           │                           │           │    │
│  │         ▼                           ▼                           ▼           │    │
│  │  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐        │    │
│  │  │ AuthScreen  │           │   Sidebar   │           │  MainView   │        │    │
│  │  │             │           │             │           │             │        │    │
│  │  │ • Sign Up   │           │ • Topics    │           │ • Quiz      │        │    │
│  │  │ • Sign In   │           │ • Stats     │           │ • Analytics │        │    │
│  │  │ • Confirm   │           │ • Actions   │           │ • Notes     │        │    │
│  │  └─────────────┘           └─────────────┘           │ • Questions │        │    │
│  │                                                      └──────┬──────┘        │    │
│  │                                                             │               │    │
│  │                    ┌────────────────────────────────────────┼────────┐      │    │
│  │                    │                    │                   │        │      │    │
│  │                    ▼                    ▼                   ▼        ▼      │    │
│  │             ┌────────────┐      ┌────────────┐      ┌────────────┐         │    │
│  │             │QuizQuestion│      │ Analytics  │      │   Notes    │         │    │
│  │             │            │      │   Screen   │      │   Screen   │         │    │
│  │             │ • Question │      │            │      │            │         │    │
│  │             │ • Options  │      │ • Charts   │      │ • Editor   │         │    │
│  │             │ • Timer    │      │ • Stats    │      │ • List     │         │    │
│  │             │ • Result   │      │ • History  │      │ • Colors   │         │    │
│  │             └────────────┘      └────────────┘      └────────────┘         │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                           STATE MANAGEMENT                                   │    │
│  │                                                                              │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │    │
│  │  │    useAuth      │  │    useQuiz      │  │   useProgress   │              │    │
│  │  │                 │  │                 │  │                 │              │    │
│  │  │  • user state   │  │  • questions    │  │  • SM-2 data    │              │    │
│  │  │  • tokens       │  │  • session      │  │  • stats        │              │    │
│  │  │  • sign in/out  │  │  • answers      │  │  • due reviews  │              │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘              │    │
│  │                                                                              │    │
│  │  ┌─────────────────────────────────────────────────────────────────────┐    │    │
│  │  │                         API Layer (api.ts)                          │    │    │
│  │  │                                                                     │    │    │
│  │  │  • authFetch() - JWT token injection + refresh                      │    │    │
│  │  │  • generateQuiz(), submitAnswer() - Quiz operations                 │    │    │
│  │  │  • getProgress(), getStats(), fetchAnalytics() - Data fetching      │    │    │
│  │  │  • CRUD operations for notes, questions, hidden questions           │    │    │
│  │  └─────────────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```


---

## 7. Core Algorithm: SM-2 Spaced Repetition

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              SM-2 ALGORITHM FLOW                                     │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         CONFIDENCE RATING SCALE                              │    │
│  │                                                                              │    │
│  │   0 ─────── 1 ─────── 2 ─────── 3 ─────── 4 ─────── 5                       │    │
│  │   │         │         │         │         │         │                       │    │
│  │   │         │         │         │         │         │                       │    │
│  │   Complete  Wrong     Wrong     Correct   Correct   Perfect                 │    │
│  │   Blackout  but       but       with      with      Recall                  │    │
│  │             recognized close    difficulty hesitation                        │    │
│  │                                                                              │    │
│  │   ◄──────── INCORRECT ────────►  ◄────── CORRECT ──────►                    │    │
│  │        (Reset repetitions)           (Increase interval)                     │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         INTERVAL CALCULATION                                 │    │
│  │                                                                              │    │
│  │   ┌─────────────┐                                                           │    │
│  │   │   Answer    │                                                           │    │
│  │   │  Submitted  │                                                           │    │
│  │   └──────┬──────┘                                                           │    │
│  │          │                                                                   │    │
│  │          ▼                                                                   │    │
│  │   ┌─────────────┐     NO      ┌─────────────────────────────────┐           │    │
│  │   │  Correct?   │────────────►│  Reset: repetitions = 0         │           │    │
│  │   └──────┬──────┘             │         interval = 1 day        │           │    │
│  │          │ YES                │         EF -= 0.32 to 0.8       │           │    │
│  │          ▼                    └─────────────────────────────────┘           │    │
│  │   ┌─────────────────────────────────────────────────────────────┐           │    │
│  │   │  repetitions++                                              │           │    │
│  │   │                                                             │           │    │
│  │   │  if (repetitions == 1) interval = 1                         │           │    │
│  │   │  if (repetitions == 2) interval = 6                         │           │    │
│  │   │  if (repetitions >= 3) interval = interval × EF             │           │    │
│  │   │                                                             │           │    │
│  │   │  EF = EF + adjustment[confidenceRating]                     │           │    │
│  │   │  EF = clamp(EF, 1.3, 2.5)                                   │           │    │
│  │   │                                                             │           │    │
│  │   │  nextReviewDate = today + interval                          │           │    │
│  │   └─────────────────────────────────────────────────────────────┘           │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         USER STATUS DETERMINATION                            │    │
│  │                                                                              │    │
│  │   ┌───────────────┐                                                         │    │
│  │   │   LEARNING    │  < 3 attempts OR accuracy < 75%                         │    │
│  │   │   (New user)  │                                                         │    │
│  │   └───────┬───────┘                                                         │    │
│  │           │ accuracy >= 75%                                                  │    │
│  │           ▼                                                                  │    │
│  │   ┌───────────────┐                                                         │    │
│  │   │   REVIEWING   │  75% <= accuracy < 90%                                  │    │
│  │   │   (Progress)  │                                                         │    │
│  │   └───────┬───────┘                                                         │    │
│  │           │ accuracy >= 90% AND streak >= 5                                  │    │
│  │           ▼                                                                  │    │
│  │   ┌───────────────┐                                                         │    │
│  │   │   MASTERED    │  accuracy >= 90% AND streak >= 5                        │    │
│  │   │   (Expert)    │                                                         │    │
│  │   └───────────────┘                                                         │    │
│  │                                                                              │    │
│  │   ┌───────────────┐                                                         │    │
│  │   │  STRUGGLING   │  accuracy < 60% (after 3+ attempts)                     │    │
│  │   │  (Needs help) │                                                         │    │
│  │   └───────────────┘                                                         │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```


---

## 8. Quiz Generation Modes

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              QUIZ GENERATION STRATEGIES                              │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  MODE 1: ADAPTIVE                                                            │    │
│  │  ─────────────────                                                           │    │
│  │  Goal: Converge to 70-75% accuracy                                           │    │
│  │                                                                              │    │
│  │  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                    │    │
│  │  │ User doing  │     │ User in     │     │ User        │                    │    │
│  │  │ too well    │     │ target      │     │ struggling  │                    │    │
│  │  │ (>75%)      │     │ range       │     │ (<70%)      │                    │    │
│  │  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘                    │    │
│  │         │                   │                   │                           │    │
│  │         ▼                   ▼                   ▼                           │    │
│  │    More HARD           MIXED              More EASY                         │    │
│  │    questions           difficulty         questions                         │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  MODE 2: SPACED_REVIEW                                                       │    │
│  │  ─────────────────────                                                       │    │
│  │  Goal: Review questions based on SM-2 due dates                              │    │
│  │                                                                              │    │
│  │  Priority Order:                                                             │    │
│  │  1. Overdue questions (highest priority)                                     │    │
│  │  2. Due today                                                                │    │
│  │  3. New questions (never seen)                                               │    │
│  │  4. Random from reviewed pool                                                │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  MODE 3: TOPIC_FOCUSED                                                       │    │
│  │  ─────────────────────                                                       │    │
│  │  Goal: Well-rounded mastery of a specific topic                              │    │
│  │                                                                              │    │
│  │  Distribution:                                                               │    │
│  │  ┌────────────────────────────────────────────────────────┐                 │    │
│  │  │  30% WEAK      │  40% MEDIUM     │  30% ADVANCED      │                 │    │
│  │  │  (struggling)  │  (reviewing)    │  (new/hard)        │                 │    │
│  │  └────────────────────────────────────────────────────────┘                 │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  MODE 4: WEAK_AREA                                                           │    │
│  │  ─────────────────                                                           │    │
│  │  Goal: Auto-detect and target struggling topics                              │    │
│  │                                                                              │    │
│  │  Algorithm:                                                                  │    │
│  │  1. Calculate accuracy per topic                                             │    │
│  │  2. Identify topics with <60% accuracy                                       │    │
│  │  3. Prioritize questions from weak topics                                    │    │
│  │  4. Focus on previously wrong answers                                        │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  MODE 5: EXAM_PREP                                                           │    │
│  │  ───────────────                                                             │    │
│  │  Goal: Progressive difficulty (simulates real exam)                          │    │
│  │                                                                              │    │
│  │  Question Order (NOT shuffled):                                              │    │
│  │  ┌────────────────────────────────────────────────────────┐                 │    │
│  │  │  30% EASY      │  40% MEDIUM     │  30% HARD          │                 │    │
│  │  │  (warm up)     │  (build up)     │  (challenge)       │                 │    │
│  │  └────────────────────────────────────────────────────────┘                 │    │
│  │                                                                              │    │
│  │  Time Pressure: 60s/easy, 90s/medium, 120s/hard                             │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  MODE 6: RANDOM                                                              │    │
│  │  ────────────────                                                            │    │
│  │  Goal: Simple random selection (no intelligence)                             │    │
│  │                                                                              │    │
│  │  Use case: Casual practice, exploration                                      │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```


---

## 9. Data Flow Diagrams

### 9.1 Quiz Generation Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              QUIZ GENERATION FLOW                                    │
│                                                                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │  User    │    │ Frontend │    │   API    │    │  Lambda  │    │ DynamoDB │      │
│  │          │    │          │    │ Gateway  │    │          │    │          │      │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘      │
│       │               │               │               │               │             │
│       │ Select Mode   │               │               │               │             │
│       │──────────────►│               │               │               │             │
│       │               │               │               │               │             │
│       │               │ POST /quiz/   │               │               │             │
│       │               │ generate      │               │               │             │
│       │               │──────────────►│               │               │             │
│       │               │               │               │               │             │
│       │               │               │ Validate JWT  │               │             │
│       │               │               │──────────────►│               │             │
│       │               │               │               │               │             │
│       │               │               │               │ Query Progress│             │
│       │               │               │               │──────────────►│             │
│       │               │               │               │               │             │
│       │               │               │               │◄──────────────│             │
│       │               │               │               │ User Progress │             │
│       │               │               │               │               │             │
│       │               │               │               │ Query Custom  │             │
│       │               │               │               │ Questions     │             │
│       │               │               │               │──────────────►│             │
│       │               │               │               │               │             │
│       │               │               │            


### 9.1 Quiz Generation Flow (Sequence)

```
User          Frontend         API Gateway      Lambda           DynamoDB
 │               │                  │              │                 │
 │ Select Mode   │                  │              │                 │
 │──────────────►│                  │              │                 │
 │               │ POST /quiz/gen   │              │                 │
 │               │─────────────────►│              │                 │
 │               │                  │ Validate JWT │                 │
 │               │                  │─────────────►│                 │
 │               │                  │              │ Query Progress  │
 │               │                  │              │────────────────►│
 │               │                  │              │◄────────────────│
 │               │                  │              │                 │
 │               │                  │              │ Apply SM-2      │
 │               │                  │              │ Algorithm       │
 │               │                  │              │                 │
 │               │                  │              │ Create Session  │
 │               │                  │              │────────────────►│
 │               │                  │              │                 │
 │               │◄─────────────────│◄─────────────│                 │
 │               │ {sessionId, questions, metadata}                  │
 │◄──────────────│                  │              │                 │
 │ Display Quiz  │                  │              │                 │
```

### 9.2 Answer Submission Flow

```
User          Frontend         API Gateway      Lambda           DynamoDB
 │               │                  │              │                 │
 │ Submit Answer │                  │              │                 │
 │──────────────►│                  │              │                 │
 │               │ POST /quiz/submit│              │                 │
 │               │─────────────────►│              │                 │
 │               │                  │─────────────►│                 │
 │               │                  │              │ Get Progress    │
 │               │                  │              │────────────────►│
 │               │                  │              │◄────────────────│
 │               │                  │              │                 │
 │               │                  │              │ Calculate SM-2  │
 │               │                  │              │ Update          │
 │               │                  │              │                 │
 │               │                  │              │ Save Progress   │
 │               │                  │              │────────────────►│
 │               │                  │              │                 │
 │               │                  │              │ Save Attempt    │
 │               │                  │              │────────────────►│
 │               │                  │              │                 │
 │               │                  │              │ Update Session  │
 │               │                  │              │────────────────►│
 │               │                  │              │                 │
 │               │◄─────────────────│◄─────────────│                 │
 │               │ {isCorrect, nextReview, explanation}              │
 │◄──────────────│                  │              │                 │
 │ Show Result   │                  │              │                 │
```


---

## 10. Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              SECURITY LAYERS                                         │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 1: EDGE SECURITY (CloudFront)                                         │    │
│  │  • HTTPS enforcement (TLS 1.2+)                                              │    │
│  │  • DDoS protection (AWS Shield Standard)                                     │    │
│  │  • Geographic restrictions (optional)                                        │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                        │                                             │
│                                        ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 2: AUTHENTICATION (Cognito)                                           │    │
│  │  • Email-based sign up with verification                                     │    │
│  │  • Password policy: 8+ chars, upper, lower, digit                           │    │
│  │  • JWT tokens (ID, Access, Refresh)                                          │    │
│  │  • Token expiration: 1 hour (configurable)                                   │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                        │                                             │
│                                        ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 3: AUTHORIZATION (API Gateway)                                        │    │
│  │  • Cognito Authorizer validates JWT on every request                         │    │
│  │  • User ID extracted from token claims                                       │    │
│  │  • CORS configured for allowed origins                                       │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                        │                                             │
│                                        ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 4: DATA ISOLATION (Lambda + DynamoDB)                                 │    │
│  │  • All queries filtered by userId from JWT                                   │    │
│  │  • No cross-user data access possible                                        │    │
│  │  • IAM roles with least-privilege access                                     │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  TOKEN FLOW                                                                  │    │
│  │                                                                              │    │
│  │  ┌─────────┐  Sign In   ┌─────────┐  Tokens   ┌─────────┐                   │    │
│  │  │  User   │───────────►│ Cognito │──────────►│ Browser │                   │    │
│  │  └─────────┘            └─────────┘           │ Storage │                   │    │
│  │                                               └────┬────┘                   │    │
│  │                                                    │                        │    │
│  │  ┌─────────┐  Validate  ┌─────────┐  Request  ────┘                        │    │
│  │  │   API   │◄───────────│ Gateway │◄──────────                              │    │
│  │  │ Gateway │            │  Auth   │  + JWT                                  │    │
│  │  └─────────┘            └─────────┘                                         │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```


---

## 11. Scalability & Performance

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              SCALABILITY CHARACTERISTICS                             │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  COMPONENT          │  SCALING MODEL       │  LIMITS                        │    │
│  ├─────────────────────┼──────────────────────┼────────────────────────────────┤    │
│  │  CloudFront         │  Global edge network │  100,000+ RPS                  │    │
│  │  API Gateway        │  Auto-scaling        │  10,000 RPS (soft limit)       │    │
│  │  Lambda             │  Concurrent exec     │  1,000 concurrent (default)    │    │
│  │  DynamoDB           │  On-demand capacity  │  Unlimited (pay per request)   │    │
│  │  Cognito            │  Managed service     │  Millions of users             │    │
│  └─────────────────────┴──────────────────────┴────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  PERFORMANCE OPTIMIZATIONS                                                   │    │
│  │                                                                              │    │
│  │  Frontend:                                                                   │    │
│  │  • CloudFront caching (static assets)                                        │    │
│  │  • Service Worker for offline support                                        │    │
│  │  • Code splitting (React lazy loading)                                       │    │
│  │  • Minified bundles (esbuild)                                               │    │
│  │                                                                              │    │
│  │  Backend:                                                                    │    │
│  │  • Lambda bundling with minification                                         │    │
│  │  • DynamoDB single-table design patterns                                     │    │
│  │  • GSIs for efficient queries                                                │    │
│  │  • Connection reuse (DynamoDB client singleton)                              │    │
│  │                                                                              │    │
│  │  Data:                                                                       │    │
│  │  • TTL on Attempts (90 days) and Sessions (7 days)                          │    │
│  │  • Denormalized data for read optimization                                   │    │
│  │  • Efficient key design (userId as PK)                                       │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  COLD START MITIGATION                                                       │    │
│  │                                                                              │    │
│  │  • Node.js 20.x runtime (fast startup)                                       │    │
│  │  • Small bundle sizes (esbuild minification)                                 │    │
│  │  • Shared module lazy loading                                                │    │
│  │  • Memory allocation: 256-512MB (balance cost/performance)                   │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```


---

## 12. API Endpoint Summary

| Endpoint | Method | Lambda | Purpose |
|----------|--------|--------|---------|
| `/topics` | GET | getTopics | Return topic hierarchy |
| `/quiz/generate` | POST | generateQuiz | Create quiz session |
| `/quiz/submit` | POST | submitAnswer | Submit answer, update SM-2 |
| `/progress` | GET | getProgress | User's SM-2 progress |
| `/stats` | GET | getStats | Aggregated statistics |
| `/analytics` | GET | getAnalytics | Comprehensive dashboard |
| `/attempts` | GET | getAttempts | Attempt history |
| `/sessions` | GET | getSessions | Quiz session history |
| `/questions` | GET/POST | manageQuestions | List/create custom questions |
| `/questions/{id}` | PUT/DELETE | manageQuestions | Update/delete custom question |
| `/hidden-questions` | GET/POST | hideQuestion | List/hide questions |
| `/hidden-questions/{id}` | DELETE | hideQuestion | Unhide question |
| `/notes` | GET/POST | getNotes/saveNote | List/create notes |
| `/notes/{id}` | DELETE | deleteNote | Delete note |

---

## 13. Question Content Structure

```
questions/
├── API Fundamentals/
│   ├── APIGateway.json
│   ├── GraphQL.json
│   ├── OAuth.json
│   └── ... (10 subtopics)
├── Architectural Patterns/
│   ├── Microservices.json
│   ├── EventDriven.json
│   └── ... (8 subtopics)
├── Core Concepts/
│   ├── CAPTheorem.json
│   ├── Scalability.json
│   └── ... (8 subtopics)
├── Databases/
│   ├── Sharding.json
│   ├── SQLvsNoSQL.json
│   └── ... (12 subtopics)
├── Distributed Systems/
│   ├── ConsensusAlgorithms.json
│   ├── MessageQueues.json
│   └── ... (13 subtopics)
└── ... (15+ topic categories)

Total: 500+ questions across 100+ subtopics
```

---

## 14. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              DEPLOYMENT PIPELINE                                     │
│                                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   Source    │    │    Build    │    │   Deploy    │    │  Validate   │          │
│  │   Code      │───►│   Process   │───►│   to AWS    │───►│   & Cache   │          │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘          │
│                                                                                      │
│  Infrastructure (CDK):                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  npm install → cdk synth → cdk deploy                                        │    │
│  │  • Creates/updates all AWS resources                                         │    │
│  │  • Lambda code bundled with esbuild                                          │    │
│  │  • DynamoDB tables with GSIs                                                 │    │
│  │  • API Gateway with Cognito authorizer                                       │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  Frontend:                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  npm run build → aws s3 sync → cloudfront invalidation                       │    │
│  │  • React build with optimizations                                            │    │
│  │  • Upload to S3 bucket                                                       │    │
│  │  • Invalidate CloudFront cache                                               │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 15. Cost Model (Estimated)

| Service | Usage Pattern | Est. Monthly Cost |
|---------|---------------|-------------------|
| Lambda | ~100K invocations | $0.20 |
| DynamoDB | On-demand, ~1GB storage | $2-5 |
| API Gateway | ~100K requests | $0.35 |
| CloudFront | ~10GB transfer | $0.85 |
| S3 | ~100MB storage | $0.02 |
| Cognito | <50K MAU | Free tier |
| **Total** | Moderate usage | **~$5-15/month** |

---

## 16. Future Enhancements

1. **Multi-language Support** - i18n for questions and UI
2. **Social Features** - Leaderboards, study groups
3. **AI Question Generation** - Generate questions from notes
4. **Mobile Apps** - Native iOS/Android with offline sync
5. **Admin Dashboard** - Content management, analytics
6. **Gamification** - Badges, achievements, XP system
7. **Spaced Repetition Tuning** - ML-based interval optimization

---

## 17. Related Documentation

- [Architecture Overview](./ARCHITECTURE.md) - Component details
- [Data Model](./DATA-MODEL.md) - DynamoDB schema
- [API Reference](./API-REFERENCE.md) - Endpoint documentation
- [SM-2 Algorithm](./SM2-ALGORITHM.md) - Spaced repetition details
- [Deployment Guide](./DEPLOYMENT.md) - Deployment instructions
- [Frontend Guide](./FRONTEND.md) - React component documentation
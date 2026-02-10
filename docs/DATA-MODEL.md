# Data Model

## DynamoDB Tables

### 1. RecallrProgress

Stores SM-2 spaced repetition state for each user-question pair.

**Keys:**
- Partition Key: `userId` (String)
- Sort Key: `questionId` (String)

**Attributes:**
```typescript
{
  userId: string;
  questionId: string;
  topic: string;
  subtopic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  
  // SM-2 Core
  easinessFactor: number;      // 1.3 - 2.5
  interval: number;            // Days
  repetitions: number;         // Consecutive correct
  nextReviewDate: string;      // ISO date (YYYY-MM-DD)
  
  // Statistics
  totalAttempts: number;
  correctAttempts: number;
  lastAttemptDate: string;     // ISO timestamp
  consecutiveCorrect: number;
  consecutiveWrong: number;
  
  // Performance Metrics
  averageResponseTimeMs: number;
  averageConfidenceRating: number;
  confidenceRatingsCount: number;
  
  // Classification
  userStatus: 'new' | 'learning' | 'reviewing' | 'mastered' | 'struggling';
}
```

**Global Secondary Indexes:**

| Index | PK | SK | Purpose |
|-------|----|----|---------|
| ReviewDateIndex | userId | nextReviewDate | Find due questions |
| TopicIndex | userId | topic | Filter by topic |
| StatusIndex | userId | userStatus | Filter by mastery status |

---

### 2. RecallrAttempts

Records every quiz attempt for history and analytics.

**Keys:**
- Partition Key: `userId` (String)
- Sort Key: `attemptId` (String) - Format: `{timestamp}_{uuid}`

**Attributes:**
```typescript
{
  userId: string;
  attemptId: string;
  questionId: string;
  sessionId: string;
  
  // Question Context
  topic: string;
  subtopic: string;
  difficulty: string;
  quizType: string;
  
  // Response
  selectedAnswers: string[];
  correctAnswers: string[];
  isCorrect: boolean;
  confidenceRating: number;    // 0-5
  responseTimeMs: number;
  
  // Timestamps
  attemptedAt: string;         // ISO timestamp
  ttl: number;                 // Unix timestamp (90 days retention)
}
```

**Global Secondary Indexes:**

| Index | PK | SK | Purpose |
|-------|----|----|---------|
| QuestionIndex | questionId | attemptedAt | Get attempts for specific question |

---

### 3. RecallrSessions

Tracks quiz sessions for analytics and resumption.

**Keys:**
- Partition Key: `userId` (String)
- Sort Key: `sessionId` (String) - UUID

**Attributes:**
```typescript
{
  userId: string;
  sessionId: string;
  
  // Configuration
  quizType: string;
  topic?: string;
  subtopic?: string;
  totalQuestions: number;
  
  // Progress
  questionsAnswered: number;
  correctAnswers: number;
  questionIds: string[];
  
  // Timing
  startedAt: string;
  completedAt?: string;
  totalTimeMs?: number;
  
  ttl: number;                 // Unix timestamp (30 days retention)
}
```

---

### 4. RecallrNotes

User-created study notes with quiz integration.

**Keys:**
- Partition Key: `userId` (String)
- Sort Key: `noteId` (String) - UUID

**Attributes:**
```typescript
{
  userId: string;
  noteId: string;
  
  title: string;
  content: string;             // Markdown supported
  color: string;               // Hex color code
  
  // Flags
  pinned: boolean;
  quizMe: boolean;             // Include in note-based quizzes
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

---

### 5. RecallrCustomQuestions

User-created custom questions that integrate with the quiz system.

**Keys:**
- Partition Key: `userId` (String)
- Sort Key: `questionId` (String) - Format: `custom_{userId_prefix}_{uuid}`

**Attributes:**
```typescript
{
  userId: string;
  questionId: string;
  
  // Question Content
  topic: string;
  subtopic: string;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
    [key: string]: string;     // Supports more options
  };
  correct_answers: string[];   // Array for multi-select
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  
  // Metadata
  isCustom: true;              // Always true for this table
  createdAt: string;
  updatedAt: string;
}
```

**Global Secondary Indexes:**

| Index | PK | SK | Purpose |
|-------|----|----|---------|
| TopicIndex | userId | topic | Filter custom questions by topic |

---

## Static Question Data

Questions are stored as JSON files in `/questions/{topic}/{subtopic}.json`:

```typescript
{
  "topic": "Core Concepts",
  "subtopic": "CAP Theorem",
  "questions": [
    {
      "id": "cap_001",
      "question": "What does CAP stand for?",
      "options": {
        "A": "Consistency, Availability, Partition tolerance",
        "B": "Cache, API, Protocol",
        "C": "Compute, Access, Performance",
        "D": "Cluster, Async, Parallel"
      },
      "correct_answers": ["A"],
      "explanation": "CAP theorem states that...",
      "difficulty": "easy"
    }
  ]
}
```

**Topics Available:**
- Core Concepts (8 subtopics)
- Databases (12 subtopics)
- Distributed Systems (13 subtopics)
- Caching (7 subtopics)
- Load Balancing (4 subtopics)
- Microservices Patterns (8 subtopics)
- Communication Patterns (10 subtopics)
- API Fundamentals (10 subtopics)
- And more...

---

## Access Patterns

| Pattern | Table | Index | Query |
|---------|-------|-------|-------|
| Get user's due questions | Progress | ReviewDateIndex | userId = X, nextReviewDate <= today |
| Get questions by topic | Progress | TopicIndex | userId = X, topic = Y |
| Get struggling questions | Progress | StatusIndex | userId = X, userStatus = 'struggling' |
| Get recent attempts | Attempts | - | userId = X, ScanIndexForward = false |
| Get attempts for question | Attempts | QuestionIndex | questionId = X |
| Get user's sessions | Sessions | - | userId = X |
| Get user's notes | Notes | - | userId = X |
| Get custom questions | CustomQuestions | - | userId = X |
| Get custom by topic | CustomQuestions | TopicIndex | userId = X, topic = Y |

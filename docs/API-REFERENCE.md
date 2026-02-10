# API Reference

**Base URL:** `https://fwge4gqlr7.execute-api.us-east-1.amazonaws.com/prod`

**Authentication:** All endpoints require Cognito JWT token in `Authorization` header.

---

## Quiz Endpoints

### Generate Quiz
Creates a new quiz session with selected questions.

```
POST /quiz/generate
```

**Request:**
```json
{
  "quizType": "adaptive",
  "count": 10,
  "topic": "Databases",
  "subtopic": "Sharding"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| quizType | string | Yes | One of: `adaptive`, `spaced_review`, `topic_focused`, `weak_area`, `exam_prep`, `random` |
| count | number | No | Number of questions (default: 10, max: 50) |
| topic | string | No | Filter by topic |
| subtopic | string | No | Filter by subtopic (requires topic) |

**Response:**
```json
{
  "sessionId": "uuid-here",
  "questions": [
    {
      "id": "cap_001",
      "topic": "Core Concepts",
      "subtopic": "CAP Theorem",
      "question": "What does CAP stand for?",
      "options": {
        "A": "Consistency, Availability, Partition tolerance",
        "B": "Cache, API, Protocol"
      },
      "correct_answers": ["A"],
      "explanation": "CAP theorem states...",
      "difficulty": "easy"
    }
  ],
  "metadata": {
    "totalAvailable": 150,
    "newCount": 3,
    "reviewCount": 7,
    "overdueCount": 2
  }
}
```

---

### Submit Answer
Records an answer and updates SM-2 state.

```
POST /quiz/submit
```

**Request:**
```json
{
  "sessionId": "uuid-here",
  "questionId": "cap_001",
  "selectedAnswers": ["A"],
  "confidenceRating": 4,
  "responseTimeMs": 8500
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sessionId | string | Yes | From generateQuiz response |
| questionId | string | Yes | Question being answered |
| selectedAnswers | string[] | Yes | Selected option keys |
| confidenceRating | number | Yes | 0-5 confidence scale |
| responseTimeMs | number | Yes | Time taken in milliseconds |

**Response:**
```json
{
  "isCorrect": true,
  "correctAnswers": ["A"],
  "explanation": "CAP theorem states...",
  "progress": {
    "easinessFactor": 2.5,
    "interval": 6,
    "repetitions": 2,
    "nextReviewDate": "2026-02-16",
    "userStatus": "reviewing"
  },
  "sessionStats": {
    "answered": 5,
    "correct": 4,
    "remaining": 5
  }
}
```

---

## Progress Endpoints

### Get Progress
Returns user's SM-2 progress for all questions.

```
GET /progress
```

**Response:**
```json
{
  "progress": {
    "cap_001": {
      "easinessFactor": 2.5,
      "interval": 6,
      "repetitions": 2,
      "nextReviewDate": "2026-02-16",
      "totalAttempts": 5,
      "correctAttempts": 4,
      "userStatus": "reviewing"
    }
  },
  "stats": {
    "totalAnswered": 150,
    "totalCorrect": 120,
    "masteredCount": 45,
    "reviewingCount": 80,
    "strugglingCount": 10,
    "overdueCount": 5,
    "dueToday": 12
  },
  "dueForReview": {
    "overdue": ["q1", "q2"],
    "dueToday": ["q3", "q4"],
    "dueTomorrow": ["q5"]
  }
}
```

---

### Get Stats
Returns aggregated statistics.

```
GET /stats
```

**Response:**
```json
{
  "totalAnswered": 150,
  "totalCorrect": 120,
  "totalWrong": 30,
  "totalKnown": 45,
  "totalRemind": 80,
  "masteredCount": 45,
  "reviewingCount": 80,
  "learningCount": 15,
  "strugglingCount": 10,
  "overdueCount": 5,
  "dueToday": 12,
  "currentDailyStreak": 7,
  "longestStreak": 14,
  "topicStats": {
    "Databases": {
      "total": 50,
      "mastered": 20,
      "accuracy": 85
    }
  }
}
```

---

## Analytics Endpoints

### Get Analytics
Comprehensive analytics dashboard data.

```
GET /analytics
```

**Response:**
```json
{
  "overview": {
    "totalQuestions": 500,
    "totalAttempts": 1200,
    "totalCorrect": 960,
    "overallAccuracy": 80,
    "totalStudyTimeMs": 3600000,
    "avgConfidence": 3.8,
    "currentStreak": 7,
    "longestStreak": 14
  },
  "statusCounts": {
    "learning": 50,
    "reviewing": 200,
    "mastered": 180,
    "struggling": 20,
    "new": 50
  },
  "dueForReview": {
    "overdue": 5,
    "dueToday": 12,
    "dueThisWeek": 45
  },
  "topicAnalytics": [
    {
      "topic": "Databases",
      "totalQuestions": 80,
      "attempted": 60,
      "mastered": 30,
      "struggling": 5,
      "accuracy": 85,
      "avgConfidence": 4.1,
      "lastStudied": "2026-02-10T10:30:00Z"
    }
  ],
  "dailyActivity": [
    {
      "date": "2026-02-10",
      "attempts": 25,
      "correct": 20,
      "timeSpentMs": 1800000
    }
  ],
  "recentSessions": [
    {
      "sessionId": "uuid",
      "quizType": "adaptive",
      "topic": "Databases",
      "questionsAnswered": 10,
      "correctAnswers": 8,
      "startedAt": "2026-02-10T10:00:00Z"
    }
  ]
}
```

---

### Get Attempts
Returns attempt history.

```
GET /attempts?limit=50&questionId=cap_001
```

| Param | Type | Description |
|-------|------|-------------|
| limit | number | Max results (default: 50, max: 100) |
| questionId | string | Filter by specific question |

**Response:**
```json
{
  "attempts": [
    {
      "attemptId": "2026-02-10T10:30:00Z_uuid",
      "questionId": "cap_001",
      "topic": "Core Concepts",
      "subtopic": "CAP Theorem",
      "difficulty": "easy",
      "isCorrect": true,
      "confidenceRating": 4,
      "responseTimeMs": 8500,
      "selectedAnswers": ["A"],
      "correctAnswers": ["A"],
      "quizType": "adaptive",
      "attemptedAt": "2026-02-10T10:30:00Z"
    }
  ],
  "count": 50,
  "hasMore": true
}
```

---

### Get Sessions
Returns quiz session history.

```
GET /sessions?limit=20
```

**Response:**
```json
{
  "sessions": [
    {
      "sessionId": "uuid",
      "quizType": "adaptive",
      "topic": "Databases",
      "subtopic": null,
      "totalQuestions": 10,
      "questionsAnswered": 10,
      "correctAnswers": 8,
      "accuracy": 80,
      "startedAt": "2026-02-10T10:00:00Z",
      "completedAt": "2026-02-10T10:15:00Z",
      "totalTimeMs": 900000
    }
  ],
  "count": 20,
  "hasMore": false
}
```

---

## Custom Questions Endpoints

### List Custom Questions
```
GET /questions?topic=Databases
```

**Response:**
```json
{
  "questions": [
    {
      "questionId": "custom_abc123_xyz789",
      "topic": "Databases",
      "subtopic": "Custom Topic",
      "question": "My custom question?",
      "options": { "A": "...", "B": "..." },
      "correct_answers": ["A"],
      "explanation": "...",
      "difficulty": "medium",
      "isCustom": true,
      "createdAt": "2026-02-10T10:00:00Z",
      "updatedAt": "2026-02-10T10:00:00Z"
    }
  ],
  "count": 5
}
```

---

### Create Question
```
POST /questions
```

**Request:**
```json
{
  "topic": "Databases",
  "subtopic": "Custom Topic",
  "question": "What is the answer?",
  "options": {
    "A": "Option A",
    "B": "Option B",
    "C": "Option C",
    "D": "Option D"
  },
  "correct_answers": ["A"],
  "explanation": "Because...",
  "difficulty": "medium"
}
```

---

### Update Question
```
PUT /questions/{questionId}
```

**Request:** Same as create, all fields optional.

---

### Delete Question
```
DELETE /questions/{questionId}
```

**Response:**
```json
{
  "message": "Question deleted successfully"
}
```

---

## Notes Endpoints

### List Notes
```
GET /notes?pinned=true&quizMe=true
```

### Create/Update Note
```
POST /notes
```

**Request:**
```json
{
  "noteId": "uuid (optional for update)",
  "title": "My Note",
  "content": "Note content in markdown",
  "color": "#FFE4B5",
  "pinned": true,
  "quizMe": false
}
```

### Delete Note
```
DELETE /notes/{noteId}
```

---

## Topics Endpoint

### Get Topics
Returns the topic hierarchy.

```
GET /topics
```

**Response:**
```json
{
  "topics": {
    "Core Concepts": [
      "Scalability",
      "Availability",
      "CAP Theorem",
      "Consistency Models"
    ],
    "Databases": [
      "SQL vs NoSQL",
      "Sharding",
      "Replication"
    ]
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message here",
  "code": "ERROR_CODE"
}
```

| Status | Code | Description |
|--------|------|-------------|
| 400 | BAD_REQUEST | Invalid request parameters |
| 401 | UNAUTHORIZED | Missing or invalid token |
| 403 | FORBIDDEN | Access denied |
| 404 | NOT_FOUND | Resource not found |
| 500 | INTERNAL_ERROR | Server error |

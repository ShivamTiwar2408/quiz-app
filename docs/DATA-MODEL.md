# Data Model

## Question Schema

Each question in the question bank follows this structure:

```json
{
  "id": "q001",
  "question": "Which scaling technique involves increasing the capacity of a single machine?",
  "options": {
    "A": "Horizontal Scaling",
    "B": "Replication",
    "C": "Sharding",
    "D": "Vertical Scaling"
  },
  "correct_answers": ["D"],
  "explanation": "Vertical scaling (scale-up) improves capacity by upgrading a single node.",
  "difficulty": "easy",
  "category": "scalability"
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier (q001, q002, etc.) |
| question | string | The question text |
| options | object | Key-value pairs of answer choices (A, B, C, D) |
| correct_answers | string[] | Array of correct option keys |
| explanation | string | Explanation shown after answering |
| difficulty | string | "easy", "medium", or "hard" |
| category | string | Topic category for filtering |

### Multi-Select Questions

Questions with multiple correct answers have multiple items in `correct_answers`:

```json
{
  "id": "q004",
  "question": "Which two dimensions are traded off in CAP theorem?",
  "options": {
    "A": "Consistency",
    "B": "Availability",
    "C": "Latency",
    "D": "Durability"
  },
  "correct_answers": ["A", "B"],
  "explanation": "CAP states you must choose between consistency and availability."
}
```

## User Progress Schema (DynamoDB)

```
Table: QuizUserProgress
├── userId (Partition Key)
│   └── questionId (Sort Key)
│       ├── status: "remind" | "known"
│       ├── answeredCorrectly: boolean
│       └── timestamp: ISO string
```

### Example Records

```json
// User marked question as "I know this"
{
  "userId": "user_abc123xyz",
  "questionId": "q001",
  "status": "known",
  "answeredCorrectly": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}

// User marked question for review
{
  "userId": "user_abc123xyz",
  "questionId": "q005",
  "status": "remind",
  "answeredCorrectly": false,
  "timestamp": "2024-01-15T10:32:00.000Z"
}
```

### Access Patterns

| Pattern | Query |
|---------|-------|
| Get all progress for user | `PK = userId` |
| Get specific question progress | `PK = userId, SK = questionId` |
| Update progress | `PutItem` with userId + questionId |

## Question Categories

The question bank covers these system design topics:

- scalability
- data distribution
- distributed systems
- consistency
- performance
- availability
- reliability
- databases
- observability
- api design
- caching

## Question Statistics

- Total questions: 30
- Easy: ~10
- Medium: ~15
- Hard: ~5
- Multi-select: ~10

# Lambda Functions - Business Logic

## 1. getQuestions Lambda

**Endpoint**: `GET /questions`

**Purpose**: Returns a random selection of quiz questions from the question bank.

### Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| count | number | 10 | Number of questions to return |
| category | string | - | Filter by category (e.g., "databases", "distributed systems") |
| difficulty | string | - | Filter by difficulty ("easy", "medium", "hard") |

### Business Logic

```javascript
// 1. Load questions from bundled JSON file
const questions = require('./questions.json');

// 2. Apply optional filters
if (category) {
  filteredQuestions = filteredQuestions.filter(q => 
    q.category.toLowerCase() === category.toLowerCase()
  );
}
if (difficulty) {
  filteredQuestions = filteredQuestions.filter(q => 
    q.difficulty.toLowerCase() === difficulty.toLowerCase()
  );
}

// 3. Shuffle using Fisher-Yates algorithm
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 4. Return requested count
const selected = shuffled.slice(0, Math.min(count, shuffled.length));
```

### Response Format

```json
{
  "questions": [
    {
      "id": "q001",
      "question": "Which scaling technique...",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correct_answers": ["D"],
      "explanation": "Vertical scaling...",
      "difficulty": "easy",
      "category": "scalability"
    }
  ],
  "total": 30,
  "returned": 10
}
```

---

## 2. getProgress Lambda

**Endpoint**: `GET /progress`

**Purpose**: Retrieves user's learning progress for all questions they've interacted with.

### Request Headers

| Header | Description |
|--------|-------------|
| X-User-Id | Unique user identifier (auto-generated on frontend if not provided) |

### Business Logic

```javascript
// 1. Extract user ID from headers (defaults to 'anonymous')
const userId = event.headers['x-user-id'] || 'anonymous';

// 2. Query DynamoDB for all progress records for this user
const result = await docClient.send(new QueryCommand({
  TableName: TABLE_NAME,
  KeyConditionExpression: 'userId = :userId',
  ExpressionAttributeValues: {
    ':userId': userId,
  },
}));

// 3. Transform to key-value map for easy frontend lookup
const progress = {};
for (const item of result.Items || []) {
  progress[item.questionId] = {
    questionId: item.questionId,
    status: item.status,           // 'remind' or 'known'
    answeredCorrectly: item.answeredCorrectly,
  };
}
```

### Response Format

```json
{
  "progress": {
    "q001": {
      "questionId": "q001",
      "status": "known",
      "answeredCorrectly": true
    },
    "q005": {
      "questionId": "q005",
      "status": "remind",
      "answeredCorrectly": false
    }
  }
}
```

---

## 3. saveProgress Lambda

**Endpoint**: `POST /progress`

**Purpose**: Saves user's learning status for a question (mark as "remind me later" or "I know this").

### Request Headers

| Header | Description |
|--------|-------------|
| X-User-Id | Unique user identifier |

### Request Body

**Single item:**
```json
{
  "questionId": "q001",
  "status": "known",
  "answeredCorrectly": true
}
```

**Batch (multiple items):**
```json
{
  "progress": [
    { "questionId": "q001", "status": "known", "answeredCorrectly": true },
    { "questionId": "q002", "status": "remind", "answeredCorrectly": false }
  ]
}
```

### Business Logic

```javascript
// 1. Extract user ID
const userId = event.headers['x-user-id'] || 'anonymous';
const body = JSON.parse(event.body);

// 2. Handle batch vs single save
if (Array.isArray(body.progress)) {
  // Batch save - DynamoDB limit is 25 items per batch
  const items = body.progress.map(item => ({
    PutRequest: {
      Item: {
        userId,
        questionId: item.questionId,
        status: item.status,
        answeredCorrectly: item.answeredCorrectly,
        timestamp: new Date().toISOString(),
      },
    },
  }));

  // Split into batches of 25
  for (const batch of batches) {
    await docClient.send(new BatchWriteCommand({
      RequestItems: { [TABLE_NAME]: batch },
    }));
  }
} else {
  // Single item save
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      userId,
      questionId: body.questionId,
      status: body.status,
      answeredCorrectly: body.answeredCorrectly,
      timestamp: new Date().toISOString(),
    },
  }));
}
```

### DynamoDB Table Schema

**Table Name**: `QuizUserProgress`

| Attribute | Type | Key |
|-----------|------|-----|
| userId | String | Partition Key (PK) |
| questionId | String | Sort Key (SK) |
| status | String | "remind" or "known" |
| answeredCorrectly | Boolean | Whether user got it right |
| remindCount | Number | Times user marked as "remind me" |
| knownCount | Number | Times user marked as "I know this" |
| timestamp | String | ISO timestamp of last update |

### Response Format

```json
{
  "message": "Progress saved",
  "count": 1  // Only for batch saves
}
```

---

## Error Handling

All Lambda functions return consistent error responses:

```json
{
  "statusCode": 500,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  },
  "body": "{\"error\": \"Failed to [operation]\"}"
}
```

## CORS Configuration

All responses include CORS headers to allow frontend access:

```javascript
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-User-Id',
};
```

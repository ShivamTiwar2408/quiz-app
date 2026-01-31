# Frontend Implementation

## Tech Stack

- React 18 with TypeScript
- CSS (custom dark theme)
- No external UI libraries

## Application Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Home Screen │────▶│  Quiz Screen │────▶│   Results    │
│              │     │              │     │    Screen    │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │                    │                    │
       ▼                    ▼                    ▼
  Load Progress       Answer Questions      Show Score
  Show Stats          Mark Progress         Try Again
  Select Mode         Show Explanation
```

## Quiz Modes

| Mode | Description |
|------|-------------|
| Start Quiz | Random 10 questions from entire pool |
| Review Mode | Only questions marked as "Remind Me" |
| New Questions | Only questions user hasn't seen yet |

## State Management

```typescript
// Quiz state tracks current session
interface QuizState {
  currentQuestionIndex: number;  // Which question we're on (0-9)
  selectedAnswers: string[];     // User's current selection ["A", "B"]
  showResult: boolean;           // Whether answer has been submitted
  score: number;                 // Running score count
  answers: {                     // History of all answers
    questionId: string;
    selected: string[];
    correct: boolean;
  }[];
}

// User progress persists across sessions
interface UserProgress {
  questionId: string;
  status: 'remind' | 'known' | null;
  answeredCorrectly: boolean;
}
```

## API Integration (src/api.ts)

### User Identification

```typescript
// Generate unique user ID on first visit, persist in localStorage
function getUserId(): string {
  let userId = localStorage.getItem('quizUserId');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('quizUserId', userId);
  }
  return userId;
}
```

### Fallback Strategy

The frontend gracefully handles API unavailability:

```typescript
export async function fetchQuestions(count: number = 10): Promise<Question[]> {
  try {
    if (!API_BASE_URL) {
      // No API configured - use local questions.json
      const localQuestions = await import('./questions.json');
      return shuffleArray(localQuestions.default).slice(0, count);
    }
    
    const response = await fetch(`${API_BASE_URL}/questions?count=${count}`);
    return (await response.json()).questions;
  } catch (error) {
    // API failed - fallback to local questions
    const localQuestions = await import('./questions.json');
    return shuffleArray(localQuestions.default).slice(0, count);
  }
}
```

This allows the app to work:
1. Locally during development (no API)
2. When API is temporarily unavailable
3. Fully connected to backend in production

## Question Data Structure

```typescript
interface Question {
  id: string;                    // Unique identifier "q001"
  question: string;              // The question text
  options: Record<string, string>; // { "A": "...", "B": "...", ... }
  correct_answers: string[];     // ["A"] or ["A", "C"] for multi-select
  explanation: string;           // Shown after answering
  difficulty: string;            // "easy" | "medium" | "hard"
  category: string;              // Topic category
}
```

## Key Features

### Multi-Select Support

Questions can have multiple correct answers:

```typescript
const isMultiSelect = currentQuestion?.correct_answers.length > 1;

// Answer validation
const isCorrect = correct.length === selected.length && 
  correct.every(c => selected.includes(c));
```

### Progress Tracking

Users can mark questions for later review:

```typescript
const handleProgressMark = async (status: 'remind' | 'known') => {
  const progress = {
    questionId: currentQuestion.id,
    status,
    answeredCorrectly: quizState.answers[quizState.answers.length - 1]?.correct
  };
  
  // Update local state immediately
  setUserProgress(prev => ({ ...prev, [currentQuestion.id]: progress }));
  
  // Persist to backend
  await saveProgress(progress);
};
```

### Statistics Calculation

```typescript
const stats = {
  total: allQuestions.length,
  known: Object.values(userProgress).filter(p => p.status === 'known').length,
  remind: Object.values(userProgress).filter(p => p.status === 'remind').length,
};

// Progress percentage
const progressPercent = stats.total > 0 
  ? Math.round((stats.known / stats.total) * 100) 
  : 0;
```

## Environment Configuration

Set API URL via environment variable:

```bash
# .env
REACT_APP_API_URL=https://8c1p8cvsb2.execute-api.us-east-1.amazonaws.com/prod
```

For local development without API, leave this unset.

# Frontend Guide

## Tech Stack

- **React 18** with TypeScript
- **CSS** (no framework, custom styles)
- **PWA** with service worker
- **AWS Amplify Auth** for Cognito integration

## Project Structure

```
src/
├── App.tsx              # Main app component, routing
├── App.css              # Global styles
├── api.ts               # API client functions
├── auth.ts              # Cognito authentication
├── types.ts             # TypeScript interfaces
├── constants.ts         # App constants, quiz type info
├── components/
│   ├── index.ts         # Component exports
│   ├── AuthScreen.tsx   # Login/signup/confirm
│   ├── Header.tsx       # App header, quiz header
│   ├── Sidebar.tsx      # Navigation sidebar
│   ├── QuizQuestion.tsx # Question display + confidence
│   ├── NotesScreen.tsx  # Notes management
│   ├── AnalyticsScreen.tsx  # Analytics dashboard
│   └── QuestionManager.tsx  # Custom questions CRUD
└── hooks/
    ├── index.ts         # Hook exports
    ├── useAuth.ts       # Authentication state
    ├── useQuiz.ts       # Quiz state management
    ├── useUserData.ts   # Progress, stats, topics
    └── useNotes.ts      # Notes state
```

## Key Components

### App.tsx
Main application component handling:
- Screen routing (home, quiz, results, notes, analytics, questions)
- Quiz flow orchestration
- Global state coordination

**Screens:**
| Screen | Description |
|--------|-------------|
| `home` | Dashboard with quick actions, stats, due items |
| `quiz` | Active quiz with questions |
| `results` | Quiz completion summary |
| `notes` | Notes management |
| `analytics` | Progress analytics |
| `questions` | Custom question manager |

### QuizQuestion.tsx
Displays a single question with:
- Question text and options
- Multi-select support
- Answer validation
- Explanation display
- **Confidence rating slider (0-5)**

```tsx
interface QuizQuestionProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswers: string[];
  showResult: boolean;
  showExplanation: boolean;
  userProgress: Record<string, UserProgress>;
  onAnswerSelect: (key: string) => void;
  onProgressMark: (status: 'remind' | 'known') => void;
  onConfidenceSubmit: (rating: number) => void;
}
```

### AnalyticsScreen.tsx
Four-tab analytics dashboard:

| Tab | Content |
|-----|---------|
| Overview | Total stats, accuracy, streaks, due counts |
| Topics | Per-topic breakdown with mastery levels |
| History | Recent attempt history with details |
| Sessions | Past quiz session summaries |

### QuestionManager.tsx
CRUD interface for custom questions:
- List view with topic filtering
- Create form with validation
- Edit existing questions
- Delete with confirmation

## Custom Hooks

### useAuth
Manages Cognito authentication state.

```typescript
const {
  user,                    // Current user or null
  authLoading,             // Loading state
  authScreen,              // 'signin' | 'signup' | 'confirm'
  authError,               // Error message
  pendingEmail,            // Email awaiting confirmation
  handleSignUp,            // (email, password) => Promise
  handleSignIn,            // (email, password) => Promise
  handleConfirm,           // (code) => Promise
  handleSignOut,           // () => void
  setAuthScreen,           // (screen) => void
  clearError,              // () => void
} = useAuth();
```

### useQuiz
Manages quiz state and flow.

```typescript
const {
  questions,               // Current quiz questions
  currentQuestion,         // Active question
  quizState,               // { currentQuestionIndex, selectedAnswers, showResult, score }
  quizMetadata,            // { newCount, reviewCount, overdueCount }
  currentFilter,           // { topic?, subtopic? }
  loading,                 // Loading state
  showExplanation,         // Show explanation flag
  startQuiz,               // (mode, topic?, subtopic?) => Promise<boolean>
  handleAnswerSelect,      // (key) => void
  submitAnswer,            // () => Promise
  submitAnswerWithConfidence, // (rating) => Promise
  nextQuestion,            // () => boolean (returns true if quiz ended)
  handleProgressMark,      // (status, progress, setProgress) => void
  resetQuiz,               // () => void
} = useQuiz();
```

### useUserData
Manages user progress and statistics.

```typescript
const {
  topics,                  // Topic hierarchy
  userProgress,            // SM-2 progress by questionId
  userStats,               // Aggregated statistics
  wrongCount,              // Questions with status 'struggling'
  remindCount,             // Questions due for review
  loading,                 // Loading state
  setUserProgress,         // State setter
  resetUserData,           // () => void
} = useUserData(user);
```

### useNotes
Manages notes state.

```typescript
const {
  notes,                   // Array of notes
  loading,                 // Loading state
  createNote,              // (data) => Promise
  updateNote,              // (data) => Promise
  removeNote,              // (noteId) => Promise
  togglePin,               // (noteId) => Promise
} = useNotes(user);
```

## API Client (api.ts)

All API functions with automatic token refresh:

```typescript
// Quiz
generateQuiz(request: GenerateQuizRequest): Promise<GenerateQuizResponse>
submitAnswer(request: SubmitAnswerRequest): Promise<SubmitAnswerResponse>

// Progress
getProgress(): Promise<ProgressResponse>
getStats(): Promise<UserStats>

// Analytics
fetchAnalytics(): Promise<AnalyticsData>
fetchAttempts(limit?, questionId?): Promise<AttemptRecord[]>
fetchSessions(limit?): Promise<SessionRecord[]>

// Custom Questions
fetchCustomQuestions(topic?): Promise<CustomQuestion[]>
createQuestion(params): Promise<CustomQuestion>
updateQuestion(id, params): Promise<CustomQuestion>
deleteQuestion(id): Promise<boolean>

// Notes
fetchNotes(params?): Promise<Note[]>
saveNote(params): Promise<Note>
deleteNote(id): Promise<boolean>

// Topics
fetchTopics(): Promise<TopicsMap>
```

## Styling

### CSS Variables
```css
:root {
  --primary: #6366f1;
  --primary-dark: #4f46e5;
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
  --bg: #0f172a;
  --bg-card: #1e293b;
  --text: #f8fafc;
  --text-muted: #94a3b8;
  --border: #334155;
}
```

### Key Classes
| Class | Purpose |
|-------|---------|
| `.app` | Main container |
| `.home-content` | Home screen layout |
| `.quiz-content` | Quiz screen layout |
| `.main-cta` | Primary call-to-action button |
| `.quick-actions-grid` | 4-column action grid |
| `.quiz-type-card` | Quiz mode selection card |
| `.confidence-slider` | 0-5 confidence rating |
| `.analytics-*` | Analytics screen styles |
| `.qm-*` | Question manager styles |

## PWA Configuration

### Service Worker (public/service-worker.js)
- Network-first for HTML/JS/CSS
- Cache-first for static assets
- Skip API calls (always network)
- Automatic cache invalidation on version change

### Manifest (public/manifest.json)
```json
{
  "name": "Recallr",
  "short_name": "Recallr",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#6366f1",
  "background_color": "#0f172a"
}
```

## Environment Variables

```bash
# .env
REACT_APP_API_URL=https://fwge4gqlr7.execute-api.us-east-1.amazonaws.com/prod
REACT_APP_USER_POOL_ID=us-east-1_Suy4cgvUy
REACT_APP_USER_POOL_CLIENT_ID=3gmspqs073e366vr1t01sggdl6
REACT_APP_REGION=us-east-1
```

## Build & Deploy

```bash
# Development
npm start

# Production build
npm run build

# Deploy to S3
aws s3 sync build/ s3://quizappstack-websitebucket75c24d94-deol4ncerkge/ --delete --profile ShivamTiwari2408

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id ERF50ZOUSOA4M --paths "/*" --profile ShivamTiwari2408
```

## Cache Busting

Update `CACHE_VERSION` in `public/service-worker.js` before each deployment:
```javascript
const CACHE_VERSION = '2026-02-10-analytics-v3';
```

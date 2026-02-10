# SM-2 Spaced Repetition Algorithm

## Overview

Recallr implements an enhanced version of the SuperMemo SM-2 algorithm, optimized for system design interview preparation. The algorithm schedules question reviews at optimal intervals to maximize long-term retention while minimizing study time.

## Core Concepts

### Easiness Factor (EF)
A measure of how easy a question is for the user. Ranges from 1.3 (difficult) to 2.5 (easy).

```typescript
// EF adjustment formula
newEF = oldEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
// Clamped to [1.3, 2.5]
```

### Quality Rating (0-5)
User's self-assessed confidence after answering:

| Rating | Meaning | Effect |
|--------|---------|--------|
| 0 | Complete blackout | Reset to learning phase |
| 1 | Incorrect, recognized answer | Reset to learning phase |
| 2 | Incorrect, easy to recall | Reset to learning phase |
| 3 | Correct with difficulty | Maintain/slight decrease EF |
| 4 | Correct with hesitation | Maintain EF |
| 5 | Perfect recall | Increase EF |

### Interval Calculation

```typescript
if (quality < 3) {
  // Failed - reset
  repetitions = 0;
  interval = 1;
} else {
  // Passed
  if (repetitions === 0) interval = 1;
  else if (repetitions === 1) interval = 6;
  else interval = Math.round(previousInterval * EF);
  
  repetitions++;
}
```

## Enhanced Features

### 1. Confidence-Weighted Quality

The algorithm combines correctness with user confidence:

```typescript
function calculateQuality(isCorrect: boolean, confidence: number): number {
  if (!isCorrect) {
    // Wrong answer: 0-2 based on confidence
    return Math.min(2, Math.floor(confidence / 2));
  }
  // Correct answer: 3-5 based on confidence
  return Math.min(5, 3 + Math.floor(confidence / 2));
}
```

### 2. Response Time Factor

Fast correct answers boost the quality rating:

```typescript
const timeBonus = responseTimeMs < 10000 ? 0.5 : 0;
adjustedQuality = Math.min(5, quality + timeBonus);
```

### 3. Streak Multiplier

Consecutive correct answers accelerate intervals:

```typescript
if (consecutiveCorrect >= 3) {
  interval = Math.round(interval * 1.2);
}
```

### 4. Difficulty Adjustment

Question difficulty affects initial intervals:

```typescript
const difficultyMultiplier = {
  easy: 1.3,
  medium: 1.0,
  hard: 0.7
};
interval = Math.round(interval * difficultyMultiplier[difficulty]);
```

### 5. Topic Balancing

Prevents over-focusing on single topics:

```typescript
// Reduce priority for recently studied topics
if (lastStudiedWithin24Hours) {
  selectionPriority *= 0.7;
}
```

## User Status Classification

Based on SM-2 state, users are classified into statuses:

| Status | Criteria |
|--------|----------|
| `new` | Never attempted |
| `learning` | repetitions < 2 |
| `reviewing` | repetitions >= 2, EF < 2.0 |
| `mastered` | repetitions >= 3, EF >= 2.0, interval >= 21 |
| `struggling` | EF < 1.5 OR consecutiveWrong >= 3 |

## Quiz Type Strategies

### Adaptive (Default)
Balanced mix prioritizing due items:
- 40% overdue questions
- 30% due today
- 20% new questions
- 10% reinforcement of weak areas

### Spaced Review
Focus on scheduled reviews:
- 60% overdue
- 30% due today
- 10% due this week

### Weak Area
Target struggling questions:
- 70% status = 'struggling'
- 20% lowest EF questions
- 10% recent wrong answers

### Topic Focused
Deep dive into specific topic:
- Filter by topic/subtopic
- Apply standard SM-2 within topic

### Exam Prep
Simulate exam conditions:
- Random selection across all topics
- No SM-2 prioritization
- Timed responses

## Data Model

### Progress Record
```typescript
interface SM2Progress {
  easinessFactor: number;      // 1.3 - 2.5
  interval: number;            // Days until next review
  repetitions: number;         // Consecutive correct count
  nextReviewDate: string;      // ISO date
  lastAttemptDate: string;     // ISO timestamp
  totalAttempts: number;
  correctAttempts: number;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  averageResponseTimeMs: number;
  averageConfidenceRating: number;
  confidenceRatingsCount: number;
}
```

## Constants

```typescript
const SM2_CONSTANTS = {
  MIN_EASINESS_FACTOR: 1.3,
  MAX_EASINESS_FACTOR: 2.5,
  DEFAULT_EASINESS_FACTOR: 2.5,
  INITIAL_INTERVAL: 1,
  SECOND_INTERVAL: 6,
  MIN_QUALITY_FOR_PASS: 3,
  MASTERY_THRESHOLD_EF: 2.0,
  MASTERY_THRESHOLD_INTERVAL: 21,
  MASTERY_THRESHOLD_REPS: 3,
  STRUGGLING_THRESHOLD_EF: 1.5,
  STRUGGLING_THRESHOLD_WRONG: 3,
};
```

## Example Progression

| Attempt | Correct | Confidence | Quality | EF | Interval | Next Review |
|---------|---------|------------|---------|-----|----------|-------------|
| 1 | ✓ | 3 | 4 | 2.5 | 1 day | Tomorrow |
| 2 | ✓ | 4 | 5 | 2.6→2.5 | 6 days | +6 days |
| 3 | ✓ | 5 | 5 | 2.5 | 15 days | +15 days |
| 4 | ✗ | 2 | 1 | 2.36 | 1 day | Tomorrow |
| 5 | ✓ | 4 | 5 | 2.46 | 1 day | Tomorrow |
| 6 | ✓ | 5 | 5 | 2.5 | 6 days | +6 days |

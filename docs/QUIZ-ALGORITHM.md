# Quiz Selection Algorithm

## Overview

The quiz app supports four question selection modes: Smart, Wrong, Remind, and Random. Each mode uses a different strategy to select questions based on user progress data.

## Quiz Modes

### 1. Smart Mode (Default)

Intelligent question selection that prioritizes questions you need to practice most.

#### Scoring Formula

Each question receives a score. Higher scores = higher priority for selection.

```
Base Scores:
├── Unseen questions:     50 points
├── Wrong answers:        100 + (wrongCount × 10) points
├── Remind-marked:        70 + (remindCount × 5) points
└── Known/mastered:       10 - min(knownCount, 10) points

Time-Based Boosts:
├── Not seen in 7+ days:  +15 points
└── Not seen in 30+ days: +30 points (cumulative with 7-day boost)

Randomness Factor:
└── Random(0-10) points added to prevent identical ordering
```

#### Selection Process

1. Filter questions by topic/subtopic (if specified)
2. Fetch user's progress data from DynamoDB
3. Calculate score for each question
4. Sort questions by score (descending)
5. Take top N questions (default: 10)
6. Shuffle final selection for variety

#### Example Scoring

| Question State | Base | Time Boost | Random | Total Range |
|----------------|------|------------|--------|-------------|
| Never seen | 50 | 0 | 0-10 | 50-60 |
| Wrong 3 times | 130 | 0 | 0-10 | 130-140 |
| Wrong 3 times, 30+ days ago | 130 | 45 | 0-10 | 175-185 |
| Marked remind | 70 | 0 | 0-10 | 70-80 |
| Known 5 times | 5 | 0 | 0-10 | 5-15 |

### 2. Wrong Mode

Focuses exclusively on questions you've answered incorrectly.

#### Selection Criteria
- Questions where `wrongCount > 0` OR `status === 'wrong'`
- Randomly shuffled from the filtered pool
- Returns up to N questions (or fewer if not enough wrong answers)

### 3. Remind Mode

Surfaces questions you've explicitly marked for review.

#### Selection Criteria
- Questions where `status === 'remind'`
- Randomly shuffled from the filtered pool
- Returns up to N questions (or fewer if not enough remind-marked)

### 4. Random Mode

Pure random selection with no intelligence.

#### Selection Process
- Shuffles all available questions
- Takes first N questions
- No consideration of user progress

## Slot Filling

If a mode (wrong/remind) returns fewer questions than requested, the remaining slots are filled with random questions from the available pool (excluding already-selected questions).

## API Parameters

```
GET /questions?count=10&mode=smart&topic=Databases&subtopic=Sharding

Parameters:
├── count:    Number of questions (default: 10)
├── mode:     smart | wrong | remind | random (default: smart)
├── topic:    Filter by topic (optional)
└── subtopic: Filter by subtopic (optional)
```

## Constants Reference

Defined in `infrastructure/lambda/shared/constants.ts`:

```typescript
SMART_SCORING: {
  BASE_UNSEEN: 50,
  WRONG_BASE: 100,
  WRONG_MULTIPLIER: 10,
  REMIND_BASE: 70,
  REMIND_MULTIPLIER: 5,
  KNOWN_BASE: 10,
  DAYS_BOOST_7: 15,
  DAYS_BOOST_30: 30,
  RANDOMNESS_FACTOR: 10,
}
```

## Progress Data Structure

User progress is stored per question in DynamoDB:

```typescript
{
  userId: string,
  questionId: string,
  status: 'known' | 'remind' | 'wrong',
  wrongCount: number,
  knownCount: number,
  remindCount: number,
  lastAnswered: ISO timestamp
}
```

## Design Rationale

1. **Wrong answers get highest priority** - Spaced repetition principle: focus on weaknesses
2. **Time decay boosts** - Prevents questions from being forgotten over time
3. **Randomness factor** - Ensures variety even with similar scores
4. **Known questions deprioritized** - Don't waste time on mastered content
5. **Slot filling** - Ensures user always gets requested number of questions

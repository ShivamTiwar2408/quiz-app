// Unit tests for the client-side SM-2 spaced-repetition engine.
import {
  calculateSM2Update,
  createInitialProgress,
  updateProgressAfterAttempt,
  isDueForReview,
  getDaysUntilReview,
} from '../sm2';

describe('SM-2 engine', () => {
  it('resets interval and repetitions on a wrong answer (rating < 3)', () => {
    const start = createInitialProgress('u1', 'q1', 'Caching', 'TTL', 'medium');
    // Simulate prior success so there is an interval to reset.
    const afterCorrect = updateProgressAfterAttempt(start, true, 5, 4000);
    const afterWrong = updateProgressAfterAttempt(afterCorrect, false, 1, 8000);

    expect(afterWrong.sm2.repetitions).toBe(0);
    expect(afterWrong.sm2.interval).toBe(1);
    expect(afterWrong.wrongAttempts).toBe(1);
    expect(afterWrong.currentStreak).toBe(0);
  });

  it('grows the interval on consecutive correct answers', () => {
    let p = createInitialProgress('u1', 'q2', 'Databases', 'Indexes', 'easy');
    p = updateProgressAfterAttempt(p, true, 5, 3000); // rep 1 -> interval 1
    const i1 = p.sm2.interval;
    p = updateProgressAfterAttempt(p, true, 5, 3000); // rep 2 -> interval 6
    const i2 = p.sm2.interval;
    p = updateProgressAfterAttempt(p, true, 5, 3000); // rep 3 -> interval * EF
    const i3 = p.sm2.interval;

    expect(p.sm2.repetitions).toBe(3);
    expect(i2).toBeGreaterThan(i1);
    expect(i3).toBeGreaterThan(i2);
    expect(p.currentStreak).toBe(3);
  });

  it('clamps the ease factor within [1.3, 2.5]', () => {
    let p = createInitialProgress('u1', 'q3', 'Networking', 'TCP', 'hard');
    // Many blackouts should not push EF below the floor.
    for (let i = 0; i < 10; i++) p = updateProgressAfterAttempt(p, false, 0, 0);
    expect(p.sm2.easeFactor).toBeGreaterThanOrEqual(1.3);
    expect(p.sm2.easeFactor).toBeLessThanOrEqual(2.5);
  });

  it('marks brand-new questions as due immediately', () => {
    const p = createInitialProgress('u1', 'q4', 'Security', 'JWT', 'medium');
    expect(isDueForReview(p.sm2.nextReviewDate)).toBe(true);
  });

  it('schedules a future review after a correct answer', () => {
    const sm2 = calculateSM2Update(null, 5, true);
    expect(getDaysUntilReview(sm2.nextReviewDate)).toBeGreaterThanOrEqual(0);
    expect(sm2.interval).toBeGreaterThanOrEqual(1);
  });
});

// Firestore data layer — all reads/writes of user-owned data go through here.
//
// Document layout (each user's data is isolated under their uid, which is
// also the security boundary enforced by firestore.rules):
//
//   users/{uid}/progress/{questionId}   → UserQuestionProgress (SM-2 state)
//   users/{uid}/attempts/{attemptId}    → QuizAttempt          (history)
//   users/{uid}/sessions/{sessionId}    → QuizSession          (quiz runs)
//   users/{uid}/notes/{noteId}          → Note
//
// Per-user subcollections keep queries cheap (no cross-user scans) and make
// the "due for review" / "past mistakes" reads simple, indexed lookups.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit as fbLimit,
  where,
  QueryConstraint,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { UserQuestionProgress, Note, QuizAttempt } from '../lib/types';

export interface SessionRecordDoc {
  sessionId: string;
  quizType: string;
  topic?: string;
  subtopic?: string;
  totalQuestions: number;
  questionsAnswered: number;
  correctAnswers: number;
  startedAt: string;
  completedAt?: string;
  totalTimeMs?: number;
}

function userCol(uid: string, name: string) {
  return collection(db, 'users', uid, name);
}

// ---------------------------------------------------------------------------
// Progress (SM-2 per question)
// ---------------------------------------------------------------------------

export const progressRepo = {
  async getAll(uid: string): Promise<UserQuestionProgress[]> {
    if (!isFirebaseConfigured) return [];
    const snap = await getDocs(userCol(uid, 'progress'));
    return snap.docs.map((d) => d.data() as UserQuestionProgress);
  },

  async get(uid: string, questionId: string): Promise<UserQuestionProgress | null> {
    if (!isFirebaseConfigured) return null;
    const ref = doc(db, 'users', uid, 'progress', questionId);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as UserQuestionProgress) : null;
  },

  async save(uid: string, progress: UserQuestionProgress): Promise<void> {
    if (!isFirebaseConfigured) return;
    const ref = doc(db, 'users', uid, 'progress', progress.questionId);
    await setDoc(ref, progress, { merge: true });
  },
};

// ---------------------------------------------------------------------------
// Attempts (immutable history — powers "remind me of past mistakes")
// ---------------------------------------------------------------------------

export const attemptRepo = {
  async save(uid: string, attempt: QuizAttempt): Promise<void> {
    if (!isFirebaseConfigured) return;
    const ref = doc(db, 'users', uid, 'attempts', attempt.attemptId);
    await setDoc(ref, attempt);
  },

  async recent(uid: string, max = 50, questionId?: string): Promise<QuizAttempt[]> {
    if (!isFirebaseConfigured) return [];
    const constraints: QueryConstraint[] = [];
    if (questionId) constraints.push(where('questionId', '==', questionId));
    constraints.push(orderBy('attemptedAt', 'desc'), fbLimit(max));
    const snap = await getDocs(query(userCol(uid, 'attempts'), ...constraints));
    return snap.docs.map((d) => d.data() as QuizAttempt);
  },
};

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const sessionRepo = {
  async save(uid: string, session: SessionRecordDoc): Promise<void> {
    if (!isFirebaseConfigured) return;
    const ref = doc(db, 'users', uid, 'sessions', session.sessionId);
    await setDoc(ref, session, { merge: true });
  },

  async recent(uid: string, max = 20): Promise<SessionRecordDoc[]> {
    if (!isFirebaseConfigured) return [];
    const snap = await getDocs(
      query(userCol(uid, 'sessions'), orderBy('startedAt', 'desc'), fbLimit(max))
    );
    return snap.docs.map((d) => d.data() as SessionRecordDoc);
  },
};

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export const notesRepo = {
  async getAll(uid: string): Promise<Note[]> {
    if (!isFirebaseConfigured) return [];
    const snap = await getDocs(
      query(userCol(uid, 'notes'), orderBy('updatedAt', 'desc'))
    );
    return snap.docs.map((d) => d.data() as Note);
  },

  async save(uid: string, note: Note): Promise<void> {
    if (!isFirebaseConfigured) return;
    const ref = doc(db, 'users', uid, 'notes', note.noteId);
    await setDoc(ref, note, { merge: true });
  },

  async delete(uid: string, noteId: string): Promise<void> {
    if (!isFirebaseConfigured) return;
    await deleteDoc(doc(db, 'users', uid, 'notes', noteId));
  },
};

import { useState, useEffect, useCallback } from 'react';
import { Note, AuthUser } from '../types';
import { fetchNotes, saveNote, deleteNote, SaveNoteParams } from '../api';

export interface UseNotesReturn {
  notes: Note[];
  loading: boolean;
  error: string | null;
  createNote: (params: Omit<SaveNoteParams, 'noteId'>) => Promise<Note | null>;
  updateNote: (params: SaveNoteParams) => Promise<Note | null>;
  removeNote: (noteId: string) => Promise<boolean>;
  togglePin: (note: Note) => Promise<void>;
  toggleQuizMe: (note: Note) => Promise<void>;
  refreshNotes: () => Promise<void>;
}

export function useNotes(user: AuthUser | null): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshNotes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotes();
      setNotes(data);
    } catch (err) {
      setError('Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshNotes();
    } else {
      setNotes([]);
    }
  }, [user, refreshNotes]);

  const sortNotes = (notesList: Note[]) => {
    return [...notesList].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  };

  const createNote = useCallback(async (params: Omit<SaveNoteParams, 'noteId'>): Promise<Note | null> => {
    setError(null);
    const note = await saveNote(params);
    if (note) {
      setNotes(prev => sortNotes([note, ...prev]));
    } else {
      setError('Failed to create note');
    }
    return note;
  }, []);

  const updateNote = useCallback(async (params: SaveNoteParams): Promise<Note | null> => {
    setError(null);
    const note = await saveNote(params);
    if (note) {
      setNotes(prev => sortNotes(prev.map(n => n.noteId === note.noteId ? note : n)));
    } else {
      setError('Failed to update note');
    }
    return note;
  }, []);

  const removeNote = useCallback(async (noteId: string): Promise<boolean> => {
    setError(null);
    const success = await deleteNote(noteId);
    if (success) {
      setNotes(prev => prev.filter(n => n.noteId !== noteId));
    } else {
      setError('Failed to delete note');
    }
    return success;
  }, []);

  const togglePin = useCallback(async (note: Note) => {
    await updateNote({ ...note, pinned: !note.pinned });
  }, [updateNote]);

  const toggleQuizMe = useCallback(async (note: Note) => {
    await updateNote({ ...note, quizMe: !note.quizMe });
  }, [updateNote]);

  return {
    notes,
    loading,
    error,
    createNote,
    updateNote,
    removeNote,
    togglePin,
    toggleQuizMe,
    refreshNotes,
  };
}

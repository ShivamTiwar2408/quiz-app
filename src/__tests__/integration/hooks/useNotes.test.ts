/**
 * Integration Tests for useNotes Hook
 * Tests notes CRUD operations
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNotes } from '../../../hooks/useNotes';
import { AuthUser, Note } from '../../../types';

// Mock the API module
jest.mock('../../../api', () => ({
  fetchNotes: jest.fn(),
  saveNote: jest.fn(),
  deleteNote: jest.fn(),
}));

import * as apiModule from '../../../api';

const mockApi = apiModule as jest.Mocked<typeof apiModule>;

const mockUser: AuthUser = {
  email: 'test@example.com',
  userId: 'user-123',
};

const mockNotes: Note[] = [
  {
    noteId: 'note-1',
    title: 'CAP Theorem Notes',
    content: 'Consistency, Availability, Partition tolerance',
    color: 'default',
    pinned: true,
    quizMe: true,
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-02-10T10:00:00Z',
  },
  {
    noteId: 'note-2',
    title: 'Distributed Systems',
    content: 'Notes about distributed systems',
    color: 'blue',
    pinned: false,
    quizMe: false,
    createdAt: '2026-02-05T10:00:00Z',
    updatedAt: '2026-02-05T10:00:00Z',
  },
];

describe('useNotes Hook Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.fetchNotes.mockResolvedValue(mockNotes);
  });

  describe('Initial Loading', () => {
    it('should not load notes when user is null', async () => {
      const { result } = renderHook(() => useNotes(null));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockApi.fetchNotes).not.toHaveBeenCalled();
      expect(result.current.notes).toEqual([]);
    });

    it('should load notes when user is provided', async () => {
      const { result } = renderHook(() => useNotes(mockUser));
      
      expect(result.current.loading).toBe(true);
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(mockApi.fetchNotes).toHaveBeenCalled();
      expect(result.current.notes).toHaveLength(2);
    });

    it('should sort notes with pinned first', async () => {
      const { result } = renderHook(() => useNotes(mockUser));
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      // Pinned note should be first
      expect(result.current.notes[0].pinned).toBe(true);
    });
  });

  describe('Create Note', () => {
    it('should create a new note', async () => {
      const newNote: Note = {
        noteId: 'note-3',
        title: 'New Note',
        content: 'New content',
        color: 'green',
        pinned: false,
        quizMe: true,
        createdAt: '2026-02-12T10:00:00Z',
        updatedAt: '2026-02-12T10:00:00Z',
      };
      
      mockApi.saveNote.mockResolvedValue(newNote);
      
      const { result } = renderHook(() => useNotes(mockUser));
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      let createdNote: Note | null = null;
      await act(async () => {
        createdNote = await result.current.createNote({
          title: 'New Note',
          content: 'New content',
          color: 'green',
          quizMe: true,
        });
      });
      
      expect(createdNote).toEqual(newNote);
      expect(result.current.notes).toHaveLength(3);
      expect(mockApi.saveNote).toHaveBeenCalledWith({
        title: 'New Note',
        content: 'New content',
        color: 'green',
        quizMe: true,
      });
    });

    it('should handle create error', async () => {
      mockApi.saveNote.mockResolvedValue(null);
      
      const { result } = renderHook(() => useNotes(mockUser));
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      await act(async () => {
        await result.current.createNote({
          title: 'New Note',
          content: 'Content',
        });
      });
      
      expect(result.current.error).toBe('Failed to create note');
    });
  });

  describe('Update Note', () => {
    it('should update an existing note', async () => {
      const updatedNote: Note = {
        ...mockNotes[0],
        title: 'Updated Title',
        updatedAt: '2026-02-12T12:00:00Z',
      };
      
      mockApi.saveNote.mockResolvedValue(updatedNote);
      
      const { result } = renderHook(() => useNotes(mockUser));
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      await act(async () => {
        await result.current.updateNote({
          noteId: 'note-1',
          title: 'Updated Title',
          content: mockNotes[0].content,
          color: mockNotes[0].color,
          pinned: mockNotes[0].pinned,
          quizMe: mockNotes[0].quizMe,
        });
      });
      
      const updated = result.current.notes.find(n => n.noteId === 'note-1');
      expect(updated?.title).toBe('Updated Title');
    });
  });

  describe('Delete Note', () => {
    it('should delete a note', async () => {
      mockApi.deleteNote.mockResolvedValue(true);
      
      const { result } = renderHook(() => useNotes(mockUser));
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.notes).toHaveLength(2);
      
      let success: boolean = false;
      await act(async () => {
        success = await result.current.removeNote('note-1');
      });
      
      expect(success).toBe(true);
      expect(result.current.notes).toHaveLength(1);
      expect(result.current.notes.find(n => n.noteId === 'note-1')).toBeUndefined();
    });

    it('should handle delete error', async () => {
      mockApi.deleteNote.mockResolvedValue(false);
      
      const { result } = renderHook(() => useNotes(mockUser));
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      await act(async () => {
        await result.current.removeNote('note-1');
      });
      
      expect(result.current.error).toBe('Failed to delete note');
      expect(result.current.notes).toHaveLength(2); // Note should still exist
    });
  });

  describe('Toggle Pin', () => {
    it('should toggle pin status', async () => {
      const toggledNote: Note = {
        ...mockNotes[0],
        pinned: false,
        updatedAt: '2026-02-12T12:00:00Z',
      };
      
      mockApi.saveNote.mockResolvedValue(toggledNote);
      
      const { result } = renderHook(() => useNotes(mockUser));
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      const noteBefore = result.current.notes.find(n => n.noteId === 'note-1');
      expect(noteBefore?.pinned).toBe(true);
      
      await act(async () => {
        await result.current.togglePin(mockNotes[0]);
      });
      
      expect(mockApi.saveNote).toHaveBeenCalledWith(
        expect.objectContaining({
          noteId: 'note-1',
          pinned: false,
        })
      );
    });
  });

  describe('Toggle Quiz Me', () => {
    it('should toggle quizMe status', async () => {
      const toggledNote: Note = {
        ...mockNotes[1],
        quizMe: true,
        updatedAt: '2026-02-12T12:00:00Z',
      };
      
      mockApi.saveNote.mockResolvedValue(toggledNote);
      
      const { result } = renderHook(() => useNotes(mockUser));
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      await act(async () => {
        await result.current.toggleQuizMe(mockNotes[1]);
      });
      
      expect(mockApi.saveNote).toHaveBeenCalledWith(
        expect.objectContaining({
          noteId: 'note-2',
          quizMe: true,
        })
      );
    });
  });

  describe('Refresh Notes', () => {
    it('should refresh notes from API', async () => {
      const { result } = renderHook(() => useNotes(mockUser));
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(mockApi.fetchNotes).toHaveBeenCalledTimes(1);
      
      const newNotes: Note[] = [
        ...mockNotes,
        {
          noteId: 'note-3',
          title: 'New Note',
          content: 'Content',
          color: 'default',
          pinned: false,
          quizMe: false,
          createdAt: '2026-02-12T10:00:00Z',
          updatedAt: '2026-02-12T10:00:00Z',
        },
      ];
      
      mockApi.fetchNotes.mockResolvedValue(newNotes);
      
      await act(async () => {
        await result.current.refreshNotes();
      });
      
      expect(mockApi.fetchNotes).toHaveBeenCalledTimes(2);
      expect(result.current.notes).toHaveLength(3);
    });
  });
});

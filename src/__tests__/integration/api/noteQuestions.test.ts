/**
 * Integration Tests for Note Questions Flow
 * Tests the complete flow of generating questions from notes and fetching them
 */

// Mock auth module before importing api
jest.mock('../../../auth', () => ({
  getIdToken: jest.fn(() => 'mock-token'),
  refreshTokens: jest.fn(),
}));

const originalFetch = global.fetch;
const mockFetch = jest.fn();

describe('Note Questions API Integration Tests', () => {
  beforeAll(() => {
    process.env.REACT_APP_API_URL = 'https://api.example.com';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    delete process.env.REACT_APP_API_URL;
  });

  describe('fetchNoteQuestions', () => {
    it('should fetch note-generated questions successfully', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      const mockQuestions = [
        {
          id: 'note-abc123',
          topic: 'My Notes',
          subtopic: 'CAP Theorem Notes',
          question: 'What does the C in CAP theorem stand for?',
          options: {
            A: 'Consistency',
            B: 'Concurrency',
            C: 'Capacity',
            D: 'Computation',
          },
          correct_answers: ['A'],
          explanation: 'C stands for Consistency.\n\n---\n📝 **From your note:**\nCAP theorem describes...',
          difficulty: 'medium',
          category: 'notes',
          noteId: 'abc123',
        },
        {
          id: 'note-def456',
          topic: 'My Notes',
          subtopic: 'Distributed Systems',
          question: 'What is a key benefit of distributed systems?',
          options: {
            A: 'Simplicity',
            B: 'Scalability',
            C: 'Lower cost',
            D: 'Easier debugging',
          },
          correct_answers: ['B'],
          explanation: 'Scalability is a key benefit.\n\n---\n📝 **From your note:**\nDistributed systems allow...',
          difficulty: 'easy',
          category: 'notes',
          noteId: 'def456',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ questions: mockQuestions, count: 2, source: 'notes' }),
      });

      const result = await api.fetchNoteQuestions(10);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/note-questions?count=10',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'mock-token',
          }),
        })
      );
      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('notes');
      expect(result[0].noteId).toBe('abc123');
    });

    it('should return empty array when no note questions exist', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ questions: [], count: 0, source: 'notes' }),
      });

      const result = await api.fetchNoteQuestions();

      expect(result).toEqual([]);
    });

    it('should return empty array on API error', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await api.fetchNoteQuestions();

      expect(result).toEqual([]);
    });

    it('should return empty array when API_BASE_URL is not set', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = '';
      const api = await import('../../../api');

      const result = await api.fetchNoteQuestions();

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should use default count of 10 when not specified', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ questions: [] }),
      });

      await api.fetchNoteQuestions();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/note-questions?count=100',
        expect.any(Object)
      );
    });

    it('should respect custom count parameter', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ questions: [] }),
      });

      await api.fetchNoteQuestions(5);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/note-questions?count=5',
        expect.any(Object)
      );
    });
  });

  describe('Note Questions Flow - End to End', () => {
    it('should support the complete flow: save note with quizMe -> fetch generated questions', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      // Step 1: Save a note with quizMe enabled
      const savedNote = {
        noteId: 'note-123',
        title: 'Microservices Architecture',
        content: 'Microservices is an architectural style that structures an application as a collection of loosely coupled services.',
        color: 'blue',
        pinned: false,
        quizMe: true,
        createdAt: '2026-02-13T10:00:00Z',
        updatedAt: '2026-02-13T10:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ note: savedNote }),
      });

      const noteResult = await api.saveNote({
        title: 'Microservices Architecture',
        content: 'Microservices is an architectural style that structures an application as a collection of loosely coupled services.',
        color: 'blue',
        quizMe: true,
      });

      expect(noteResult).toEqual(savedNote);
      expect(noteResult?.quizMe).toBe(true);

      // Step 2: Fetch note questions (simulating after the scheduled job runs)
      const generatedQuestions = [
        {
          id: 'note-note-123',
          topic: 'My Notes',
          subtopic: 'Microservices Architecture',
          question: 'What is the main characteristic of microservices architecture?',
          options: {
            A: 'Tightly coupled services',
            B: 'Loosely coupled services',
            C: 'Single monolithic deployment',
            D: 'Shared database',
          },
          correct_answers: ['B'],
          explanation: 'Microservices are loosely coupled.\n\n---\n📝 **From your note:**\nMicroservices is an architectural style...',
          difficulty: 'medium',
          category: 'notes',
          noteId: 'note-123',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ questions: generatedQuestions, count: 1, source: 'notes' }),
      });

      const questions = await api.fetchNoteQuestions();

      expect(questions).toHaveLength(1);
      expect(questions[0].noteId).toBe('note-123');
      expect(questions[0].subtopic).toBe('Microservices Architecture');
    });

    it('should handle notes without quizMe flag - no questions generated', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      // Save a note without quizMe
      const savedNote = {
        noteId: 'note-456',
        title: 'Personal Notes',
        content: 'Some personal notes',
        color: 'default',
        pinned: false,
        quizMe: false,
        createdAt: '2026-02-13T10:00:00Z',
        updatedAt: '2026-02-13T10:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ note: savedNote }),
      });

      const noteResult = await api.saveNote({
        title: 'Personal Notes',
        content: 'Some personal notes',
        quizMe: false,
      });

      expect(noteResult?.quizMe).toBe(false);

      // Fetch note questions - should return empty since quizMe is false
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ questions: [], count: 0, source: 'notes' }),
      });

      const questions = await api.fetchNoteQuestions();
      expect(questions).toEqual([]);
    });
  });

  describe('Note Question Structure Validation', () => {
    it('should return questions with correct structure for quiz consumption', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      const mockQuestion = {
        id: 'note-test123',
        topic: 'My Notes',
        subtopic: 'Test Note',
        question: 'What is the answer?',
        options: {
          A: 'Option A',
          B: 'Option B',
          C: 'Option C',
          D: 'Option D',
        },
        correct_answers: ['A'],
        explanation: 'A is correct because...',
        difficulty: 'medium',
        category: 'notes',
        noteId: 'test123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ questions: [mockQuestion] }),
      });

      const questions = await api.fetchNoteQuestions(1);

      expect(questions).toHaveLength(1);
      const q = questions[0];
      
      // Verify all required fields for quiz consumption
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('topic');
      expect(q).toHaveProperty('subtopic');
      expect(q).toHaveProperty('question');
      expect(q).toHaveProperty('options');
      expect(q).toHaveProperty('correct_answers');
      expect(q).toHaveProperty('explanation');
      expect(q).toHaveProperty('difficulty');
      
      // Verify options structure
      expect(Object.keys(q.options)).toEqual(['A', 'B', 'C', 'D']);
      
      // Verify correct_answers is an array
      expect(Array.isArray(q.correct_answers)).toBe(true);
      
      // Verify note-specific fields
      expect(q.category).toBe('notes');
      expect(q.noteId).toBeDefined();
    });
  });
});

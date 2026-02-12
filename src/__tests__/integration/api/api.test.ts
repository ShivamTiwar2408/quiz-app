/**
 * Integration Tests for API Module
 * Tests API calls and response handling by mocking the authFetch function
 */

// Mock auth module before importing api
jest.mock('../../../auth', () => ({
  getIdToken: jest.fn(() => 'mock-token'),
  refreshTokens: jest.fn(),
}));

// Store original fetch
const originalFetch = global.fetch;

// Create a mock fetch that we can control
const mockFetch = jest.fn();

describe('API Module Integration Tests', () => {
  beforeAll(() => {
    // Set API URL before importing the module
    process.env.REACT_APP_API_URL = 'https://api.example.com';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Replace global fetch with our mock
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    delete process.env.REACT_APP_API_URL;
  });

  describe('fetchTopics', () => {
    it('should fetch topics successfully', async () => {
      // Re-import to get fresh module with env var set
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');
      
      const mockTopics = {
        'Core Concepts': ['CAP Theorem', 'Scalability'],
        'Distributed Systems': ['Consensus'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ topics: mockTopics }),
      });

      const result = await api.fetchTopics();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/topics',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'mock-token',
          }),
        })
      );
      expect(result).toEqual(mockTopics);
    });

    it('should return empty object on error', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await api.fetchTopics();

      expect(result).toEqual({});
    });

    it('should return empty object when API_BASE_URL is not set', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = '';
      const api = await import('../../../api');

      const result = await api.fetchTopics();

      expect(result).toEqual({});
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('generateQuiz', () => {
    it('should generate quiz with correct parameters', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      const mockResponse = {
        sessionId: 'session-123',
        questions: [{ id: 'q1', question: 'Test?' }],
        quizType: 'adaptive',
        metadata: { overdueCount: 0, newCount: 1, reviewCount: 0 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await api.generateQuiz({
        quizType: 'adaptive',
        count: 10,
        topic: 'Core Concepts',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/quiz/generate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            quizType: 'adaptive',
            count: 10,
            topic: 'Core Concepts',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return null on error', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await api.generateQuiz({ quizType: 'adaptive' });

      expect(result).toBeNull();
    });
  });

  describe('submitAnswer', () => {
    it('should submit answer with all parameters', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      const mockResponse = {
        isCorrect: true,
        correctAnswers: ['A'],
        explanation: 'Correct!',
        nextReviewDate: '2026-02-15',
        newInterval: 3,
        newEaseFactor: 2.5,
        newStatus: 'reviewing',
        streakUpdate: { currentStreak: 1, isNewRecord: false },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await api.submitAnswer({
        sessionId: 'session-123',
        questionId: 'q1',
        selectedAnswers: ['A'],
        confidenceRating: 5,
        responseTimeMs: 5000,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/quiz/submit',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            sessionId: 'session-123',
            questionId: 'q1',
            selectedAnswers: ['A'],
            confidenceRating: 5,
            responseTimeMs: 5000,
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getProgress', () => {
    it('should fetch progress and stats', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      const mockResponse = {
        progress: { q1: { questionId: 'q1', status: 'known' } },
        stats: { totalAnswered: 10, totalCorrect: 8 },
        dueForReview: { overdue: [], dueToday: [], dueTomorrow: [] },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await api.getProgress();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/progress',
        expect.any(Object)
      );
      expect(result.progress).toEqual(mockResponse.progress);
      expect(result.stats).toEqual(mockResponse.stats);
    });

    it('should return default stats on error', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await api.getProgress();

      expect(result.progress).toEqual({});
      expect(result.stats.totalAnswered).toBe(0);
    });
  });

  describe('Notes API', () => {
    describe('fetchNotes', () => {
      it('should fetch notes', async () => {
        jest.resetModules();
        process.env.REACT_APP_API_URL = 'https://api.example.com';
        const api = await import('../../../api');

        const mockNotes = [
          { noteId: 'n1', title: 'Note 1', content: 'Content' },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ notes: mockNotes }),
        });

        const result = await api.fetchNotes();

        expect(result).toEqual(mockNotes);
      });

      it('should fetch notes with filters', async () => {
        jest.resetModules();
        process.env.REACT_APP_API_URL = 'https://api.example.com';
        const api = await import('../../../api');

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ notes: [] }),
        });

        await api.fetchNotes({ pinned: true, quizMe: true });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/notes?pinned=true&quizMe=true',
          expect.any(Object)
        );
      });
    });

    describe('saveNote', () => {
      it('should save a new note', async () => {
        jest.resetModules();
        process.env.REACT_APP_API_URL = 'https://api.example.com';
        const api = await import('../../../api');

        const mockNote = {
          noteId: 'n1',
          title: 'New Note',
          content: 'Content',
          color: 'default',
          pinned: false,
          quizMe: false,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ note: mockNote }),
        });

        const result = await api.saveNote({
          title: 'New Note',
          content: 'Content',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/notes',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              title: 'New Note',
              content: 'Content',
            }),
          })
        );
        expect(result).toEqual(mockNote);
      });
    });

    describe('deleteNote', () => {
      it('should delete a note', async () => {
        jest.resetModules();
        process.env.REACT_APP_API_URL = 'https://api.example.com';
        const api = await import('../../../api');

        mockFetch.mockResolvedValueOnce({
          ok: true,
        });

        const result = await api.deleteNote('n1');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/notes/n1',
          expect.objectContaining({
            method: 'DELETE',
          })
        );
        expect(result).toBe(true);
      });
    });
  });

  describe('Analytics API', () => {
    it('should fetch analytics', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      const mockAnalytics = {
        overview: { totalQuestions: 100, totalAttempts: 50 },
        statusCounts: { learning: 10, mastered: 20 },
        topicAnalytics: [],
        dailyActivity: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAnalytics),
      });

      const result = await api.fetchAnalytics();

      expect(result).toEqual(mockAnalytics);
    });
  });

  describe('Custom Questions API', () => {
    it('should fetch custom questions', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      const mockQuestions = [
        { questionId: 'cq1', question: 'Custom question?' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ questions: mockQuestions }),
      });

      const result = await api.fetchCustomQuestions();

      expect(result).toEqual(mockQuestions);
    });

    it('should create a custom question', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      const mockQuestion = {
        questionId: 'cq1',
        topic: 'Custom',
        subtopic: 'Test',
        question: 'Test question?',
        options: { A: 'Option A', B: 'Option B' },
        correct_answers: ['A'],
        explanation: 'A is correct',
        difficulty: 'medium',
        isCustom: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ question: mockQuestion }),
      });

      const result = await api.createQuestion({
        topic: 'Custom',
        subtopic: 'Test',
        question: 'Test question?',
        options: { A: 'Option A', B: 'Option B' },
        correct_answers: ['A'],
        explanation: 'A is correct',
        difficulty: 'medium',
      });

      expect(result).toEqual(mockQuestion);
    });
  });

  describe('Hidden Questions API', () => {
    it('should hide a question', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const result = await api.hideQuestion('q1', 'Topic', 'Subtopic', 'Not useful');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/hidden-questions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            questionId: 'q1',
            topic: 'Topic',
            subtopic: 'Subtopic',
            reason: 'Not useful',
          }),
        })
      );
      expect(result).toBe(true);
    });

    it('should unhide a question', async () => {
      jest.resetModules();
      process.env.REACT_APP_API_URL = 'https://api.example.com';
      const api = await import('../../../api');

      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const result = await api.unhideQuestion('q1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/hidden-questions/q1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(result).toBe(true);
    });
  });
});

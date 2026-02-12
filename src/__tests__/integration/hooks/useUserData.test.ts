/**
 * Integration Tests for useUserData Hook
 * Tests user progress and stats loading
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUserData } from '../../../hooks/useUserData';
import { AuthUser } from '../../../types';

// Mock the API module
jest.mock('../../../api', () => ({
  fetchTopics: jest.fn(),
  getProgress: jest.fn(),
}));

import * as apiModule from '../../../api';

const mockApi = apiModule as jest.Mocked<typeof apiModule>;

const mockUser: AuthUser = {
  email: 'test@example.com',
  userId: 'user-123',
};

const mockTopics = {
  'Core Concepts': ['CAP Theorem', 'Scalability', 'Availability'],
  'Distributed Systems': ['Consensus', 'Replication'],
};

const mockProgress = {
  'q1': {
    questionId: 'q1',
    topic: 'Core Concepts',
    subtopic: 'CAP Theorem',
    status: 'known' as const,
    answeredCorrectly: true,
    wrongCount: 0,
    correctCount: 3,
    remindCount: 0,
    knownCount: 1,
  },
  'q2': {
    questionId: 'q2',
    topic: 'Distributed Systems',
    subtopic: 'Consensus',
    status: 'wrong' as const,
    answeredCorrectly: false,
    wrongCount: 2,
    correctCount: 0,
    remindCount: 0,
    knownCount: 0,
  },
  'q3': {
    questionId: 'q3',
    topic: 'Core Concepts',
    subtopic: 'Scalability',
    status: 'remind' as const,
    answeredCorrectly: true,
    wrongCount: 1,
    correctCount: 1,
    remindCount: 1,
    knownCount: 0,
  },
};

const mockStats = {
  totalAnswered: 10,
  totalCorrect: 7,
  totalWrong: 3,
  totalKnown: 5,
  totalRemind: 2,
  topicStats: {
    'Core Concepts': { answered: 6, correct: 5, wrong: 1 },
    'Distributed Systems': { answered: 4, correct: 2, wrong: 2 },
  },
  masteredCount: 5,
  reviewingCount: 3,
  overdueCount: 2,
  dueToday: 1,
};

describe('useUserData Hook Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.fetchTopics.mockResolvedValue(mockTopics);
    mockApi.getProgress.mockResolvedValue({
      progress: mockProgress,
      stats: mockStats,
    });
  });

  describe('Initial Loading', () => {
    it('should not load data when user is null', async () => {
      const { result } = renderHook(() => useUserData(null));
      
      // Wait a bit to ensure no loading happens
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockApi.fetchTopics).not.toHaveBeenCalled();
      expect(mockApi.getProgress).not.toHaveBeenCalled();
      expect(result.current.topics).toEqual({});
      expect(result.current.userProgress).toEqual({});
    });

    it('should load data when user is provided', async () => {
      const { result } = renderHook(() => useUserData(mockUser));
      
      expect(result.current.loading).toBe(true);
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(mockApi.fetchTopics).toHaveBeenCalled();
      expect(mockApi.getProgress).toHaveBeenCalled();
      expect(result.current.topics).toEqual(mockTopics);
      expect(result.current.userProgress).toEqual(mockProgress);
      expect(result.current.userStats).toEqual(mockStats);
    });
  });

  describe('Computed Values', () => {
    it('should calculate wrongCount correctly', async () => {
      const { result } = renderHook(() => useUserData(mockUser));
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      // q2 has wrongCount > 0
      expect(result.current.wrongCount).toBe(2); // q2 and q3 have wrongCount > 0
    });

    it('should calculate remindCount correctly', async () => {
      const { result } = renderHook(() => useUserData(mockUser));
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      // q3 has status 'remind'
      expect(result.current.remindCount).toBe(1);
    });
  });

  describe('Progress Updates', () => {
    it('should allow updating user progress', async () => {
      const { result } = renderHook(() => useUserData(mockUser));
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      act(() => {
        result.current.setUserProgress(prev => ({
          ...prev,
          'q4': {
            questionId: 'q4',
            topic: 'Caching',
            subtopic: 'CDN',
            status: 'known' as const,
            answeredCorrectly: true,
            wrongCount: 0,
            correctCount: 1,
            remindCount: 0,
            knownCount: 1,
          },
        }));
      });
      
      expect(result.current.userProgress['q4']).toBeDefined();
      expect(result.current.userProgress['q4'].topic).toBe('Caching');
    });
  });

  describe('Reset', () => {
    it('should reset all user data', async () => {
      const { result } = renderHook(() => useUserData(mockUser));
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(Object.keys(result.current.topics).length).toBeGreaterThan(0);
      
      act(() => {
        result.current.resetUserData();
      });
      
      expect(result.current.topics).toEqual({});
      expect(result.current.userProgress).toEqual({});
      expect(result.current.userStats.totalAnswered).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Reset mocks to simulate errors
      mockApi.fetchTopics.mockResolvedValue({});
      mockApi.getProgress.mockResolvedValue({
        progress: {},
        stats: {
          totalAnswered: 0,
          totalCorrect: 0,
          totalWrong: 0,
          totalKnown: 0,
          totalRemind: 0,
          topicStats: {},
        },
      });
      
      const { result } = renderHook(() => useUserData(mockUser));
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      // Should have default empty values when API returns empty/error responses
      expect(result.current.topics).toEqual({});
    });
  });
});

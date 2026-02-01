import { useState, useEffect, useCallback } from 'react';
import { UserProgress, UserStats, TopicsMap, AuthUser } from '../types';
import { fetchTopics, getProgress } from '../api';

const defaultStats: UserStats = {
  totalAnswered: 0,
  totalCorrect: 0,
  totalWrong: 0,
  totalKnown: 0,
  totalRemind: 0,
  topicStats: {},
};

export interface UseUserDataReturn {
  topics: TopicsMap;
  userProgress: Record<string, UserProgress>;
  userStats: UserStats;
  loading: boolean;
  wrongCount: number;
  remindCount: number;
  setUserProgress: React.Dispatch<React.SetStateAction<Record<string, UserProgress>>>;
  resetUserData: () => void;
}

export function useUserData(user: AuthUser | null): UseUserDataReturn {
  const [topics, setTopics] = useState<TopicsMap>({});
  const [userProgress, setUserProgress] = useState<Record<string, UserProgress>>({});
  const [userStats, setUserStats] = useState<UserStats>(defaultStats);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [topicsData, progressData] = await Promise.all([
          fetchTopics(),
          getProgress(),
        ]);
        setTopics(topicsData);
        setUserProgress(progressData.progress);
        setUserStats(progressData.stats);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, [user]);

  const wrongCount = Object.values(userProgress).filter(p => p.wrongCount > 0).length;
  const remindCount = Object.values(userProgress).filter(p => p.status === 'remind').length;

  const resetUserData = useCallback(() => {
    setTopics({});
    setUserProgress({});
    setUserStats(defaultStats);
  }, []);

  return {
    topics,
    userProgress,
    userStats,
    loading,
    wrongCount,
    remindCount,
    setUserProgress,
    resetUserData,
  };
}

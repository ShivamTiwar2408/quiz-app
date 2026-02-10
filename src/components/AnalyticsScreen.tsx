import { useState, useEffect } from 'react';
import { fetchAnalytics, fetchAttempts, fetchSessions, AnalyticsData, AttemptRecord, SessionRecord } from '../api';

interface AnalyticsScreenProps {
  onBack: () => void;
}

type Tab = 'overview' | 'topics' | 'history' | 'sessions';

export function AnalyticsScreen({ onBack }: AnalyticsScreenProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [analyticsData, attemptsData, sessionsData] = await Promise.all([
      fetchAnalytics(),
      fetchAttempts(100),
      fetchSessions(30),
    ]);
    setAnalytics(analyticsData);
    setAttempts(attemptsData);
    setSessions(sessionsData);
    setLoading(false);
  };

  const formatTime = (ms: number) => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="app">
        <header className="app-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h1>Analytics</h1>
        </header>
        <main className="analytics-content">
          <div className="loading-spinner"><div className="spinner" /></div>
        </main>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="app">
        <header className="app-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h1>Analytics</h1>
        </header>
        <main className="analytics-content">
          <p>Failed to load analytics. Please try again.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h1>📊 Analytics</h1>
      </header>

      <div className="analytics-tabs">
        {(['overview', 'topics', 'history', 'sessions'] as Tab[]).map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' && '📈 Overview'}
            {tab === 'topics' && '📚 Topics'}
            {tab === 'history' && '📝 History'}
            {tab === 'sessions' && '🎯 Sessions'}
          </button>
        ))}
      </div>

      <main className="analytics-content">
        {activeTab === 'overview' && (
          <div className="analytics-overview">
            <div className="stats-grid">
              <div className="stat-card primary">
                <span className="stat-value">{analytics.overview.totalAttempts}</span>
                <span className="stat-label">Total Attempts</span>
              </div>
              <div className="stat-card success">
                <span className="stat-value">{analytics.overview.overallAccuracy}%</span>
                <span className="stat-label">Accuracy</span>
              </div>
              <div className="stat-card warning">
                <span className="stat-value">{analytics.overview.currentStreak}</span>
                <span className="stat-label">Day Streak</span>
              </div>
              <div className="stat-card info">
                <span className="stat-value">{formatTime(analytics.overview.totalStudyTimeMs)}</span>
                <span className="stat-label">Study Time</span>
              </div>
            </div>

            <div className="section-card">
              <h3>📅 Due for Review</h3>
              <div className="due-stats">
                <div className="due-item overdue">
                  <span className="due-count">{analytics.dueForReview.overdue}</span>
                  <span className="due-label">Overdue</span>
                </div>
                <div className="due-item today">
                  <span className="due-count">{analytics.dueForReview.dueToday}</span>
                  <span className="due-label">Due Today</span>
                </div>
                <div className="due-item week">
                  <span className="due-count">{analytics.dueForReview.dueThisWeek}</span>
                  <span className="due-label">This Week</span>
                </div>
              </div>
            </div>

            <div className="section-card">
              <h3>🎯 Learning Status</h3>
              <div className="status-bars">
                <div className="status-bar">
                  <span className="status-label">Mastered</span>
                  <div className="bar-container">
                    <div className="bar mastered" style={{ width: `${(analytics.statusCounts.mastered / analytics.overview.totalQuestions) * 100}%` }} />
                  </div>
                  <span className="status-count">{analytics.statusCounts.mastered}</span>
                </div>
                <div className="status-bar">
                  <span className="status-label">Reviewing</span>
                  <div className="bar-container">
                    <div className="bar reviewing" style={{ width: `${(analytics.statusCounts.reviewing / analytics.overview.totalQuestions) * 100}%` }} />
                  </div>
                  <span className="status-count">{analytics.statusCounts.reviewing}</span>
                </div>
                <div className="status-bar">
                  <span className="status-label">Learning</span>
                  <div className="bar-container">
                    <div className="bar learning" style={{ width: `${(analytics.statusCounts.learning / analytics.overview.totalQuestions) * 100}%` }} />
                  </div>
                  <span className="status-count">{analytics.statusCounts.learning}</span>
                </div>
                <div className="status-bar">
                  <span className="status-label">Struggling</span>
                  <div className="bar-container">
                    <div className="bar struggling" style={{ width: `${(analytics.statusCounts.struggling / analytics.overview.totalQuestions) * 100}%` }} />
                  </div>
                  <span className="status-count">{analytics.statusCounts.struggling}</span>
                </div>
                <div className="status-bar">
                  <span className="status-label">New</span>
                  <div className="bar-container">
                    <div className="bar new" style={{ width: `${(analytics.statusCounts.new / analytics.overview.totalQuestions) * 100}%` }} />
                  </div>
                  <span className="status-count">{analytics.statusCounts.new}</span>
                </div>
              </div>
            </div>

            <div className="section-card">
              <h3>📆 Daily Activity (Last 14 Days)</h3>
              <div className="activity-chart">
                {analytics.dailyActivity.map((day, idx) => (
                  <div key={idx} className="activity-bar-wrapper">
                    <div 
                      className="activity-bar" 
                      style={{ height: `${Math.min(day.attempts * 5, 100)}%` }}
                      title={`${day.date}: ${day.attempts} attempts, ${day.correct} correct`}
                    />
                    <span className="activity-label">{day.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'topics' && (
          <div className="analytics-topics">
            {analytics.topicAnalytics.length === 0 ? (
              <p className="empty-state">No topic data yet. Start practicing!</p>
            ) : (
              analytics.topicAnalytics.map((topic, idx) => (
                <div key={idx} className="topic-card">
                  <div className="topic-header">
                    <h4>{topic.topic}</h4>
                    <span className={`accuracy-badge ${topic.accuracy >= 80 ? 'high' : topic.accuracy >= 60 ? 'medium' : 'low'}`}>
                      {topic.accuracy}%
                    </span>
                  </div>
                  <div className="topic-stats">
                    <span>📝 {topic.attempted}/{topic.totalQuestions} attempted</span>
                    <span>✅ {topic.mastered} mastered</span>
                    <span>⚠️ {topic.struggling} struggling</span>
                  </div>
                  <div className="topic-progress">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${(topic.attempted / topic.totalQuestions) * 100}%` }} />
                    </div>
                  </div>
                  {topic.lastStudied && (
                    <span className="last-studied">Last studied: {formatDate(topic.lastStudied)}</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="analytics-history">
            {attempts.length === 0 ? (
              <p className="empty-state">No attempts yet. Start a quiz!</p>
            ) : (
              <div className="attempts-list">
                {attempts.map((attempt, idx) => (
                  <div key={idx} className={`attempt-item ${attempt.isCorrect ? 'correct' : 'incorrect'}`}>
                    <div className="attempt-icon">{attempt.isCorrect ? '✅' : '❌'}</div>
                    <div className="attempt-details">
                      <span className="attempt-topic">{attempt.topic} › {attempt.subtopic}</span>
                      <span className="attempt-meta">
                        Confidence: {attempt.confidenceRating}/5 • {formatTime(attempt.responseTimeMs)} • {attempt.difficulty}
                      </span>
                    </div>
                    <span className="attempt-time">{formatDate(attempt.attemptedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="analytics-sessions">
            {sessions.length === 0 ? (
              <p className="empty-state">No quiz sessions yet.</p>
            ) : (
              <div className="sessions-list">
                {sessions.map((session, idx) => (
                  <div key={idx} className="session-item">
                    <div className="session-header">
                      <span className="session-type">{session.quizType}</span>
                      <span className={`session-accuracy ${session.accuracy >= 80 ? 'high' : session.accuracy >= 60 ? 'medium' : 'low'}`}>
                        {session.accuracy}%
                      </span>
                    </div>
                    <div className="session-details">
                      <span>📝 {session.correctAnswers}/{session.questionsAnswered} correct</span>
                      {session.topic && <span>📚 {session.topic}</span>}
                    </div>
                    <span className="session-time">{formatDate(session.startedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

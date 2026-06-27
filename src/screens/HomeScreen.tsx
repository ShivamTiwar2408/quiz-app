import { memo } from 'react';
import { QuizMode, TopicsMap, UserStats, Note } from '../types';
import { Header, Sidebar } from '../components';
import { QUIZ_TYPE_INFO } from '../constants';

interface HomeScreenProps {
  user: { email: string };
  topics: TopicsMap;
  userStats: UserStats;
  wrongCount: number;
  remindCount: number;
  notes: Note[];
  loading: boolean;
  menuOpen: boolean;
  onMenuOpen: () => void;
  onMenuClose: () => void;
  onSignOut: () => void;
  onStartQuiz: (mode: QuizMode, topic?: string, subtopic?: string) => void;
  onOpenNotes: () => void;
  onOpenAnalytics: () => void;
}

export const HomeScreen = memo(function HomeScreen({
  user,
  topics,
  userStats,
  wrongCount,
  remindCount,
  notes,
  loading,
  menuOpen,
  onMenuOpen,
  onMenuClose,
  onSignOut,
  onStartQuiz,
  onOpenNotes,
  onOpenAnalytics,
}: HomeScreenProps) {
  const topicKeys = Object.keys(topics);
  const overdueCount = userStats.overdueCount || 0;
  const dueToday = userStats.dueToday || 0;
  const totalDue = overdueCount + dueToday;
  const accuracy = userStats.totalAnswered > 0 
    ? Math.round((userStats.totalCorrect / userStats.totalAnswered) * 100) 
    : 0;

  const renderLoadingOverlay = () => loading && (
    <div className="loading-overlay">
      <div className="loading-spinner">
        <div className="spinner" />
        <span className="loading-text">Loading...</span>
      </div>
    </div>
  );

  const renderSidebar = () => (
    <>
      <Sidebar
        isOpen={menuOpen}
        topics={topics}
        userEmail={user.email}
        wrongCount={wrongCount}
        remindCount={remindCount}
        notesCount={notes.length}
        onClose={onMenuClose}
        onSignOut={onSignOut}
        onStartQuiz={onStartQuiz}
        onOpenNotes={onOpenNotes}
      />
      {menuOpen && <div className="overlay" onClick={onMenuClose} />}
    </>
  );

  return (
    <div className="app">
      {renderLoadingOverlay()}
      {renderSidebar()}
      <Header onMenuOpen={onMenuOpen} />
      <main className="home-content">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-greeting">
            <h1>Welcome back, {user.email.split('@')[0]}!</h1>
            <p className="hero-subtitle">Ready to level up your system design skills?</p>
          </div>
          
          <button 
            className="hero-cta" 
            onClick={() => onStartQuiz(totalDue > 0 ? 'spaced_review' : 'adaptive')} 
            disabled={loading}
          >
            <div className="hero-cta-content">
              <span className="hero-cta-icon">{totalDue > 0 ? '📅' : '🎯'}</span>
              <div className="hero-cta-text">
                <span className="hero-cta-title">
                  {loading ? 'Loading...' : totalDue > 0 ? `Review ${totalDue} Due Questions` : 'Start Smart Quiz'}
                </span>
                <span className="hero-cta-subtitle">
                  {totalDue > 0 
                    ? `${overdueCount > 0 ? `${overdueCount} overdue` : ''}${overdueCount > 0 && dueToday > 0 ? ' • ' : ''}${dueToday > 0 ? `${dueToday} due today` : ''}`
                    : 'Adaptive questions based on your progress'}
                </span>
              </div>
            </div>
            <span className="hero-cta-arrow">→</span>
          </button>
        </section>

        {/* Stats Overview */}
        <section className="stats-section">
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-value green">{userStats.masteredCount || userStats.totalKnown || 0}</span>
              <span className="stat-label">Mastered</span>
            </div>
            <div className="stat-card">
              <span className="stat-value blue">{userStats.reviewingCount || 0}</span>
              <span className="stat-label">Learning</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{accuracy}%</span>
              <span className="stat-label">Accuracy</span>
            </div>
            <div className="stat-card">
              <span className="stat-value orange">{userStats.currentDailyStreak || 0}🔥</span>
              <span className="stat-label">Streak</span>
            </div>
          </div>
        </section>

        {/* Quiz Modes */}
        <section className="modes-section">
          <h2 className="section-title">Practice Modes</h2>
          <div className="modes-grid">
            {Object.entries(QUIZ_TYPE_INFO).slice(0, 4).map(([type, info]) => (
              <button 
                key={type} 
                className={`mode-card ${type}`}
                onClick={() => onStartQuiz(type as QuizMode)}
              >
                <span className="mode-icon">{info.icon}</span>
                <div className="mode-text">
                  <span className="mode-name">{info.name}</span>
                  <span className="mode-desc">{info.description}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="modes-secondary">
            {Object.entries(QUIZ_TYPE_INFO).slice(4).map(([type, info]) => (
              <button 
                key={type} 
                className="mode-btn-secondary"
                onClick={() => onStartQuiz(type as QuizMode)}
              >
                <span>{info.icon}</span>
                <span>{info.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Quick Access */}
        <section className="quick-section">
          <h2 className="section-title">Quick Access</h2>
          <div className="quick-grid">
            <button className="quick-card" onClick={onMenuOpen}>
              <span className="quick-icon">📚</span>
              <span className="quick-label">Browse Topics</span>
              <span className="quick-meta">{topicKeys.length} topics</span>
            </button>
            <button className="quick-card" onClick={onOpenAnalytics}>
              <span className="quick-icon">📊</span>
              <span className="quick-label">Analytics</span>
              <span className="quick-meta">View progress</span>
            </button>
            <button className="quick-card" onClick={onOpenNotes}>
              <span className="quick-icon">📝</span>
              <span className="quick-label">Notes</span>
              <span className="quick-meta">{notes.length} notes</span>
            </button>
          </div>
        </section>

        {/* Weak Areas Alert */}
        {wrongCount > 0 && (
          <section className="alert-section">
            <button className="alert-card" onClick={() => onStartQuiz('weak_area')}>
              <div className="alert-content">
                <span className="alert-icon">💪</span>
                <div className="alert-text">
                  <span className="alert-title">{wrongCount} questions need practice</span>
                  <span className="alert-subtitle">Focus on your weak areas to improve</span>
                </div>
              </div>
              <span className="alert-action">Practice →</span>
            </button>
          </section>
        )}

      </main>
    </div>
  );
});

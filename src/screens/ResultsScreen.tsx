import { memo } from 'react';
import { TopicsMap, Note, QuizState, QuizMode } from '../types';
import { Header, Sidebar } from '../components';
import { PASSING_SCORE_PERCENT } from '../constants';

interface QuizFilter {
  topic?: string;
  subtopic?: string;
}

interface QuizMetadata {
  overdueCount: number;
  newCount: number;
  reviewCount: number;
  difficultyDistribution: Record<string, number>;
}

interface ResultsScreenProps {
  user: { email: string };
  topics: TopicsMap;
  wrongCount: number;
  remindCount: number;
  notes: Note[];
  loading: boolean;
  menuOpen: boolean;
  quizState: QuizState;
  currentFilter: QuizFilter;
  quizMetadata: QuizMetadata | null;
  questionsLength: number;
  onMenuOpen: () => void;
  onMenuClose: () => void;
  onSignOut: () => void;
  onStartQuiz: (mode: QuizMode, topic?: string, subtopic?: string) => void;
  onOpenNotes: () => void;
  onGoHome: () => void;
}

export const ResultsScreen = memo(function ResultsScreen({
  user,
  topics,
  wrongCount,
  remindCount,
  notes,
  loading,
  menuOpen,
  quizState,
  currentFilter,
  quizMetadata,
  questionsLength,
  onMenuOpen,
  onMenuClose,
  onSignOut,
  onStartQuiz,
  onOpenNotes,
  onGoHome,
}: ResultsScreenProps) {
  const pct = Math.round((quizState.score / questionsLength) * 100);
  const passed = pct >= PASSING_SCORE_PERCENT;

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
      <main className="results-content">
        <div className="results-card">
          <div className={`score-display ${passed ? 'passed' : 'failed'}`}>
            <span className="score-percent">{pct}%</span>
            <span className="score-label">{passed ? 'Great Job!' : 'Keep Practicing'}</span>
          </div>
          <div className="score-breakdown">
            <div className="breakdown-item correct">
              <span className="breakdown-count">{quizState.score}</span>
              <span className="breakdown-label">Correct</span>
            </div>
            <div className="breakdown-item incorrect">
              <span className="breakdown-count">{questionsLength - quizState.score}</span>
              <span className="breakdown-label">Incorrect</span>
            </div>
          </div>
          {currentFilter.topic && (
            <div className="quiz-filter-info">
              Topic: {currentFilter.topic}
              {currentFilter.subtopic && ` > ${currentFilter.subtopic}`}
            </div>
          )}
          {quizMetadata && (
            <div className="quiz-metadata">
              <span className="meta-item">📊 {quizMetadata.newCount} new</span>
              <span className="meta-item">🔄 {quizMetadata.reviewCount} review</span>
              {quizMetadata.overdueCount > 0 && (
                <span className="meta-item overdue">⚠️ {quizMetadata.overdueCount} were overdue</span>
              )}
            </div>
          )}
        </div>
        <div className="results-actions">
          <button 
            className="action-btn primary" 
            onClick={() => onStartQuiz('adaptive', currentFilter.topic, currentFilter.subtopic)}
          >
            Continue Learning
          </button>
          {questionsLength - quizState.score > 0 && (
            <button className="action-btn danger" onClick={() => onStartQuiz('weak_area')}>
              Practice Weak Areas
            </button>
          )}
          <button className="action-btn ghost" onClick={onGoHome}>
            Back to Home
          </button>
        </div>
      </main>
    </div>
  );
});

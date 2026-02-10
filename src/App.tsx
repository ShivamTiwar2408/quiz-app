import { useState, useCallback } from 'react';
import { QuizMode } from './types';
import { useAuth, useQuiz, useUserData, useNotes } from './hooks';
import { AuthScreen, Header, QuizHeader, QuizQuestion, Sidebar, NotesScreen, AnalyticsScreen, QuestionManager } from './components';
import { SCREENS, PASSING_SCORE_PERCENT, QUIZ_TYPE_INFO } from './constants';
import './App.css';

type Screen = typeof SCREENS[keyof typeof SCREENS] | 'analytics' | 'questions';

function App() {
  const auth = useAuth();
  const userData = useUserData(auth.user);
  const quiz = useQuiz();
  const notesHook = useNotes(auth.user);
  
  const [screen, setScreen] = useState<Screen>(SCREENS.HOME);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = useCallback(() => {
    auth.handleSignOut();
    userData.resetUserData();
    quiz.resetQuiz();
    setScreen(SCREENS.HOME);
  }, [auth, userData, quiz]);

  const handleStartQuiz = useCallback(async (mode: QuizMode, topic?: string, subtopic?: string) => {
    setMenuOpen(false);
    const success = await quiz.startQuiz(mode, topic, subtopic);
    if (success) {
      setScreen(SCREENS.QUIZ);
    } else {
      alert('No questions available for this selection.');
    }
  }, [quiz]);

  const handleNextQuestion = useCallback(() => {
    const quizEnded = quiz.nextQuestion();
    if (quizEnded) {
      setScreen(SCREENS.RESULTS);
    }
  }, [quiz]);

  const handleConfidenceSubmit = useCallback((rating: number) => {
    quiz.submitAnswerWithConfidence(rating);
  }, [quiz]);

  const handleProgressMark = useCallback((status: 'remind' | 'known') => {
    quiz.handleProgressMark(status, userData.userProgress, userData.setUserProgress);
  }, [quiz, userData.userProgress, userData.setUserProgress]);

  if (auth.authLoading) {
    return <div className="app auth-screen"><div className="auth-loading">Loading...</div></div>;
  }

  if (!auth.user) {
    return (
      <AuthScreen
        authScreen={auth.authScreen}
        authError={auth.authError}
        pendingEmail={auth.pendingEmail}
        onSignUp={auth.handleSignUp}
        onSignIn={auth.handleSignIn}
        onConfirm={auth.handleConfirm}
        onScreenChange={auth.setAuthScreen}
        onClearError={auth.clearError}
      />
    );
  }

  const isLoading = userData.loading || quiz.loading;

  const renderLoadingOverlay = () => isLoading && (
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
        topics={userData.topics}
        userEmail={auth.user!.email}
        wrongCount={userData.wrongCount}
        remindCount={userData.remindCount}
        notesCount={notesHook.notes.length}
        onClose={() => setMenuOpen(false)}
        onSignOut={handleSignOut}
        onStartQuiz={handleStartQuiz}
        onOpenNotes={() => {
          setMenuOpen(false);
          setScreen(SCREENS.NOTES);
        }}
      />
      {menuOpen && <div className="overlay" onClick={() => setMenuOpen(false)} />}
    </>
  );

  if (screen === SCREENS.NOTES) {
    return (
      <NotesScreen
        notes={notesHook.notes}
        loading={notesHook.loading}
        onCreateNote={async (data) => {
          await notesHook.createNote(data);
        }}
        onUpdateNote={async (data) => {
          await notesHook.updateNote(data);
        }}
        onDeleteNote={async (noteId) => {
          await notesHook.removeNote(noteId);
        }}
        onTogglePin={notesHook.togglePin}
        onBack={() => setScreen(SCREENS.HOME)}
      />
    );
  }

  if (screen === 'analytics') {
    return <AnalyticsScreen onBack={() => setScreen(SCREENS.HOME)} />;
  }

  if (screen === 'questions') {
    return <QuestionManager onBack={() => setScreen(SCREENS.HOME)} />;
  }

  if (screen === SCREENS.HOME) {
    const topicKeys = Object.keys(userData.topics);
    const overdueCount = userData.userStats.overdueCount || 0;
    const dueToday = userData.userStats.dueToday || 0;
    const totalDue = overdueCount + dueToday;
    const accuracy = userData.userStats.totalAnswered > 0 
      ? Math.round((userData.userStats.totalCorrect / userData.userStats.totalAnswered) * 100) 
      : 0;
    
    return (
      <div className="app">
        {renderLoadingOverlay()}
        {renderSidebar()}
        <Header onMenuOpen={() => setMenuOpen(true)} />
        <main className="home-content">
          {/* Hero Section */}
          <section className="hero-section">
            <div className="hero-greeting">
              <h1>Welcome back, {auth.user.email.split('@')[0]}!</h1>
              <p className="hero-subtitle">Ready to level up your system design skills?</p>
            </div>
            
            {/* Primary CTA */}
            <button className="hero-cta" onClick={() => handleStartQuiz(totalDue > 0 ? 'spaced_review' : 'adaptive')} disabled={quiz.loading}>
              <div className="hero-cta-content">
                <span className="hero-cta-icon">{totalDue > 0 ? '📅' : '🎯'}</span>
                <div className="hero-cta-text">
                  <span className="hero-cta-title">
                    {quiz.loading ? 'Loading...' : totalDue > 0 ? `Review ${totalDue} Due Questions` : 'Start Smart Quiz'}
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
                <span className="stat-value green">{userData.userStats.masteredCount || userData.userStats.totalKnown || 0}</span>
                <span className="stat-label">Mastered</span>
              </div>
              <div className="stat-card">
                <span className="stat-value blue">{userData.userStats.reviewingCount || 0}</span>
                <span className="stat-label">Learning</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{accuracy}%</span>
                <span className="stat-label">Accuracy</span>
              </div>
              <div className="stat-card">
                <span className="stat-value orange">{userData.userStats.currentDailyStreak || 0}🔥</span>
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
                  onClick={() => handleStartQuiz(type as QuizMode)}
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
                  onClick={() => handleStartQuiz(type as QuizMode)}
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
              <button className="quick-card" onClick={() => setMenuOpen(true)}>
                <span className="quick-icon">📚</span>
                <span className="quick-label">Browse Topics</span>
                <span className="quick-meta">{topicKeys.length} topics</span>
              </button>
              <button className="quick-card" onClick={() => setScreen('analytics')}>
                <span className="quick-icon">📊</span>
                <span className="quick-label">Analytics</span>
                <span className="quick-meta">View progress</span>
              </button>
              <button className="quick-card" onClick={() => setScreen(SCREENS.NOTES)}>
                <span className="quick-icon">📝</span>
                <span className="quick-label">Notes</span>
                <span className="quick-meta">{notesHook.notes.length} notes</span>
              </button>
              <button className="quick-card" onClick={() => setScreen('questions')}>
                <span className="quick-icon">✏️</span>
                <span className="quick-label">My Questions</span>
                <span className="quick-meta">Custom quiz</span>
              </button>
            </div>
          </section>

          {/* Weak Areas Alert */}
          {userData.wrongCount > 0 && (
            <section className="alert-section">
              <button className="alert-card" onClick={() => handleStartQuiz('weak_area')}>
                <div className="alert-content">
                  <span className="alert-icon">💪</span>
                  <div className="alert-text">
                    <span className="alert-title">{userData.wrongCount} questions need practice</span>
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
  }

  if (screen === SCREENS.RESULTS) {
    const pct = Math.round((quiz.quizState.score / quiz.questions.length) * 100);
    const passed = pct >= PASSING_SCORE_PERCENT;
    return (
      <div className="app">
        {renderLoadingOverlay()}
        {renderSidebar()}
        <Header onMenuOpen={() => setMenuOpen(true)} />
        <main className="results-content">
          <div className="results-card">
            <div className={`score-display ${passed ? 'passed' : 'failed'}`}>
              <span className="score-percent">{pct}%</span>
              <span className="score-label">{passed ? 'Great Job!' : 'Keep Practicing'}</span>
            </div>
            <div className="score-breakdown">
              <div className="breakdown-item correct">
                <span className="breakdown-count">{quiz.quizState.score}</span>
                <span className="breakdown-label">Correct</span>
              </div>
              <div className="breakdown-item incorrect">
                <span className="breakdown-count">{quiz.questions.length - quiz.quizState.score}</span>
                <span className="breakdown-label">Incorrect</span>
              </div>
            </div>
            {quiz.currentFilter.topic && (
              <div className="quiz-filter-info">
                Topic: {quiz.currentFilter.topic}
                {quiz.currentFilter.subtopic && ` > ${quiz.currentFilter.subtopic}`}
              </div>
            )}
            {quiz.quizMetadata && (
              <div className="quiz-metadata">
                <span className="meta-item">📊 {quiz.quizMetadata.newCount} new</span>
                <span className="meta-item">🔄 {quiz.quizMetadata.reviewCount} review</span>
                {quiz.quizMetadata.overdueCount > 0 && (
                  <span className="meta-item overdue">⚠️ {quiz.quizMetadata.overdueCount} were overdue</span>
                )}
              </div>
            )}
          </div>
          <div className="results-actions">
            <button className="action-btn primary" onClick={() => handleStartQuiz('adaptive', quiz.currentFilter.topic, quiz.currentFilter.subtopic)}>
              Continue Learning
            </button>
            {quiz.questions.length - quiz.quizState.score > 0 && (
              <button className="action-btn danger" onClick={() => handleStartQuiz('weak_area')}>
                Practice Weak Areas
              </button>
            )}
            <button className="action-btn ghost" onClick={() => setScreen(SCREENS.HOME)}>
              Back to Home
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      {renderLoadingOverlay()}
      {renderSidebar()}
      <QuizHeader
        onMenuOpen={() => setMenuOpen(true)}
        currentQuestion={quiz.quizState.currentQuestionIndex + 1}
        totalQuestions={quiz.questions.length}
        score={quiz.quizState.score}
      />
      <main className="quiz-content">
        {quiz.currentQuestion && (
          <QuizQuestion
            question={quiz.currentQuestion}
            questionNumber={quiz.quizState.currentQuestionIndex + 1}
            totalQuestions={quiz.questions.length}
            selectedAnswers={quiz.quizState.selectedAnswers}
            showResult={quiz.quizState.showResult}
            showExplanation={quiz.showExplanation}
            userProgress={userData.userProgress}
            onAnswerSelect={quiz.handleAnswerSelect}
            onProgressMark={handleProgressMark}
            onConfidenceSubmit={handleConfidenceSubmit}
          />
        )}
      </main>
      <footer className="quiz-footer">
        {!quiz.quizState.showResult ? (
          <button className="submit-btn" onClick={quiz.submitAnswer} disabled={quiz.quizState.selectedAnswers.length === 0}>
            Check Answer
          </button>
        ) : (
          <button className="next-btn" onClick={handleNextQuestion}>
            {quiz.quizState.currentQuestionIndex < quiz.questions.length - 1 ? 'Next Question' : 'See Results'}
          </button>
        )}
      </footer>
    </div>
  );
}

export default App;

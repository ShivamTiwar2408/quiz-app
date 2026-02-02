import { useState, useCallback } from 'react';
import { QuizMode } from './types';
import { useAuth, useQuiz, useUserData, useNotes } from './hooks';
import { AuthScreen, Header, QuizHeader, QuizQuestion, Sidebar, NotesScreen } from './components';
import { SCREENS, PASSING_SCORE_PERCENT } from './constants';
import './App.css';

type Screen = typeof SCREENS[keyof typeof SCREENS];

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
      alert('No questions available.');
    }
  }, [quiz]);

  const handleNextQuestion = useCallback(() => {
    const quizEnded = quiz.nextQuestion();
    if (quizEnded) {
      setScreen(SCREENS.RESULTS);
    }
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

  if (screen === SCREENS.HOME) {
    const topicKeys = Object.keys(userData.topics);
    const hasReviewItems = userData.wrongCount > 0 || userData.remindCount > 0;
    
    return (
      <div className="app">
        {renderLoadingOverlay()}
        {renderSidebar()}
        <Header onMenuOpen={() => setMenuOpen(true)} />
        <main className="home-content">
          {/* Greeting */}
          <div className="greeting">
            <span className="greeting-wave">👋</span>
            <h1>Hey {auth.user.email.split('@')[0]}</h1>
          </div>

          {/* Main CTA */}
          <button className="main-cta" onClick={() => handleStartQuiz('smart')} disabled={quiz.loading}>
            <div className="cta-content">
              <span className="cta-icon">🎯</span>
              <div className="cta-text">
                <span className="cta-title">{quiz.loading ? 'Loading...' : 'Start Quiz'}</span>
                <span className="cta-subtitle">Smart questions based on your progress</span>
              </div>
            </div>
            <span className="cta-arrow">›</span>
          </button>

          {/* Quick Actions */}
          <div className="quick-actions-grid">
            <button className="quick-action" onClick={() => setScreen(SCREENS.NOTES)}>
              <span className="qa-icon">📝</span>
              <span className="qa-label">Notes</span>
              {notesHook.notes.length > 0 && <span className="qa-badge">{notesHook.notes.length}</span>}
            </button>
            <button className="quick-action" onClick={() => handleStartQuiz('notes')}>
              <span className="qa-icon">🧠</span>
              <span className="qa-label">Quiz Notes</span>
            </button>
            <button className="quick-action" onClick={() => handleStartQuiz('random')}>
              <span className="qa-icon">🎲</span>
              <span className="qa-label">Random</span>
            </button>
            <button className="quick-action" onClick={() => setMenuOpen(true)}>
              <span className="qa-icon">📚</span>
              <span className="qa-label">Topics</span>
              <span className="qa-badge">{topicKeys.length}</span>
            </button>
          </div>

          {/* Review Section - Only show if there are items to review */}
          {hasReviewItems && (
            <div className="review-section">
              <h2>Needs Review</h2>
              <div className="review-cards">
                {userData.wrongCount > 0 && (
                  <button className="review-card wrong" onClick={() => handleStartQuiz('wrong')}>
                    <div className="rc-left">
                      <span className="rc-icon">❌</span>
                      <div className="rc-info">
                        <span className="rc-count">{userData.wrongCount}</span>
                        <span className="rc-label">Wrong answers</span>
                      </div>
                    </div>
                    <span className="rc-action">Practice →</span>
                  </button>
                )}
                {userData.remindCount > 0 && (
                  <button className="review-card remind" onClick={() => handleStartQuiz('remind')}>
                    <div className="rc-left">
                      <span className="rc-icon">🔔</span>
                      <div className="rc-info">
                        <span className="rc-count">{userData.remindCount}</span>
                        <span className="rc-label">To review</span>
                      </div>
                    </div>
                    <span className="rc-action">Review →</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Progress Stats */}
          <div className="progress-section">
            <h2>Your Progress</h2>
            <div className="progress-stats">
              <div className="progress-stat">
                <span className="ps-value green">{userData.userStats.totalKnown}</span>
                <span className="ps-label">Mastered</span>
              </div>
              <div className="progress-stat">
                <span className="ps-value">{userData.userStats.totalAnswered}</span>
                <span className="ps-label">Answered</span>
              </div>
              <div className="progress-stat">
                <span className="ps-value">{topicKeys.length}</span>
                <span className="ps-label">Topics</span>
              </div>
            </div>
          </div>
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
          </div>
          <div className="results-actions">
            <button className="action-btn primary" onClick={() => handleStartQuiz('smart', quiz.currentFilter.topic, quiz.currentFilter.subtopic)}>
              Try Again
            </button>
            {quiz.questions.length - quiz.quizState.score > 0 && (
              <button className="action-btn danger" onClick={() => handleStartQuiz('wrong')}>
                Practice Wrong Answers
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

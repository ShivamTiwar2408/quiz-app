import { useState, useCallback } from 'react';
import { QuizMode } from './types';
import { useAuth, useQuiz, useUserData } from './hooks';
import { AuthScreen, Header, QuizHeader, QuizQuestion, Sidebar } from './components';
import { SCREENS, PASSING_SCORE_PERCENT } from './constants';
import './App.css';

type Screen = typeof SCREENS[keyof typeof SCREENS];

function App() {
  const auth = useAuth();
  const userData = useUserData(auth.user);
  const quiz = useQuiz();
  
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

  const renderSidebar = () => (
    <>
      <Sidebar
        isOpen={menuOpen}
        topics={userData.topics}
        userEmail={auth.user!.email}
        wrongCount={userData.wrongCount}
        remindCount={userData.remindCount}
        onClose={() => setMenuOpen(false)}
        onSignOut={handleSignOut}
        onStartQuiz={handleStartQuiz}
      />
      {menuOpen && <div className="overlay" onClick={() => setMenuOpen(false)} />}
    </>
  );

  if (screen === SCREENS.HOME) {
    return (
      <div className="app">
        {renderSidebar()}
        <Header onMenuOpen={() => setMenuOpen(true)} />
        <main className="home-content">
          <div className="hero-section">
            <h1>Welcome, {auth.user.email.split('@')[0]}!</h1>
            <p className="hero-subtitle">Master system design with intelligent quizzes</p>
          </div>
          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-number">{Object.keys(userData.topics).length}</span>
              <span className="stat-label">Topics</span>
            </div>
            <div className="stat-item">
              <span className="stat-number green">{userData.userStats.totalKnown}</span>
              <span className="stat-label">Mastered</span>
            </div>
            <div className="stat-item">
              <span className="stat-number orange">{userData.userStats.totalRemind}</span>
              <span className="stat-label">To Review</span>
            </div>
            <div className="stat-item">
              <span className="stat-number red">{userData.wrongCount}</span>
              <span className="stat-label">Need Practice</span>
            </div>
          </div>
          <div className="quiz-options">
            <button className="quiz-btn primary" onClick={() => handleStartQuiz('smart')} disabled={quiz.loading}>
              <span className="btn-icon">🎯</span>
              <span className="btn-label">{quiz.loading ? 'Loading...' : 'Smart Quiz'}</span>
              <span className="btn-meta">AI-powered question selection</span>
            </button>
            {userData.wrongCount > 0 && (
              <button className="quiz-btn danger" onClick={() => handleStartQuiz('wrong')}>
                <span className="btn-icon">❌</span>
                <span className="btn-label">Practice Wrong Answers</span>
                <span className="btn-meta">{userData.wrongCount} questions to review</span>
              </button>
            )}
            {userData.remindCount > 0 && (
              <button className="quiz-btn secondary" onClick={() => handleStartQuiz('remind')}>
                <span className="btn-icon">🔔</span>
                <span className="btn-label">Reminder Quiz</span>
                <span className="btn-meta">{userData.remindCount} marked for review</span>
              </button>
            )}
            <button className="quiz-btn tertiary" onClick={() => handleStartQuiz('random')}>
              <span className="btn-icon">🎲</span>
              <span className="btn-label">Random Quiz</span>
              <span className="btn-meta">Test yourself on anything</span>
            </button>
          </div>
          <div className="topics-preview">
            <h3>Browse by Topic</h3>
            <div className="topics-grid">
              {Object.keys(userData.topics).slice(0, 6).map(t => (
                <button key={t} className="topic-card" onClick={() => handleStartQuiz('smart', t)}>
                  {t}
                </button>
              ))}
              {Object.keys(userData.topics).length > 6 && (
                <button className="topic-card more" onClick={() => setMenuOpen(true)}>
                  +{Object.keys(userData.topics).length - 6} more
                </button>
              )}
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

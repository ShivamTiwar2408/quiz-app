import { useState, useCallback, useMemo } from 'react';
import { QuizMode } from './types';
import { useAuth, useQuiz, useUserData, useNotes } from './hooks';
import { AuthScreen, NotesScreen, AnalyticsScreen, ErrorBoundary } from './components';
import { HomeScreen, QuizScreen, ResultsScreen } from './screens';
import { SCREENS } from './constants';
import './App.css';

type Screen = typeof SCREENS[keyof typeof SCREENS] | 'analytics';

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

  const handleMenuOpen = useCallback(() => setMenuOpen(true), []);
  const handleMenuClose = useCallback(() => setMenuOpen(false), []);
  const handleOpenNotes = useCallback(() => {
    setMenuOpen(false);
    setScreen(SCREENS.NOTES);
  }, []);
  const handleOpenAnalytics = useCallback(() => setScreen('analytics'), []);
  const handleGoHome = useCallback(() => setScreen(SCREENS.HOME), []);

  // Memoized loading state
  const isLoading = useMemo(() => userData.loading || quiz.loading, [userData.loading, quiz.loading]);

  // Auth loading state
  if (auth.authLoading) {
    return <div className="app auth-screen"><div className="auth-loading">Loading...</div></div>;
  }

  // Not authenticated
  if (!auth.user) {
    return (
      <ErrorBoundary>
        <AuthScreen
          authError={auth.authError}
          authLoading={auth.authLoading}
          onGoogleSignIn={auth.handleGoogleSignIn}
        />
      </ErrorBoundary>
    );
  }

  // Notes screen
  if (screen === SCREENS.NOTES) {
    return (
      <ErrorBoundary>
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
          onBack={handleGoHome}
        />
      </ErrorBoundary>
    );
  }

  // Analytics screen
  if (screen === 'analytics') {
    return (
      <ErrorBoundary>
        <AnalyticsScreen onBack={handleGoHome} />
      </ErrorBoundary>
    );
  }

  // Home screen
  if (screen === SCREENS.HOME) {
    return (
      <ErrorBoundary>
        <HomeScreen
          user={auth.user}
          topics={userData.topics}
          userStats={userData.userStats}
          wrongCount={userData.wrongCount}
          remindCount={userData.remindCount}
          notes={notesHook.notes}
          loading={isLoading}
          menuOpen={menuOpen}
          onMenuOpen={handleMenuOpen}
          onMenuClose={handleMenuClose}
          onSignOut={handleSignOut}
          onStartQuiz={handleStartQuiz}
          onOpenNotes={handleOpenNotes}
          onOpenAnalytics={handleOpenAnalytics}
        />
      </ErrorBoundary>
    );
  }

  // Results screen
  if (screen === SCREENS.RESULTS) {
    return (
      <ErrorBoundary>
        <ResultsScreen
          user={auth.user}
          topics={userData.topics}
          wrongCount={userData.wrongCount}
          remindCount={userData.remindCount}
          notes={notesHook.notes}
          loading={isLoading}
          menuOpen={menuOpen}
          quizState={quiz.quizState}
          currentFilter={quiz.currentFilter}
          quizMetadata={quiz.quizMetadata}
          questionsLength={quiz.questions.length}
          onMenuOpen={handleMenuOpen}
          onMenuClose={handleMenuClose}
          onSignOut={handleSignOut}
          onStartQuiz={handleStartQuiz}
          onOpenNotes={handleOpenNotes}
          onGoHome={handleGoHome}
        />
      </ErrorBoundary>
    );
  }

  // Quiz screen (default)
  return (
    <ErrorBoundary>
      <QuizScreen
        user={auth.user}
        topics={userData.topics}
        wrongCount={userData.wrongCount}
        remindCount={userData.remindCount}
        notes={notesHook.notes}
        loading={isLoading}
        menuOpen={menuOpen}
        currentQuestion={quiz.currentQuestion}
        quizState={quiz.quizState}
        showExplanation={quiz.showExplanation}
        userProgress={userData.userProgress}
        onMenuOpen={handleMenuOpen}
        onMenuClose={handleMenuClose}
        onSignOut={handleSignOut}
        onStartQuiz={handleStartQuiz}
        onOpenNotes={handleOpenNotes}
        onAnswerSelect={quiz.handleAnswerSelect}
        onProgressMark={handleProgressMark}
        onConfidenceSubmit={handleConfidenceSubmit}
        onSubmitAnswer={quiz.submitAnswer}
        onNextQuestion={handleNextQuestion}
        questionsLength={quiz.questions.length}
      />
    </ErrorBoundary>
  );
}

export default App;

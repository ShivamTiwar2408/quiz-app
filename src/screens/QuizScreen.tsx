import { memo } from 'react';
import { Question, UserProgress, TopicsMap, Note, QuizState, QuizMode } from '../types';
import { QuizHeader, QuizQuestion, Sidebar } from '../components';

interface QuizScreenProps {
  user: { email: string };
  topics: TopicsMap;
  wrongCount: number;
  remindCount: number;
  notes: Note[];
  loading: boolean;
  menuOpen: boolean;
  currentQuestion: Question | undefined;
  quizState: QuizState;
  showExplanation: boolean;
  userProgress: Record<string, UserProgress>;
  onMenuOpen: () => void;
  onMenuClose: () => void;
  onSignOut: () => void;
  onStartQuiz: (mode: QuizMode, topic?: string, subtopic?: string) => void;
  onOpenNotes: () => void;
  onAnswerSelect: (answer: string) => void;
  onProgressMark: (status: 'remind' | 'known') => void;
  onConfidenceSubmit: (rating: number) => void;
  onSubmitAnswer: () => void;
  onNextQuestion: () => void;
  questionsLength: number;
}

export const QuizScreen = memo(function QuizScreen({
  user,
  topics,
  wrongCount,
  remindCount,
  notes,
  loading,
  menuOpen,
  currentQuestion,
  quizState,
  showExplanation,
  userProgress,
  onMenuOpen,
  onMenuClose,
  onSignOut,
  onStartQuiz,
  onOpenNotes,
  onAnswerSelect,
  onProgressMark,
  onConfidenceSubmit,
  onSubmitAnswer,
  onNextQuestion,
  questionsLength,
}: QuizScreenProps) {
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
      <QuizHeader
        onMenuOpen={onMenuOpen}
        currentQuestion={quizState.currentQuestionIndex + 1}
        totalQuestions={questionsLength}
        score={quizState.score}
      />
      <main className="quiz-content">
        {currentQuestion && (
          <QuizQuestion
            key={currentQuestion.id}
            question={currentQuestion}
            questionNumber={quizState.currentQuestionIndex + 1}
            totalQuestions={questionsLength}
            selectedAnswers={quizState.selectedAnswers}
            showResult={quizState.showResult}
            showExplanation={showExplanation}
            userProgress={userProgress}
            onAnswerSelect={onAnswerSelect}
            onProgressMark={onProgressMark}
            onConfidenceSubmit={onConfidenceSubmit}
          />
        )}
      </main>
      <footer className="quiz-footer">
        {!quizState.showResult ? (
          <button 
            className="submit-btn" 
            onClick={onSubmitAnswer} 
            disabled={quizState.selectedAnswers.length === 0}
          >
            Check Answer
          </button>
        ) : (
          <button className="next-btn" onClick={onNextQuestion}>
            {quizState.currentQuestionIndex < questionsLength - 1 ? 'Next Question' : 'See Results'}
          </button>
        )}
      </footer>
    </div>
  );
});

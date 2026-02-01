import React from 'react';

interface HeaderProps {
  onMenuOpen: () => void;
  children?: React.ReactNode;
}

export function Header({ onMenuOpen, children }: HeaderProps) {
  return (
    <header className="header">
      <button className="hamburger" onClick={onMenuOpen}>
        <span></span>
        <span></span>
        <span></span>
      </button>
      {children || <div className="logo">System Design Quiz</div>}
    </header>
  );
}

interface QuizHeaderProps {
  onMenuOpen: () => void;
  currentQuestion: number;
  totalQuestions: number;
  score: number;
}

export function QuizHeader({ onMenuOpen, currentQuestion, totalQuestions, score }: QuizHeaderProps) {
  const progressPercent = ((currentQuestion) / totalQuestions) * 100;

  return (
    <Header onMenuOpen={onMenuOpen}>
      <div className="quiz-progress">
        <span className="progress-text">{currentQuestion} / {totalQuestions}</span>
        <div className="progress-track small">
          <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
      <div className="score-indicator">{score} pts</div>
    </Header>
  );
}

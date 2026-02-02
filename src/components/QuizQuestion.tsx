import { useState } from 'react';
import { Question, UserProgress } from '../types';

type FeedbackStatus = 'remind' | 'known' | 'review' | 'review-explanation';

interface QuizQuestionProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswers: string[];
  showResult: boolean;
  showExplanation: boolean;
  userProgress: Record<string, UserProgress>;
  onAnswerSelect: (letter: string) => void;
  onProgressMark: (status: 'remind' | 'known') => void;
}

export function QuizQuestion({
  question,
  questionNumber,
  selectedAnswers,
  showResult,
  showExplanation,
  onAnswerSelect,
  onProgressMark,
}: QuizQuestionProps) {
  const isMultiSelect = question.correct_answers.length > 1;
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackStatus | null>(null);

  const handleFeedback = (status: FeedbackStatus) => {
    setSelectedFeedback(status);
    // Map review options to the backend status - non-blocking fire-and-forget
    const backendStatus = status === 'review' || status === 'review-explanation' ? 'remind' : status;
    onProgressMark(backendStatus as 'remind' | 'known');
  };

  return (
    <>
      <div className="question-container">
        <div className="question-meta">
          <span className="question-topic">{question.topic}</span>
          <span className="question-subtopic">{question.subtopic}</span>
        </div>
        <div className="question-header">
          <span className="question-number">{questionNumber}</span>
          <span className="question-type">
            {isMultiSelect ? 'Select All That Apply' : 'Single Choice'}
          </span>
        </div>
        <h2 className="question-text">{question.question}</h2>
        
        <div className="options-container">
          {Object.entries(question.options).map(([letter, option]) => {
            const isSelected = selectedAnswers.includes(letter);
            const isCorrect = question.correct_answers.includes(letter);
            
            let className = 'option-item';
            if (isSelected && !showResult) className += ' selected';
            if (showResult && isCorrect) className += ' correct';
            if (showResult && isSelected && !isCorrect) className += ' incorrect';

            return (
              <button
                key={letter}
                className={className}
                onClick={() => onAnswerSelect(letter)}
                disabled={showResult}
              >
                <span className={`option-indicator ${isMultiSelect ? 'checkbox' : 'radio'}`}>
                  {showResult ? (
                    isCorrect ? '✓' : isSelected ? '✗' : null
                  ) : (
                    isSelected && <span className="indicator-dot" />
                  )}
                </span>
                <span className="option-letter">{letter}.</span>
                <span className="option-content">{option}</span>
              </button>
            );
          })}
        </div>
      </div>

      {showExplanation && (
        <div className="explanation-container">
          <div className="explanation-header">
            <span className="explanation-icon">💡</span>
            <span>Explanation</span>
          </div>
          <p className="explanation-text">{question.explanation}</p>
          <div className="learning-tracker">
            <span className="tracker-label">How well do you know this?</span>
            <div className="tracker-buttons">
              <button
                className={`tracker-btn remind ${selectedFeedback === 'remind' ? 'active' : ''}`}
                onClick={() => handleFeedback('remind')}
              >
                🔔 Reminded Me
              </button>
              <button
                className={`tracker-btn known ${selectedFeedback === 'known' ? 'active' : ''}`}
                onClick={() => handleFeedback('known')}
              >
                ✅ I Know It
              </button>
              <button
                className={`tracker-btn review ${selectedFeedback === 'review' ? 'active' : ''}`}
                onClick={() => handleFeedback('review')}
              >
                📝 Review
              </button>
              <button
                className={`tracker-btn explanation ${selectedFeedback === 'review-explanation' ? 'active' : ''}`}
                onClick={() => handleFeedback('review-explanation')}
              >
                📖 Review Explanation
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useState } from 'react';
import { Question, UserProgress } from '../types';

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
  onConfidenceSubmit?: (rating: number) => void;
}

// SM-2 Confidence Scale (0-5)
const CONFIDENCE_OPTIONS = [
  { rating: 0, label: 'Blackout', emoji: '😵', description: 'Complete blank' },
  { rating: 1, label: 'Wrong', emoji: '😰', description: 'Recognized after seeing answer' },
  { rating: 2, label: 'Hard', emoji: '😓', description: 'Struggled significantly' },
  { rating: 3, label: 'Okay', emoji: '🤔', description: 'Correct with effort' },
  { rating: 4, label: 'Good', emoji: '😊', description: 'Correct with slight hesitation' },
  { rating: 5, label: 'Easy', emoji: '🎯', description: 'Perfect instant recall' },
];

export function QuizQuestion({
  question,
  questionNumber,
  selectedAnswers,
  showResult,
  showExplanation,
  onAnswerSelect,
  onProgressMark,
  onConfidenceSubmit,
}: QuizQuestionProps) {
  const isMultiSelect = question.correct_answers.length > 1;
  const [selectedConfidence, setSelectedConfidence] = useState<number | null>(null);
  const [hasSubmittedConfidence, setHasSubmittedConfidence] = useState(false);

  const handleConfidenceSelect = (rating: number) => {
    setSelectedConfidence(rating);
    setHasSubmittedConfidence(true);
    
    // Call the new confidence submit if available
    if (onConfidenceSubmit) {
      onConfidenceSubmit(rating);
    } else {
      // Fall back to legacy progress mark
      const status = rating >= 4 ? 'known' : 'remind';
      onProgressMark(status);
    }
  };

  // Determine if answer was correct
  const isCorrect = showResult && 
    question.correct_answers.length === selectedAnswers.length && 
    question.correct_answers.every(c => selectedAnswers.includes(c));

  return (
    <>
      <div className="question-container">
        <div className="question-meta">
          <span className="question-topic">{question.topic}</span>
          <span className="question-subtopic">{question.subtopic}</span>
          {question.difficulty && (
            <span className={`question-difficulty ${question.difficulty}`}>
              {question.difficulty}
            </span>
          )}
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
            const isCorrectOption = question.correct_answers.includes(letter);
            
            let className = 'option-item';
            if (isSelected && !showResult) className += ' selected';
            if (showResult && isCorrectOption) className += ' correct';
            if (showResult && isSelected && !isCorrectOption) className += ' incorrect';

            return (
              <button
                key={letter}
                className={className}
                onClick={() => onAnswerSelect(letter)}
                disabled={showResult}
              >
                <span className={`option-indicator ${isMultiSelect ? 'checkbox' : 'radio'}`}>
                  {showResult ? (
                    isCorrectOption ? '✓' : isSelected ? '✗' : null
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
          {/* Result Banner */}
          <div className={`result-banner ${isCorrect ? 'correct' : 'incorrect'}`}>
            <span className="result-icon">{isCorrect ? '✅' : '❌'}</span>
            <span className="result-text">{isCorrect ? 'Correct!' : 'Incorrect'}</span>
          </div>

          {/* Explanation */}
          <div className="explanation-section">
            <div className="explanation-header">
              <span className="explanation-icon">💡</span>
              <span>Explanation</span>
            </div>
            <p className="explanation-text">{question.explanation}</p>
          </div>

          {/* SM-2 Confidence Rating */}
          <div className="confidence-section">
            <div className="confidence-header">
              <span className="confidence-icon">🧠</span>
              <span>How well did you know this?</span>
            </div>
            <p className="confidence-subtitle">
              Rate your recall to optimize your learning schedule
            </p>
            <div className="confidence-grid">
              {CONFIDENCE_OPTIONS.map((option) => (
                <button
                  key={option.rating}
                  className={`confidence-btn ${selectedConfidence === option.rating ? 'selected' : ''} ${hasSubmittedConfidence && selectedConfidence !== option.rating ? 'faded' : ''}`}
                  onClick={() => !hasSubmittedConfidence && handleConfidenceSelect(option.rating)}
                  disabled={hasSubmittedConfidence}
                >
                  <span className="confidence-emoji">{option.emoji}</span>
                  <span className="confidence-label">{option.label}</span>
                  <span className="confidence-rating">{option.rating}</span>
                </button>
              ))}
            </div>
            {hasSubmittedConfidence && selectedConfidence !== null && (
              <div className="confidence-feedback">
                <span className="feedback-icon">✓</span>
                <span>
                  {selectedConfidence >= 4 
                    ? "Great! This will be reviewed less frequently."
                    : selectedConfidence >= 2
                    ? "Got it! This will come up again soon."
                    : "No worries! We'll help you master this."}
                </span>
              </div>
            )}
          </div>

          {/* Related Concepts */}
          {question.relatedConcepts && question.relatedConcepts.length > 0 && (
            <div className="related-concepts">
              <span className="related-label">Related concepts:</span>
              <div className="related-tags">
                {question.relatedConcepts.map((concept, idx) => (
                  <span key={idx} className="related-tag">{concept}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

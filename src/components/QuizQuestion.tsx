import { useState, useEffect } from 'react';
import { Question, UserProgress } from '../types';
import { hideQuestion } from '../api';

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
  onQuestionHidden?: (questionId: string) => void;
  onQuestionFeedback?: (questionId: string, feedback: string) => void;
}

// SM-2 Confidence Scale (0-5) - compact version
const CONFIDENCE_OPTIONS = [
  { rating: 0, emoji: '😵' },
  { rating: 1, emoji: '😰' },
  { rating: 2, emoji: '😓' },
  { rating: 3, emoji: '🤔' },
  { rating: 4, emoji: '😊' },
  { rating: 5, emoji: '🎯' },
];

// Simple thumbs feedback component
function ThumbsFeedback({ 
  id, 
  type,
  onFeedback 
}: { 
  id: string; 
  type: 'question' | 'options' | 'explanation';
  onFeedback?: (id: string, type: string, rating: 'good' | 'bad') => void;
}) {
  const [rating, setRating] = useState<'good' | 'bad' | null>(null);

  const handleRate = (value: 'good' | 'bad') => {
    if (rating) return;
    setRating(value);
    onFeedback?.(id, type, value);
  };

  return (
    <span className="thumbs-feedback">
      <button 
        className={`thumb-btn ${rating === 'good' ? 'selected' : ''} ${rating && rating !== 'good' ? 'faded' : ''}`}
        onClick={(e) => { e.stopPropagation(); handleRate('good'); }}
        disabled={rating !== null}
        title="Good"
      >
        👍
      </button>
      <button 
        className={`thumb-btn ${rating === 'bad' ? 'selected' : ''} ${rating && rating !== 'bad' ? 'faded' : ''}`}
        onClick={(e) => { e.stopPropagation(); handleRate('bad'); }}
        disabled={rating !== null}
        title="Bad"
      >
        👎
      </button>
    </span>
  );
}

export function QuizQuestion({
  question,
  questionNumber,
  selectedAnswers,
  showResult,
  showExplanation,
  onAnswerSelect,
  onProgressMark,
  onConfidenceSubmit,
  onQuestionHidden,
  onQuestionFeedback,
}: QuizQuestionProps) {
  const isMultiSelect = question.correct_answers.length > 1;
  const [selectedConfidence, setSelectedConfidence] = useState<number | null>(null);
  const [hasSubmittedConfidence, setHasSubmittedConfidence] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [showHideConfirm, setShowHideConfirm] = useState(false);
  const [feedbackKey, setFeedbackKey] = useState(0);

  // Reset all state when question changes
  useEffect(() => {
    setSelectedConfidence(null);
    setHasSubmittedConfidence(false);
    setShowHideConfirm(false);
    setFeedbackKey(prev => prev + 1);
  }, [question.id]);

  const handleConfidenceSelect = (rating: number) => {
    setSelectedConfidence(rating);
    setHasSubmittedConfidence(true);
    
    if (onConfidenceSubmit) {
      onConfidenceSubmit(rating);
    } else {
      const status = rating >= 4 ? 'known' : 'remind';
      onProgressMark(status);
    }
  };

  const handleHideQuestion = async () => {
    setIsHiding(true);
    const success = await hideQuestion(
      question.id,
      question.topic,
      question.subtopic,
      'User marked as not useful'
    );
    setIsHiding(false);
    setShowHideConfirm(false);
    
    if (success && onQuestionHidden) {
      onQuestionHidden(question.id);
    }
  };

  const handleFeedback = (id: string, type: string, rating: 'good' | 'bad') => {
    if (onQuestionFeedback) {
      onQuestionFeedback(id, `${type}_${rating}`);
    }
  };

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
          <button 
            className="hide-question-btn"
            onClick={() => setShowHideConfirm(true)}
            title="Hide this question from future quizzes"
          >
            🚫
          </button>
        </div>
        
        {showHideConfirm && (
          <div className="hide-confirm-banner">
            <span>Hide this question from future quizzes?</span>
            <div className="hide-confirm-actions">
              <button 
                className="hide-confirm-yes" 
                onClick={handleHideQuestion}
                disabled={isHiding}
              >
                {isHiding ? 'Hiding...' : 'Yes, hide it'}
              </button>
              <button 
                className="hide-confirm-no" 
                onClick={() => setShowHideConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        
        <div className="question-header">
          <span className="question-number">{questionNumber}</span>
          <span className="question-type">
            {isMultiSelect ? 'Select All That Apply' : 'Single Choice'}
          </span>
        </div>
        
        <div className="question-text-row">
          <h2 className="question-text">{question.question}</h2>
          {showExplanation && (
            <ThumbsFeedback 
              key={`q-${feedbackKey}`}
              id={question.id} 
              type="question" 
              onFeedback={handleFeedback} 
            />
          )}
        </div>
        
        <div className="options-container">
          {Object.entries(question.options).map(([letter, option]) => {
            const isSelected = selectedAnswers.includes(letter);
            const isCorrectOption = question.correct_answers.includes(letter);
            
            let className = 'option-item';
            if (isSelected && !showResult) className += ' selected';
            if (showResult && isCorrectOption) className += ' correct';
            if (showResult && isSelected && !isCorrectOption) className += ' incorrect';

            return (
              <div key={letter} className="option-row-wrapper">
                <button
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
                {showExplanation && (
                  <ThumbsFeedback 
                    key={`o-${letter}-${feedbackKey}`}
                    id={`${question.id}-${letter}`} 
                    type="options" 
                    onFeedback={handleFeedback} 
                  />
                )}
              </div>
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

          {/* Explanation with thumbs */}
          <div className="explanation-section">
            <div className="explanation-header">
              <div className="explanation-title">
                <span className="explanation-icon">💡</span>
                <span>Explanation</span>
              </div>
              <ThumbsFeedback 
                key={`e-${feedbackKey}`}
                id={question.id} 
                type="explanation" 
                onFeedback={handleFeedback} 
              />
            </div>
            <p className="explanation-text">{question.explanation}</p>
          </div>

          {/* SM-2 Confidence Rating - Compact */}
          <div className="confidence-section-compact">
            <span className="confidence-label-inline">How well did you know this?</span>
            <div className="confidence-row">
              {CONFIDENCE_OPTIONS.map((option) => (
                <button
                  key={option.rating}
                  className={`confidence-btn-compact ${selectedConfidence === option.rating ? 'selected' : ''} ${hasSubmittedConfidence && selectedConfidence !== option.rating ? 'faded' : ''}`}
                  onClick={() => !hasSubmittedConfidence && handleConfidenceSelect(option.rating)}
                  disabled={hasSubmittedConfidence}
                  title={`${option.rating}/5`}
                >
                  {option.emoji}
                </button>
              ))}
            </div>
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

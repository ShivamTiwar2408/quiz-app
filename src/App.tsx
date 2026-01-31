import React, { useState, useEffect, useCallback } from 'react';
import { Question, UserProgress, QuizState } from './types';
import { fetchQuestions, saveProgress, getProgress } from './api';
import './App.css';

const QUESTIONS_PER_QUIZ = 10;

function App() {
  const [screen, setScreen] = useState<'home' | 'quiz' | 'results'>('home');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [quizState, setQuizState] = useState<QuizState>({
    currentQuestionIndex: 0,
    selectedAnswers: [],
    showResult: false,
    score: 0,
    answers: [],
  });
  const [userProgress, setUserProgress] = useState<Record<string, UserProgress>>({});
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      const progress = await getProgress();
      setUserProgress(progress);
      const qs = await fetchQuestions(100);
      setAllQuestions(qs);
    };
    loadInitialData();
  }, []);

  const startQuiz = useCallback(async (mode: 'all' | 'remind' | 'new') => {
    setLoading(true);
    try {
      let availableQuestions = [...allQuestions];
      if (mode === 'remind') {
        const remindIds = Object.entries(userProgress).filter(([, p]) => p.status === 'remind').map(([id]) => id);
        availableQuestions = availableQuestions.filter(q => remindIds.includes(q.id));
      } else if (mode === 'new') {
        const answeredIds = Object.keys(userProgress);
        availableQuestions = availableQuestions.filter(q => !answeredIds.includes(q.id));
      }
      if (availableQuestions.length === 0) availableQuestions = [...allQuestions];
      const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5);
      setQuestions(shuffled.slice(0, QUESTIONS_PER_QUIZ));
      setQuizState({ currentQuestionIndex: 0, selectedAnswers: [], showResult: false, score: 0, answers: [] });
      setShowExplanation(false);
      setScreen('quiz');
    } finally {
      setLoading(false);
    }
  }, [allQuestions, userProgress]);

  const currentQuestion = questions[quizState.currentQuestionIndex];
  const isMultiSelect = currentQuestion?.correct_answers.length > 1;

  const handleAnswerSelect = (letter: string) => {
    if (quizState.showResult) return;
    setQuizState(prev => {
      if (isMultiSelect) {
        const newSelected = prev.selectedAnswers.includes(letter) ? prev.selectedAnswers.filter(a => a !== letter) : [...prev.selectedAnswers, letter];
        return { ...prev, selectedAnswers: newSelected };
      }
      return { ...prev, selectedAnswers: [letter] };
    });
  };

  const submitAnswer = () => {
    const correct = currentQuestion.correct_answers;
    const selected = quizState.selectedAnswers;
    const isCorrect = correct.length === selected.length && correct.every(c => selected.includes(c));
    const newAnswer = { questionId: currentQuestion.id, selected, correct: isCorrect };
    setQuizState(prev => ({ ...prev, showResult: true, score: isCorrect ? prev.score + 1 : prev.score, answers: [...prev.answers, newAnswer] }));
    setShowExplanation(true);
  };

  const handleProgressMark = async (status: 'remind' | 'known') => {
    const progress: UserProgress = { questionId: currentQuestion.id, status, answeredCorrectly: quizState.answers[quizState.answers.length - 1]?.correct || false };
    setUserProgress(prev => ({ ...prev, [currentQuestion.id]: progress }));
    await saveProgress(progress);
  };

  const nextQuestion = () => {
    if (quizState.currentQuestionIndex < questions.length - 1) {
      setQuizState(prev => ({ ...prev, currentQuestionIndex: prev.currentQuestionIndex + 1, selectedAnswers: [], showResult: false }));
      setShowExplanation(false);
    } else {
      setScreen('results');
    }
  };

  const stats = { total: allQuestions.length, known: Object.values(userProgress).filter(p => p.status === 'known').length, remind: Object.values(userProgress).filter(p => p.status === 'remind').length };

  if (screen === 'home') {
    return (
      <div className="app">
        <header className="header"><div className="logo">System Design Quiz</div></header>
        <main className="home-content">
          <div className="hero-section"><h1>System Design Quiz</h1><p className="hero-subtitle">Test your system design knowledge</p></div>
          <div className="stats-row">
            <div className="stat-item"><span className="stat-number">{stats.total}</span><span className="stat-label">Questions</span></div>
            <div className="stat-item"><span className="stat-number green">{stats.known}</span><span className="stat-label">Mastered</span></div>
            <div className="stat-item"><span className="stat-number orange">{stats.remind}</span><span className="stat-label">To Review</span></div>
          </div>
          <div className="quiz-options">
            <button className="quiz-btn primary" onClick={() => startQuiz('all')} disabled={loading || allQuestions.length === 0}><span className="btn-label">{loading ? 'Loading...' : 'Start Quiz'}</span><span className="btn-meta">{QUESTIONS_PER_QUIZ} random questions</span></button>
            {stats.remind > 0 && (<button className="quiz-btn secondary" onClick={() => startQuiz('remind')}><span className="btn-label">Review Mode</span><span className="btn-meta">{stats.remind} questions to review</span></button>)}
            {stats.total - Object.keys(userProgress).length > 0 && (<button className="quiz-btn tertiary" onClick={() => startQuiz('new')}><span className="btn-label">New Questions</span><span className="btn-meta">{stats.total - Object.keys(userProgress).length} unseen</span></button>)}
          </div>
          <div className="progress-section"><div className="progress-header"><span>Progress</span><span>{stats.total > 0 ? Math.round((stats.known / stats.total) * 100) : 0}%</span></div><div className="progress-track"><div className="progress-bar green" style={{ width: stats.total > 0 ? (stats.known / stats.total) * 100 + '%' : '0%' }} /></div></div>
        </main>
      </div>
    );
  }

  if (screen === 'results') {
    const percentage = Math.round((quizState.score / questions.length) * 100);
    const passed = percentage >= 70;
    return (
      <div className="app">
        <header className="header"><div className="logo">System Design Quiz</div></header>
        <main className="results-content">
          <div className="results-card">
            <div className={'score-display ' + (passed ? 'passed' : 'failed')}><span className="score-percent">{percentage}%</span><span className="score-label">{passed ? 'Passed!' : 'Keep Practicing'}</span></div>
            <div className="score-breakdown"><div className="breakdown-item correct"><span className="breakdown-count">{quizState.score}</span><span className="breakdown-label">Correct</span></div><div className="breakdown-item incorrect"><span className="breakdown-count">{questions.length - quizState.score}</span><span className="breakdown-label">Incorrect</span></div></div>
            <div className="question-dots">{quizState.answers.map((answer, i) => (<div key={i} className={'dot ' + (answer.correct ? 'correct' : 'incorrect')} title={'Question ' + (i + 1)} />))}</div>
          </div>
          <div className="results-actions"><button className="action-btn primary" onClick={() => startQuiz('all')}>Try Again</button><button className="action-btn ghost" onClick={() => setScreen('home')}>Back to Home</button></div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <button className="back-btn" onClick={() => setScreen('home')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
        <div className="quiz-progress"><span className="progress-text">{quizState.currentQuestionIndex + 1} / {questions.length}</span><div className="progress-track small"><div className="progress-bar" style={{ width: ((quizState.currentQuestionIndex + 1) / questions.length) * 100 + '%' }} /></div></div>
        <div className="score-indicator">{quizState.score} pts</div>
      </header>
      <main className="quiz-content">
        <div className="question-container">
          <div className="question-header"><span className="question-number">{quizState.currentQuestionIndex + 1}</span><span className="question-type">{isMultiSelect ? 'Multiple Choice (Select All)' : 'Multiple Choice'}</span></div>
          <h2 className="question-text">{currentQuestion?.question}</h2>
          <div className="options-container">
            {currentQuestion && Object.entries(currentQuestion.options).map(([letter, option]) => {
              const isSelected = quizState.selectedAnswers.includes(letter);
              const isCorrect = currentQuestion.correct_answers.includes(letter);
              const showCorrectness = quizState.showResult;
              let optionClass = 'option-item';
              if (isSelected && !showCorrectness) optionClass += ' selected';
              if (showCorrectness && isCorrect) optionClass += ' correct';
              if (showCorrectness && isSelected && !isCorrect) optionClass += ' incorrect';
              return (<button key={letter} className={optionClass} onClick={() => handleAnswerSelect(letter)} disabled={quizState.showResult}><span className={'option-indicator ' + (isMultiSelect ? 'checkbox' : 'radio')}>{showCorrectness ? (isCorrect ? (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>) : isSelected ? (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>) : null) : (isSelected && <span className="indicator-dot" />)}</span><span className="option-letter">{letter}.</span><span className="option-content">{option}</span></button>);
            })}
          </div>
        </div>
        {showExplanation && (
          <div className="explanation-container">
            <div className="explanation-header"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span>Explanation</span></div>
            <p className="explanation-text">{currentQuestion?.explanation}</p>
            <div className="learning-tracker"><span className="tracker-label">Track your learning:</span><div className="tracker-buttons"><button className={'tracker-btn remind ' + (userProgress[currentQuestion?.id]?.status === 'remind' ? 'active' : '')} onClick={() => handleProgressMark('remind')}>Remind Me</button><button className={'tracker-btn known ' + (userProgress[currentQuestion?.id]?.status === 'known' ? 'active' : '')} onClick={() => handleProgressMark('known')}>I Know This</button></div></div>
          </div>
        )}
      </main>
      <footer className="quiz-footer">
        {!quizState.showResult ? (<button className="submit-btn" onClick={submitAnswer} disabled={quizState.selectedAnswers.length === 0}>Check Answer</button>) : (<button className="next-btn" onClick={nextQuestion}>{quizState.currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'See Results'}</button>)}
      </footer>
    </div>
  );
}

export default App;

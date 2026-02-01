import { useState, useEffect, useCallback } from 'react';
import { Question, UserProgress, UserStats, QuizState, TopicsMap, QuizMode } from './types';
import { fetchQuestions, fetchTopics, saveProgress, getProgress } from './api';
import './App.css';

const QUESTIONS_PER_QUIZ = 10;

function App() {
  const [screen, setScreen] = useState<'home' | 'quiz' | 'results'>('home');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState<TopicsMap>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [quizState, setQuizState] = useState<QuizState>({
    currentQuestionIndex: 0, selectedAnswers: [], showResult: false, score: 0, answers: [],
  });
  const [userProgress, setUserProgress] = useState<Record<string, UserProgress>>({});
  const [userStats, setUserStats] = useState<UserStats>({
    totalAnswered: 0, totalCorrect: 0, totalWrong: 0, totalKnown: 0, totalRemind: 0, topicStats: {},
  });
  const [showExplanation, setShowExplanation] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<{ topic?: string; subtopic?: string }>({});

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [topicsData, progressData] = await Promise.all([fetchTopics(), getProgress()]);
        setTopics(topicsData);
        setUserProgress(progressData.progress);
        setUserStats(progressData.stats);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const startQuiz = useCallback(async (mode: QuizMode, topic?: string, subtopic?: string) => {
    setLoading(true);
    setMenuOpen(false);
    try {
      const qs = await fetchQuestions({ count: QUESTIONS_PER_QUIZ, topic, subtopic, mode });
      if (qs.length === 0) { alert('No questions available.'); return; }
      setQuestions(qs);
      setCurrentFilter({ topic, subtopic });
      setQuizState({ currentQuestionIndex: 0, selectedAnswers: [], showResult: false, score: 0, answers: [] });
      setShowExplanation(false);
      setScreen('quiz');
    } finally { setLoading(false); }
  }, []);

  const toggleTopic = (topic: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      next.has(topic) ? next.delete(topic) : next.add(topic);
      return next;
    });
  };

  const currentQuestion = questions[quizState.currentQuestionIndex];
  const isMultiSelect = currentQuestion?.correct_answers.length > 1;

  const handleAnswerSelect = (letter: string) => {
    if (quizState.showResult) return;
    setQuizState(prev => {
      if (isMultiSelect) {
        const newSelected = prev.selectedAnswers.includes(letter)
          ? prev.selectedAnswers.filter(a => a !== letter) : [...prev.selectedAnswers, letter];
        return { ...prev, selectedAnswers: newSelected };
      }
      return { ...prev, selectedAnswers: [letter] };
    });
  };

  const submitAnswer = () => {
    const correct = currentQuestion.correct_answers;
    const selected = quizState.selectedAnswers;
    const isCorrect = correct.length === selected.length && correct.every(c => selected.includes(c));
    setQuizState(prev => ({
      ...prev, showResult: true, score: isCorrect ? prev.score + 1 : prev.score,
      answers: [...prev.answers, { questionId: currentQuestion.id, selected, correct: isCorrect }],
    }));
    setShowExplanation(true);
  };

  const handleProgressMark = async (status: 'remind' | 'known') => {
    const isCorrect = quizState.answers[quizState.answers.length - 1]?.correct || false;
    const finalStatus = !isCorrect ? 'wrong' : status;
    await saveProgress({
      questionId: currentQuestion.id, topic: currentQuestion.topic,
      subtopic: currentQuestion.subtopic, status: finalStatus, answeredCorrectly: isCorrect,
    });
    setUserProgress(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id], questionId: currentQuestion.id, status: finalStatus,
        answeredCorrectly: isCorrect,
        wrongCount: (prev[currentQuestion.id]?.wrongCount || 0) + (!isCorrect ? 1 : 0),
        correctCount: (prev[currentQuestion.id]?.correctCount || 0) + (isCorrect ? 1 : 0),
        remindCount: (prev[currentQuestion.id]?.remindCount || 0) + (status === 'remind' ? 1 : 0),
        knownCount: (prev[currentQuestion.id]?.knownCount || 0) + (status === 'known' ? 1 : 0),
      },
    }));
  };

  const nextQuestion = () => {
    if (quizState.currentQuestionIndex < questions.length - 1) {
      setQuizState(prev => ({ ...prev, currentQuestionIndex: prev.currentQuestionIndex + 1, selectedAnswers: [], showResult: false }));
      setShowExplanation(false);
    } else { setScreen('results'); }
  };

  const wrongCount = Object.values(userProgress).filter(p => p.wrongCount > 0).length;
  const remindCount = Object.values(userProgress).filter(p => p.status === 'remind').length;

  const Sidebar = () => (
    <div className={`sidebar \${menuOpen ? 'open' : ''}`}>
      <div className="sidebar-header"><h2>Topics</h2><button className="close-btn" onClick={() => setMenuOpen(false)}>×</button></div>
      <div className="sidebar-content">
        <div className="quick-actions">
          <button className="sidebar-action" onClick={() => startQuiz('smart')}><span className="action-icon">🎯</span> Smart Quiz</button>
          {wrongCount > 0 && <button className="sidebar-action wrong" onClick={() => startQuiz('wrong')}><span className="action-icon">❌</span> Review Wrong ({wrongCount})</button>}
          {remindCount > 0 && <button className="sidebar-action remind" onClick={() => startQuiz('remind')}><span className="action-icon">🔔</span> Remind Me ({remindCount})</button>}
        </div>
        <div className="topics-list">
          {Object.entries(topics).map(([topic, subtopics]) => (
            <div key={topic} className="topic-item">
              <div className="topic-header" onClick={() => toggleTopic(topic)}>
                <span className={`expand-icon \${expandedTopics.has(topic) ? 'expanded' : ''}`}>▶</span>
                <span className="topic-name">{topic}</span>
                <button className="topic-quiz-btn" onClick={(e) => { e.stopPropagation(); startQuiz('smart', topic); }}>Quiz</button>
              </div>
              {expandedTopics.has(topic) && <div className="subtopics-list">{subtopics.map(st => <div key={st} className="subtopic-item" onClick={() => startQuiz('smart', topic, st)}>{st}</div>)}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (screen === 'home') {
    return (
      <div className="app">
        <Sidebar />{menuOpen && <div className="overlay" onClick={() => setMenuOpen(false)} />}
        <header className="header"><button className="hamburger" onClick={() => setMenuOpen(true)}><span></span><span></span><span></span></button><div className="logo">System Design Quiz</div></header>
        <main className="home-content">
          <div className="hero-section"><h1>System Design Quiz</h1><p className="hero-subtitle">Master system design with intelligent quizzes</p></div>
          <div className="stats-row">
            <div className="stat-item"><span className="stat-number">{Object.keys(topics).length}</span><span className="stat-label">Topics</span></div>
            <div className="stat-item"><span className="stat-number green">{userStats.totalKnown}</span><span className="stat-label">Mastered</span></div>
            <div className="stat-item"><span className="stat-number orange">{userStats.totalRemind}</span><span className="stat-label">To Review</span></div>
            <div className="stat-item"><span className="stat-number red">{wrongCount}</span><span className="stat-label">Need Practice</span></div>
          </div>
          <div className="quiz-options">
            <button className="quiz-btn primary" onClick={() => startQuiz('smart')} disabled={loading}><span className="btn-icon">🎯</span><span className="btn-label">{loading ? 'Loading...' : 'Smart Quiz'}</span><span className="btn-meta">AI-powered question selection</span></button>
            {wrongCount > 0 && <button className="quiz-btn danger" onClick={() => startQuiz('wrong')}><span className="btn-icon">❌</span><span className="btn-label">Practice Wrong Answers</span><span className="btn-meta">{wrongCount} questions to review</span></button>}
            {remindCount > 0 && <button className="quiz-btn secondary" onClick={() => startQuiz('remind')}><span className="btn-icon">🔔</span><span className="btn-label">Reminder Quiz</span><span className="btn-meta">{remindCount} marked for review</span></button>}
            <button className="quiz-btn tertiary" onClick={() => startQuiz('random')}><span className="btn-icon">🎲</span><span className="btn-label">Random Quiz</span><span className="btn-meta">Test yourself on anything</span></button>
          </div>
          <div className="topics-preview"><h3>Browse by Topic</h3><div className="topics-grid">{Object.keys(topics).slice(0, 6).map(t => <button key={t} className="topic-card" onClick={() => startQuiz('smart', t)}>{t}</button>)}{Object.keys(topics).length > 6 && <button className="topic-card more" onClick={() => setMenuOpen(true)}>+{Object.keys(topics).length - 6} more</button>}</div></div>
        </main>
      </div>
    );
  }

  if (screen === 'results') {
    const pct = Math.round((quizState.score / questions.length) * 100);
    const passed = pct >= 70;
    return (
      <div className="app">
        <Sidebar />{menuOpen && <div className="overlay" onClick={() => setMenuOpen(false)} />}
        <header className="header"><button className="hamburger" onClick={() => setMenuOpen(true)}><span></span><span></span><span></span></button><div className="logo">System Design Quiz</div></header>
        <main className="results-content">
          <div className="results-card">
            <div className={`score-display \${passed ? 'passed' : 'failed'}`}><span className="score-percent">{pct}%</span><span className="score-label">{passed ? 'Great Job!' : 'Keep Practicing'}</span></div>
            <div className="score-breakdown"><div className="breakdown-item correct"><span className="breakdown-count">{quizState.score}</span><span className="breakdown-label">Correct</span></div><div className="breakdown-item incorrect"><span className="breakdown-count">{questions.length - quizState.score}</span><span className="breakdown-label">Incorrect</span></div></div>
            {currentFilter.topic && <div className="quiz-filter-info">Topic: {currentFilter.topic}{currentFilter.subtopic && ` > \${currentFilter.subtopic}`}</div>}
          </div>
          <div className="results-actions">
            <button className="action-btn primary" onClick={() => startQuiz('smart', currentFilter.topic, currentFilter.subtopic)}>Try Again</button>
            {questions.length - quizState.score > 0 && <button className="action-btn danger" onClick={() => startQuiz('wrong')}>Practice Wrong Answers</button>}
            <button className="action-btn ghost" onClick={() => setScreen('home')}>Back to Home</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar />{menuOpen && <div className="overlay" onClick={() => setMenuOpen(false)} />}
      <header className="header">
        <button className="hamburger" onClick={() => setMenuOpen(true)}><span></span><span></span><span></span></button>
        <div className="quiz-progress"><span className="progress-text">{quizState.currentQuestionIndex + 1} / {questions.length}</span><div className="progress-track small"><div className="progress-bar" style={{ width: `\${((quizState.currentQuestionIndex + 1) / questions.length) * 100}%` }} /></div></div>
        <div className="score-indicator">{quizState.score} pts</div>
      </header>
      <main className="quiz-content">
        <div className="question-container">
          <div className="question-meta"><span className="question-topic">{currentQuestion?.topic}</span><span className="question-subtopic">{currentQuestion?.subtopic}</span></div>
          <div className="question-header"><span className="question-number">{quizState.currentQuestionIndex + 1}</span><span className="question-type">{isMultiSelect ? 'Select All That Apply' : 'Single Choice'}</span></div>
          <h2 className="question-text">{currentQuestion?.question}</h2>
          <div className="options-container">
            {currentQuestion && Object.entries(currentQuestion.options).map(([letter, option]) => {
              const isSelected = quizState.selectedAnswers.includes(letter);
              const isCorrect = currentQuestion.correct_answers.includes(letter);
              const show = quizState.showResult;
              let cls = 'option-item';
              if (isSelected && !show) cls += ' selected';
              if (show && isCorrect) cls += ' correct';
              if (show && isSelected && !isCorrect) cls += ' incorrect';
              return <button key={letter} className={cls} onClick={() => handleAnswerSelect(letter)} disabled={show}><span className={`option-indicator \${isMultiSelect ? 'checkbox' : 'radio'}`}>{show ? (isCorrect ? '✓' : isSelected ? '✗' : null) : (isSelected && <span className="indicator-dot" />)}</span><span className="option-letter">{letter}.</span><span className="option-content">{option}</span></button>;
            })}
          </div>
        </div>
        {showExplanation && (
          <div className="explanation-container">
            <div className="explanation-header"><span className="explanation-icon">💡</span><span>Explanation</span></div>
            <p className="explanation-text">{currentQuestion?.explanation}</p>
            <div className="learning-tracker"><span className="tracker-label">How well do you know this?</span><div className="tracker-buttons"><button className={`tracker-btn remind \${userProgress[currentQuestion?.id]?.status === 'remind' ? 'active' : ''}`} onClick={() => handleProgressMark('remind')}>🔔 Remind Me Later</button><button className={`tracker-btn known \${userProgress[currentQuestion?.id]?.status === 'known' ? 'active' : ''}`} onClick={() => handleProgressMark('known')}>✅ I Know This</button></div></div>
          </div>
        )}
      </main>
      <footer className="quiz-footer">{!quizState.showResult ? <button className="submit-btn" onClick={submitAnswer} disabled={quizState.selectedAnswers.length === 0}>Check Answer</button> : <button className="next-btn" onClick={nextQuestion}>{quizState.currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'See Results'}</button>}</footer>
    </div>
  );
}

export default App;

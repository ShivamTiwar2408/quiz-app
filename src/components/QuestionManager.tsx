import { useState, useEffect, useRef } from 'react';
import { fetchCustomQuestions, createQuestion, updateQuestion, deleteQuestion, CustomQuestion, CreateQuestionParams } from '../api';

interface QuestionManagerProps {
  onBack: () => void;
}

type View = 'list' | 'create' | 'edit' | 'bulk-import';

const DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard'] as const;

interface BulkQuestion {
  question: string;
  options: Record<string, string>;
  correct_answers?: string[];
  correctOptions?: string[];
  explanation: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  topic?: string;
  subtopic?: string;
}

export function QuestionManager({ onBack }: QuestionManagerProps) {
  const [questions, setQuestions] = useState<CustomQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [editingQuestion, setEditingQuestion] = useState<CustomQuestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Bulk import state
  const [bulkJson, setBulkJson] = useState('');
  const [bulkTopic, setBulkTopic] = useState('');
  const [bulkSubtopic, setBulkSubtopic] = useState('');
  const [bulkPreview, setBulkPreview] = useState<BulkQuestion[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState<CreateQuestionParams>({
    topic: '',
    subtopic: '',
    question: '',
    options: { A: '', B: '', C: '', D: '' },
    correct_answers: [],
    explanation: '',
    difficulty: 'medium',
  });

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    setLoading(true);
    const data = await fetchCustomQuestions();
    setQuestions(data);
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      topic: '',
      subtopic: '',
      question: '',
      options: { A: '', B: '', C: '', D: '' },
      correct_answers: [],
      explanation: '',
      difficulty: 'medium',
    });
    setError(null);
  };

  const handleCreate = () => {
    resetForm();
    setView('create');
  };

  const handleEdit = (q: CustomQuestion) => {
    setEditingQuestion(q);
    setFormData({
      topic: q.topic,
      subtopic: q.subtopic,
      question: q.question,
      options: q.options,
      correct_answers: q.correct_answers,
      explanation: q.explanation,
      difficulty: q.difficulty,
    });
    setView('edit');
  };

  const handleDelete = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    
    const success = await deleteQuestion(questionId);
    if (success) {
      setQuestions(prev => prev.filter(q => q.questionId !== questionId));
    } else {
      setError('Failed to delete question');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Validation
      if (!formData.topic.trim()) throw new Error('Topic is required');
      if (!formData.subtopic.trim()) throw new Error('Subtopic is required');
      if (!formData.question.trim()) throw new Error('Question text is required');
      if (formData.correct_answers.length === 0) throw new Error('Select at least one correct answer');
      if (!formData.explanation.trim()) throw new Error('Explanation is required');

      // Check options
      const filledOptions = Object.entries(formData.options).filter(([, v]) => v.trim());
      if (filledOptions.length < 2) throw new Error('At least 2 options are required');

      // Clean options (remove empty ones)
      const cleanOptions: Record<string, string> = {};
      for (const [key, value] of Object.entries(formData.options)) {
        if (value.trim()) cleanOptions[key] = value.trim();
      }

      // Validate correct answers exist in options
      for (const answer of formData.correct_answers) {
        if (!cleanOptions[answer]) throw new Error(`Correct answer "${answer}" has no option text`);
      }

      const payload = { ...formData, options: cleanOptions };

      if (view === 'create') {
        const newQuestion = await createQuestion(payload);
        if (newQuestion) {
          setQuestions(prev => [newQuestion, ...prev]);
          setView('list');
          resetForm();
        }
      } else if (view === 'edit' && editingQuestion) {
        const updated = await updateQuestion(editingQuestion.questionId, payload);
        if (updated) {
          setQuestions(prev => prev.map(q => q.questionId === updated.questionId ? updated : q));
          setView('list');
          setEditingQuestion(null);
          resetForm();
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  const toggleCorrectAnswer = (letter: string) => {
    setFormData(prev => ({
      ...prev,
      correct_answers: prev.correct_answers.includes(letter)
        ? prev.correct_answers.filter(a => a !== letter)
        : [...prev.correct_answers, letter],
    }));
  };

  const updateOption = (letter: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      options: { ...prev.options, [letter]: value },
    }));
  };

  // Bulk import functions
  const handleBulkImport = () => {
    setBulkJson('');
    setBulkTopic('');
    setBulkSubtopic('');
    setBulkPreview([]);
    setError(null);
    setView('bulk-import');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setBulkJson(content);
      parseBulkJson(content);
    };
    reader.readAsText(file);
  };

  const parseBulkJson = (jsonStr: string) => {
    setError(null);
    setBulkPreview([]);

    if (!jsonStr.trim()) return;

    try {
      const parsed = JSON.parse(jsonStr);
      const questionsArray = Array.isArray(parsed) ? parsed : [parsed];
      
      // Validate structure
      const validated: BulkQuestion[] = [];
      for (let i = 0; i < questionsArray.length; i++) {
        const q = questionsArray[i];
        if (!q.question) throw new Error(`Question ${i + 1}: missing "question" field`);
        if (!q.options || typeof q.options !== 'object') throw new Error(`Question ${i + 1}: missing or invalid "options" field`);
        if (!q.explanation) throw new Error(`Question ${i + 1}: missing "explanation" field`);
        
        // Support both correct_answers and correctOptions
        const correctAnswers = q.correct_answers || q.correctOptions;
        if (!correctAnswers || !Array.isArray(correctAnswers) || correctAnswers.length === 0) {
          throw new Error(`Question ${i + 1}: missing "correct_answers" or "correctOptions" field`);
        }
        
        validated.push({
          ...q,
          correct_answers: correctAnswers,
        });
      }
      
      setBulkPreview(validated);
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON format. Please check your JSON syntax.');
      } else {
        setError(err.message);
      }
    }
  };

  const handleBulkSubmit = async () => {
    if (bulkPreview.length === 0) {
      setError('No valid questions to import');
      return;
    }

    if (!bulkTopic.trim()) {
      setError('Topic is required for bulk import');
      return;
    }

    if (!bulkSubtopic.trim()) {
      setError('Subtopic is required for bulk import');
      return;
    }

    setBulkImporting(true);
    setBulkProgress({ current: 0, total: bulkPreview.length });
    setError(null);

    const imported: CustomQuestion[] = [];
    const errors: string[] = [];

    for (let i = 0; i < bulkPreview.length; i++) {
      const q = bulkPreview[i];
      setBulkProgress({ current: i + 1, total: bulkPreview.length });

      try {
        const payload: CreateQuestionParams = {
          topic: q.topic || bulkTopic,
          subtopic: q.subtopic || bulkSubtopic,
          question: q.question,
          options: q.options,
          correct_answers: q.correct_answers || [],
          explanation: q.explanation,
          difficulty: q.difficulty || 'medium',
        };

        const created = await createQuestion(payload);
        if (created) {
          imported.push(created);
        } else {
          errors.push(`Question ${i + 1}: Failed to create`);
        }
      } catch (err: any) {
        errors.push(`Question ${i + 1}: ${err.message}`);
      }
    }

    setBulkImporting(false);

    if (imported.length > 0) {
      setQuestions(prev => [...imported, ...prev]);
    }

    if (errors.length > 0) {
      setError(`Imported ${imported.length}/${bulkPreview.length} questions. Errors:\n${errors.join('\n')}`);
    } else {
      setView('list');
      setBulkJson('');
      setBulkPreview([]);
    }
  };

  if (loading) {
    return (
      <div className="app">
        <header className="app-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h1>Question Manager</h1>
        </header>
        <main className="qm-content">
          <div className="loading-spinner"><div className="spinner" /></div>
        </main>
      </div>
    );
  }

  if (view === 'list') {
    return (
      <div className="app">
        <header className="app-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h1>✏️ My Questions</h1>
        </header>
        <main className="qm-content">
          <div className="qm-actions-row">
            <button className="create-btn" onClick={handleCreate}>
              ➕ Create New Question
            </button>
            <button className="create-btn bulk" onClick={handleBulkImport}>
              📥 Bulk Import JSON
            </button>
          </div>

          {questions.length === 0 ? (
            <div className="empty-state">
              <p>No custom questions yet.</p>
              <p>Create your own questions to practice!</p>
            </div>
          ) : (
            <div className="questions-list">
              {questions.map(q => (
                <div key={q.questionId} className="question-card">
                  <div className="qc-header">
                    <span className="qc-topic">{q.topic} › {q.subtopic}</span>
                    <span className={`qc-difficulty ${q.difficulty}`}>{q.difficulty}</span>
                  </div>
                  <p className="qc-text">{q.question}</p>
                  <div className="qc-options">
                    {Object.entries(q.options).map(([letter, text]) => (
                      <span key={letter} className={`qc-option ${q.correct_answers.includes(letter) ? 'correct' : ''}`}>
                        {letter}: {text.substring(0, 50)}{text.length > 50 ? '...' : ''}
                      </span>
                    ))}
                  </div>
                  <div className="qc-actions">
                    <button className="edit-btn" onClick={() => handleEdit(q)}>Edit</button>
                    <button className="delete-btn" onClick={() => handleDelete(q.questionId)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // Bulk Import view
  if (view === 'bulk-import') {
    return (
      <div className="app">
        <header className="app-header">
          <button className="back-btn" onClick={() => { setView('list'); setError(null); }}>← Cancel</button>
          <h1>📥 Bulk Import Questions</h1>
        </header>
        <main className="qm-content">
          <div className="bulk-import-form">
            {error && <div className="form-error" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}

            <div className="form-row">
              <div className="form-group">
                <label>Default Topic *</label>
                <input
                  type="text"
                  value={bulkTopic}
                  onChange={e => setBulkTopic(e.target.value)}
                  placeholder="e.g., System Design Scenarios"
                />
              </div>
              <div className="form-group">
                <label>Default Subtopic *</label>
                <input
                  type="text"
                  value={bulkSubtopic}
                  onChange={e => setBulkSubtopic(e.target.value)}
                  placeholder="e.g., Applied Scenarios"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Upload JSON File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="file-input"
              />
            </div>

            <div className="form-group">
              <label>Or Paste JSON Array</label>
              <textarea
                value={bulkJson}
                onChange={e => {
                  setBulkJson(e.target.value);
                  parseBulkJson(e.target.value);
                }}
                placeholder={`Paste JSON array of questions, e.g.:
[
  {
    "question": "Your question text...",
    "options": { "A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D" },
    "correct_answers": ["B"],
    "explanation": "Explanation text...",
    "difficulty": "medium"
  }
]`}
                rows={10}
                className="json-textarea"
              />
            </div>

            {bulkPreview.length > 0 && (
              <div className="bulk-preview">
                <h3>Preview: {bulkPreview.length} question(s) ready to import</h3>
                <div className="preview-list">
                  {bulkPreview.slice(0, 5).map((q, i) => (
                    <div key={i} className="preview-item">
                      <span className="preview-num">#{i + 1}</span>
                      <span className="preview-text">{q.question.substring(0, 100)}{q.question.length > 100 ? '...' : ''}</span>
                      <span className={`qc-difficulty ${q.difficulty || 'medium'}`}>{q.difficulty || 'medium'}</span>
                    </div>
                  ))}
                  {bulkPreview.length > 5 && (
                    <div className="preview-more">...and {bulkPreview.length - 5} more</div>
                  )}
                </div>
              </div>
            )}

            {bulkImporting && (
              <div className="bulk-progress">
                <div className="progress-track">
                  <div 
                    className="progress-bar" 
                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                  />
                </div>
                <span>Importing {bulkProgress.current} of {bulkProgress.total}...</span>
              </div>
            )}

            <button 
              type="button" 
              className="submit-btn" 
              onClick={handleBulkSubmit}
              disabled={bulkImporting || bulkPreview.length === 0}
            >
              {bulkImporting ? 'Importing...' : `Import ${bulkPreview.length} Question(s)`}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Create/Edit form
  return (
    <div className="app">
      <header className="app-header">
        <button className="back-btn" onClick={() => { setView('list'); resetForm(); }}>← Cancel</button>
        <h1>{view === 'create' ? '➕ New Question' : '✏️ Edit Question'}</h1>
      </header>
      <main className="qm-content">
        <form className="question-form" onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>Topic *</label>
              <input
                type="text"
                value={formData.topic}
                onChange={e => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                placeholder="e.g., Distributed Systems"
              />
            </div>
            <div className="form-group">
              <label>Subtopic *</label>
              <input
                type="text"
                value={formData.subtopic}
                onChange={e => setFormData(prev => ({ ...prev, subtopic: e.target.value }))}
                placeholder="e.g., Consensus Algorithms"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Question *</label>
            <textarea
              value={formData.question}
              onChange={e => setFormData(prev => ({ ...prev, question: e.target.value }))}
              placeholder="Enter your question..."
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Options (check correct answers) *</label>
            <div className="options-editor">
              {['A', 'B', 'C', 'D', 'E', 'F'].map(letter => (
                <div key={letter} className="option-row">
                  <input
                    type="checkbox"
                    checked={formData.correct_answers.includes(letter)}
                    onChange={() => toggleCorrectAnswer(letter)}
                    id={`correct-${letter}`}
                  />
                  <label htmlFor={`correct-${letter}`} className="option-letter">{letter}</label>
                  <input
                    type="text"
                    value={formData.options[letter] || ''}
                    onChange={e => updateOption(letter, e.target.value)}
                    placeholder={`Option ${letter} (leave empty to skip)`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Explanation *</label>
            <textarea
              value={formData.explanation}
              onChange={e => setFormData(prev => ({ ...prev, explanation: e.target.value }))}
              placeholder="Explain why the correct answer(s) are correct..."
              rows={4}
            />
          </div>

          <div className="form-group">
            <label>Difficulty</label>
            <div className="difficulty-selector">
              {DIFFICULTY_OPTIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  className={`diff-btn ${formData.difficulty === d ? 'active' : ''} ${d}`}
                  onClick={() => setFormData(prev => ({ ...prev, difficulty: d }))}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={saving}>
            {saving ? 'Saving...' : view === 'create' ? 'Create Question' : 'Save Changes'}
          </button>
        </form>
      </main>
    </div>
  );
}

import { useState } from 'react';
import { Note } from '../types';

const NOTE_COLORS = [
  { id: 'default', bg: 'var(--bg-card)', border: 'var(--border-color)' },
  { id: 'red', bg: '#5c2b29', border: '#7a3b37' },
  { id: 'orange', bg: '#614a19', border: '#7a5f23' },
  { id: 'yellow', bg: '#635d19', border: '#7c7523' },
  { id: 'green', bg: '#345920', border: '#456f2a' },
  { id: 'teal', bg: '#16504b', border: '#1f6862' },
  { id: 'blue', bg: '#2d555e', border: '#3a6b76' },
  { id: 'purple', bg: '#42275e', border: '#543376' },
  { id: 'pink', bg: '#5b2245', border: '#732c58' },
  { id: 'brown', bg: '#442f19', border: '#5a3d21' },
];

interface NotesScreenProps {
  notes: Note[];
  loading: boolean;
  onCreateNote: (data: { title: string; content: string; color: string; quizMe: boolean }) => Promise<void>;
  onUpdateNote: (data: { noteId: string; title: string; content: string; color: string; pinned: boolean; quizMe: boolean }) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onTogglePin: (note: Note) => Promise<void>;
  onBack: () => void;
}

export function NotesScreen({
  notes,
  loading,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onTogglePin,
  onBack,
}: NotesScreenProps) {
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState('default');
  const [quizMe, setQuizMe] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const resetForm = () => {
    setTitle('');
    setContent('');
    setColor('default');
    setQuizMe(false);
    setShowColorPicker(false);
    setIsCreating(false);
    setEditingNote(null);
  };

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) {
      resetForm();
      return;
    }

    if (editingNote) {
      await onUpdateNote({
        noteId: editingNote.noteId,
        title: title.trim(),
        content: content.trim(),
        color,
        pinned: editingNote.pinned,
        quizMe,
      });
    } else {
      await onCreateNote({
        title: title.trim(),
        content: content.trim(),
        color,
        quizMe,
      });
    }
    resetForm();
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setColor(note.color);
    setQuizMe(note.quizMe);
    setIsCreating(true);
  };

  const handleDelete = async () => {
    if (editingNote) {
      await onDeleteNote(editingNote.noteId);
      resetForm();
    }
  };

  const getColorStyle = (colorId: string) => {
    const c = NOTE_COLORS.find(nc => nc.id === colorId) || NOTE_COLORS[0];
    return { background: c.bg, borderColor: c.border };
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedNotes = filteredNotes.filter(n => n.pinned);
  const otherNotes = filteredNotes.filter(n => !n.pinned);

  return (
    <div className="notes-screen">
      <header className="notes-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h1>Notes</h1>
        <div className="notes-search-bar">
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      <main className="notes-main">
        {/* Create/Edit Note Input */}
        <div 
          className={`note-input-container ${isCreating ? 'expanded' : ''}`}
          style={isCreating ? getColorStyle(color) : undefined}
        >
          {isCreating && (
            <input
              type="text"
              className="note-input-title"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          )}
          <textarea
            className="note-input-content"
            placeholder={isCreating ? "Take a note..." : "Take a note..."}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => !isCreating && setIsCreating(true)}
            rows={isCreating ? 4 : 1}
          />
          {isCreating && (
            <>
              <div className="note-input-options">
                <label className="quiz-me-checkbox">
                  <input
                    type="checkbox"
                    checked={quizMe}
                    onChange={(e) => setQuizMe(e.target.checked)}
                  />
                  <span className="checkbox-icon">{quizMe ? '✓' : ''}</span>
                  <span>Quiz me on this</span>
                </label>
                <button 
                  className="color-picker-btn"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                >
                  🎨
                </button>
                {editingNote && (
                  <button className="delete-note-btn" onClick={handleDelete}>
                    🗑️
                  </button>
                )}
              </div>
              {showColorPicker && (
                <div className="color-picker">
                  {NOTE_COLORS.map(c => (
                    <button
                      key={c.id}
                      className={`color-option ${color === c.id ? 'selected' : ''}`}
                      style={{ background: c.bg, borderColor: c.border }}
                      onClick={() => setColor(c.id)}
                    />
                  ))}
                </div>
              )}
              <div className="note-input-actions">
                <button className="cancel-btn" onClick={resetForm}>Close</button>
                <button className="save-btn" onClick={handleSave}>
                  {editingNote ? 'Save' : 'Create'}
                </button>
              </div>
            </>
          )}
        </div>

        {loading ? (
          <div className="notes-loading">Loading notes...</div>
        ) : (
          <>
            {pinnedNotes.length > 0 && (
              <div className="notes-section">
                <h3 className="notes-section-title">Pinned</h3>
                <div className="notes-grid">
                  {pinnedNotes.map(note => (
                    <NoteCard
                      key={note.noteId}
                      note={note}
                      onEdit={() => handleEditNote(note)}
                      onTogglePin={() => onTogglePin(note)}
                      colorStyle={getColorStyle(note.color)}
                    />
                  ))}
                </div>
              </div>
            )}

            {otherNotes.length > 0 && (
              <div className="notes-section">
                {pinnedNotes.length > 0 && <h3 className="notes-section-title">Others</h3>}
                <div className="notes-grid">
                  {otherNotes.map(note => (
                    <NoteCard
                      key={note.noteId}
                      note={note}
                      onEdit={() => handleEditNote(note)}
                      onTogglePin={() => onTogglePin(note)}
                      colorStyle={getColorStyle(note.color)}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredNotes.length === 0 && (
              <div className="notes-empty">
                {searchQuery ? 'No matching notes' : 'Notes you add appear here'}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

interface NoteCardProps {
  note: Note;
  onEdit: () => void;
  onTogglePin: () => void;
  colorStyle: { background: string; borderColor: string };
}

function NoteCard({ note, onEdit, onTogglePin, colorStyle }: NoteCardProps) {
  return (
    <div className="note-card-keep" style={colorStyle} onClick={onEdit}>
      <button 
        className={`pin-btn ${note.pinned ? 'pinned' : ''}`}
        onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
      >
        📌
      </button>
      {note.title && <h3 className="note-card-title">{note.title}</h3>}
      {note.content && (
        <p className="note-card-content">
          {note.content.length > 200 ? note.content.slice(0, 200) + '...' : note.content}
        </p>
      )}
      {note.quizMe && (
        <div className="quiz-me-badge">📝 Quiz me</div>
      )}
    </div>
  );
}

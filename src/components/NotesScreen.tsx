import { useState, useRef, useEffect } from 'react';
import { Note } from '../types';

const NOTE_COLORS = [
  { id: 'default', bg: 'var(--bg-card)', border: 'var(--border-color)', name: 'Default' },
  { id: 'coral', bg: '#77172e', border: '#8b1e36', name: 'Coral' },
  { id: 'peach', bg: '#692b17', border: '#7d341c', name: 'Peach' },
  { id: 'sand', bg: '#7c4a03', border: '#8f5604', name: 'Sand' },
  { id: 'mint', bg: '#264d3b', border: '#2e5c47', name: 'Mint' },
  { id: 'sage', bg: '#0c625d', border: '#0f756f', name: 'Sage' },
  { id: 'fog', bg: '#256377', border: '#2c748a', name: 'Fog' },
  { id: 'storm', bg: '#284255', border: '#304e65', name: 'Storm' },
  { id: 'dusk', bg: '#472e5b', border: '#54376a', name: 'Dusk' },
  { id: 'blossom', bg: '#6c394f', border: '#7d425b', name: 'Blossom' },
  { id: 'clay', bg: '#4b443a', border: '#5a5245', name: 'Clay' },
  { id: 'chalk', bg: '#232427', border: '#3c3f43', name: 'Chalk' },
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
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const modalContentRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const autoResize = (textarea: HTMLTextAreaElement | null) => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  };

  useEffect(() => {
    if (isCreating) autoResize(contentRef.current);
  }, [content, isCreating]);

  useEffect(() => {
    if (showModal) autoResize(modalContentRef.current);
  }, [content, showModal]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setColor('default');
    setQuizMe(false);
    setShowColorPicker(false);
    setIsCreating(false);
    setEditingNote(null);
    setShowModal(false);
  };

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) {
      resetForm();
      return;
    }

    setIsSaving(true);
    try {
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
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setColor(note.color);
    setQuizMe(note.quizMe);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (editingNote && window.confirm('Delete this note?')) {
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
    <div className="notes-app">
      {/* Header */}
      <header className="notes-app-header">
        <button className="notes-back-btn" onClick={onBack} aria-label="Go back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <div className="notes-search-wrapper">
          <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            type="text"
            placeholder="Search notes"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="notes-search-input"
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>
      </header>

      <main className="notes-app-main">
        {/* Create Note Input */}
        <div 
          className={`note-composer ${isCreating ? 'expanded' : ''}`}
          style={isCreating ? getColorStyle(color) : undefined}
        >
          {isCreating && (
            <input
              type="text"
              className="composer-title"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          )}
          <textarea
            ref={contentRef}
            className="composer-content"
            placeholder="Take a note..."
            value={content}
            onChange={(e) => { setContent(e.target.value); autoResize(e.target); }}
            onFocus={() => !isCreating && setIsCreating(true)}
            rows={1}
          />
          {isCreating && (
            <div className="composer-toolbar">
              <div className="toolbar-left">
                <label className="quiz-toggle" title="Generate quiz questions from this note">
                  <input
                    type="checkbox"
                    checked={quizMe}
                    onChange={(e) => setQuizMe(e.target.checked)}
                  />
                  <span className="toggle-track">
                    <span className="toggle-thumb" />
                  </span>
                  <span className="toggle-label">Quiz me</span>
                </label>
              </div>
              <div className="toolbar-right">
                <button 
                  className={`toolbar-btn ${showColorPicker ? 'active' : ''}`}
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  title="Background color"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
          {isCreating && showColorPicker && (
            <div className="color-palette">
              {NOTE_COLORS.map(c => (
                <button
                  key={c.id}
                  className={`palette-color ${color === c.id ? 'selected' : ''}`}
                  style={{ background: c.bg }}
                  onClick={() => setColor(c.id)}
                  title={c.name}
                >
                  {color === c.id && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
          {isCreating && (
            <div className="composer-actions">
              <button className="action-close" onClick={resetForm} disabled={isSaving}>
                Close
              </button>
              <button className="action-save" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* Notes Content */}
        {loading ? (
          <div className="notes-loader">
            <div className="loader-spinner" />
            <span>Loading notes...</span>
          </div>
        ) : (
          <>
            {pinnedNotes.length > 0 && (
              <section className="notes-section">
                <h2 className="section-label">PINNED</h2>
                <div className="notes-masonry">
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
              </section>
            )}

            {otherNotes.length > 0 && (
              <section className="notes-section">
                {pinnedNotes.length > 0 && <h2 className="section-label">OTHERS</h2>}
                <div className="notes-masonry">
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
              </section>
            )}

            {filteredNotes.length === 0 && (
              <div className="notes-empty-state">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="var(--text-muted)" opacity="0.3">
                  <path d="M19 3H4.99c-1.11 0-1.98.89-1.98 2L3 19c0 1.1.88 2 1.99 2H19c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10z"/>
                </svg>
                <p>{searchQuery ? 'No matching notes found' : 'Notes you create appear here'}</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Edit Modal */}
      {showModal && editingNote && (
        <div className="note-modal-overlay" onClick={resetForm}>
          <div 
            className="note-modal"
            style={getColorStyle(color)}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              className="modal-title"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              ref={modalContentRef}
              className="modal-content"
              placeholder="Note"
              value={content}
              onChange={(e) => { setContent(e.target.value); autoResize(e.target); }}
            />
            <div className="modal-footer">
              <div className="modal-options">
                <label className="quiz-toggle">
                  <input
                    type="checkbox"
                    checked={quizMe}
                    onChange={(e) => setQuizMe(e.target.checked)}
                  />
                  <span className="toggle-track">
                    <span className="toggle-thumb" />
                  </span>
                  <span className="toggle-label">Quiz me</span>
                </label>
                <button 
                  className={`modal-btn color-btn ${showColorPicker ? 'active' : ''}`}
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  title="Background color"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                  </svg>
                </button>
                <button 
                  className="modal-btn delete-btn"
                  onClick={handleDelete}
                  title="Delete note"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              </div>
              {showColorPicker && (
                <div className="modal-color-palette">
                  {NOTE_COLORS.map(c => (
                    <button
                      key={c.id}
                      className={`palette-color ${color === c.id ? 'selected' : ''}`}
                      style={{ background: c.bg }}
                      onClick={() => setColor(c.id)}
                      title={c.name}
                    >
                      {color === c.id && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div className="modal-actions">
                <button className="action-close" onClick={resetForm} disabled={isSaving}>
                  Close
                </button>
                <button className="action-save" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
    <article 
      className="note-card"
      style={colorStyle}
      onClick={onEdit}
    >
      <button 
        className={`card-pin-btn ${note.pinned ? 'pinned' : ''}`}
        onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
        title={note.pinned ? 'Unpin note' : 'Pin note'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/>
        </svg>
      </button>
      
      {note.title && (
        <h3 className="card-title">{note.title}</h3>
      )}
      
      {note.content && (
        <div className="card-content">{note.content}</div>
      )}
      
      <div className="card-footer">
        {note.quizMe && (
          <span className="card-badge quiz">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            Quiz me
          </span>
        )}
      </div>
    </article>
  );
}

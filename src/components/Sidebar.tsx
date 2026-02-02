import React, { useState } from 'react';
import { TopicsMap, QuizMode } from '../types';

interface SidebarProps {
  isOpen: boolean;
  topics: TopicsMap;
  userEmail: string;
  wrongCount: number;
  remindCount: number;
  notesCount: number;
  onClose: () => void;
  onSignOut: () => void;
  onStartQuiz: (mode: QuizMode, topic?: string, subtopic?: string) => void;
  onOpenNotes: () => void;
}

export function Sidebar({
  isOpen,
  topics,
  userEmail,
  wrongCount,
  remindCount,
  notesCount,
  onClose,
  onSignOut,
  onStartQuiz,
  onOpenNotes,
}: SidebarProps) {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const toggleTopic = (topic: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topic)) {
        next.delete(topic);
      } else {
        next.add(topic);
      }
      return next;
    });
  };

  const handleQuizStart = (mode: QuizMode, topic?: string, subtopic?: string) => {
    onClose();
    onStartQuiz(mode, topic, subtopic);
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h2>Topics</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="sidebar-content">
        <div className="user-info">
          <span className="user-email">{userEmail}</span>
          <button className="signout-btn" onClick={onSignOut}>Sign Out</button>
        </div>
        
        <div className="quick-actions">
          <button className="sidebar-action" onClick={() => handleQuizStart('smart')}>
            <span className="action-icon">🎯</span> Smart Quiz
          </button>
          <button className="sidebar-action notes" onClick={onOpenNotes}>
            <span className="action-icon">📝</span> My Notes {notesCount > 0 && `(${notesCount})`}
          </button>
          {wrongCount > 0 && (
            <button className="sidebar-action wrong" onClick={() => handleQuizStart('wrong')}>
              <span className="action-icon">❌</span> Review Wrong ({wrongCount})
            </button>
          )}
          {remindCount > 0 && (
            <button className="sidebar-action remind" onClick={() => handleQuizStart('remind')}>
              <span className="action-icon">🔔</span> Remind Me ({remindCount})
            </button>
          )}
        </div>

        <div className="topics-list">
          {Object.entries(topics).map(([topic, subtopics]) => (
            <div key={topic} className="topic-item">
              <div className="topic-header" onClick={() => toggleTopic(topic)}>
                <span className={`expand-icon ${expandedTopics.has(topic) ? 'expanded' : ''}`}>▶</span>
                <span className="topic-name">{topic}</span>
                <button
                  className="topic-quiz-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuizStart('smart', topic);
                  }}
                >
                  Quiz
                </button>
              </div>
              {expandedTopics.has(topic) && (
                <div className="subtopics-list">
                  {subtopics.map(st => (
                    <div
                      key={st}
                      className="subtopic-item"
                      onClick={() => handleQuizStart('smart', topic, st)}
                    >
                      {st}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

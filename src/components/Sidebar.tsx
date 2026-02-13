import React, { useState } from 'react';
import { TopicsMap, QuizMode } from '../types';

interface SidebarProps {
  isOpen: boolean;
  topics: TopicsMap;
  userEmail: string;
  wrongCount: number;
  remindCount: number;
  notesCount: number;
  noteQuestionsCount?: number;
  onClose: () => void;
  onSignOut: () => void;
  onStartQuiz: (mode: QuizMode, topic?: string, subtopic?: string) => void;
  onOpenNotes: () => void;
  onOpenNoteQuestions?: () => void;
}

// Organize topics into logical categories for better navigation
const TOPIC_CATEGORIES: { name: string; icon: string; topics: string[] }[] = [
  {
    name: 'Fundamentals',
    icon: '📖',
    topics: ['Core Concepts', 'Networking', 'Trade-Offs'],
  },
  {
    name: 'Architecture & Patterns',
    icon: '🏗️',
    topics: ['Architectural Patterns', 'Microservices Patterns', 'Communication Patterns'],
  },
  {
    name: 'Data & Storage',
    icon: '💾',
    topics: ['Databases', 'Database Scaling', 'Storage Systems', 'Caching'],
  },
  {
    name: 'Distributed Systems',
    icon: '🌐',
    topics: ['Distributed Systems', 'Distributed Transactions', 'Load Balancing'],
  },
  {
    name: 'APIs & Security',
    icon: '🔐',
    topics: ['API Fundamentals', 'Security'],
  },
  {
    name: 'Data Processing',
    icon: '⚡',
    topics: ['Big Data Processing', 'Data Structures for Scale'],
  },
  {
    name: 'Operations',
    icon: '📊',
    topics: ['Observability'],
  },
  {
    name: 'Practice',
    icon: '🎯',
    topics: ['System Design Scenarios'],
  },
];

export function Sidebar({
  isOpen,
  topics,
  userEmail,
  wrongCount,
  remindCount,
  notesCount,
  noteQuestionsCount = 0,
  onClose,
  onSignOut,
  onStartQuiz,
  onOpenNotes,
  onOpenNoteQuestions,
}: SidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Fundamentals']));
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

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

  // Get topics that exist in the data
  const getAvailableTopics = (categoryTopics: string[]) => {
    return categoryTopics.filter(t => topics[t]);
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h2>Menu</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="sidebar-content">
        <div className="user-info">
          <span className="user-email">{userEmail}</span>
          <button className="signout-btn" onClick={onSignOut}>Sign Out</button>
        </div>
        
        {/* Notes Section - Grouped Together */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">📝 Notes</div>
          <div className="quick-actions">
            <button className="sidebar-action notes" onClick={onOpenNotes}>
              <span className="action-icon">📝</span> 
              <span className="action-text">My Notes</span>
              {notesCount > 0 && <span className="action-badge">{notesCount}</span>}
            </button>
            {noteQuestionsCount > 0 && (
              <button className="sidebar-action note-questions" onClick={() => handleQuizStart('notes')}>
                <span className="action-icon">📓</span>
                <span className="action-text">Quiz from Notes</span>
                <span className="action-badge">{noteQuestionsCount}</span>
              </button>
            )}
          </div>
        </div>

        {/* Review Queue - Only show if there are items */}
        {(wrongCount > 0 || remindCount > 0) && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">🔄 Review Queue</div>
            <div className="quick-actions">
              {wrongCount > 0 && (
                <button className="sidebar-action wrong" onClick={() => handleQuizStart('wrong')}>
                  <span className="action-icon">❌</span>
                  <span className="action-text">Review Wrong</span>
                  <span className="action-badge wrong">{wrongCount}</span>
                </button>
              )}
              {remindCount > 0 && (
                <button className="sidebar-action remind" onClick={() => handleQuizStart('remind')}>
                  <span className="action-icon">🔔</span>
                  <span className="action-text">Remind Me Later</span>
                  <span className="action-badge remind">{remindCount}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Topics Section */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">📚 Topics</div>
          <div className="categories-list">
            {TOPIC_CATEGORIES.map(category => {
              const availableTopics = getAvailableTopics(category.topics);
              if (availableTopics.length === 0) return null;
              
              const isExpanded = expandedCategories.has(category.name);
              
              return (
                <div key={category.name} className="category-item">
                  <div 
                    className="category-header" 
                    onClick={() => toggleCategory(category.name)}
                  >
                    <span className="category-icon">{category.icon}</span>
                    <span className="category-name">{category.name}</span>
                    <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
                  </div>
                  
                  {isExpanded && (
                    <div className="topics-list">
                      {availableTopics.map(topic => {
                        const subtopics = topics[topic] || [];
                        const isTopicExpanded = expandedTopics.has(topic);
                        
                        return (
                          <div key={topic} className="topic-item">
                            <div className="topic-header" onClick={() => toggleTopic(topic)}>
                              <span className={`expand-icon small ${isTopicExpanded ? 'expanded' : ''}`}>▶</span>
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
                            {isTopicExpanded && (
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
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useContext } from 'react';
import { Copy, Download, Edit2, Check, X, FileJson, FileText, ClipboardCopy, ChevronDown, ChevronUp, Eye, EyeOff, Send } from 'lucide-react';
import { ConfigContext } from '../configStore/ConfigStore';
import { Button } from '@/components/ui/button';
import './QuestionCard.css';

/**
 * QuestionCard Component
 * 
 * Displays a question with interactive features:
 * - Answer testing
 * - Copy to clipboard
 * - Export to JSON/Markdown
 * - Edit question
 */

// Unifies all True/False related values (A, B, True, False, Benar, Salah).
// Returns 'true' or 'false' (as strings)
const normalizeTF = (val) => {
  if (Array.isArray(val)) {
    val = val.length > 0 ? val[0] : 'false';
  }

  if (val === true) return 'true';
  if (val === false) return 'false';

  const s = String(val).toLowerCase().trim();
  if (['a', 'true', 'benar', 't', 'yes', 'ya', 'correct', 'betul', '1', 'iya'].includes(s)) {
    return 'true';
  }
  if (['b', 'false', 'salah', 'f', 'no', 'tidak', 'incorrect', 'wrong', '0', 's'].includes(s)) {
    return 'false';
  }
  return s;
};

const QuestionCard = ({
  question,
  index,
  sessionId,
  onAnswer,
  onEdit,
  showAnswers = false
}) => {
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(question.question_text || question.question);
  const [showExplanation, setShowExplanation] = useState(false);
  const { config } = useContext(ConfigContext);

  const questionText = question.question_text || question.question;
  const correctAnswer = question.correct_answer;

  const handleAnswerSubmit = async (answer) => {
    if (!answer) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_PROXY_URL}/api/agent/test-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionNumber: index + 1,
          answer: answer
        })
      });

      console.log("[DEBUG FE QuestionCard] Submitting:", {
        user: answer,
        correct: correctAnswer,
        type: question.type
      });

      if (response.ok) {
        const result = await response.json();
        setFeedback(result);
      }
    } catch (error) {
      console.error('Error testing answer:', error);
      // Local fallback
      const isCorrect = checkAnswerLocally(answer);
      setFeedback({
        isCorrect,
        feedback: isCorrect ? '✅ Benar!' : `❌ Salah. Jawaban: ${correctAnswer}`,
        explanation: question.explanation
      });
    }
  };

  const checkAnswerLocally = (answer) => {
    if (question.type === 'true_false') {
      const normUser = normalizeTF(answer);
      const normCorrect = normalizeTF(correctAnswer);

      return normUser === normCorrect;
    }
    if (question.type === 'multibox' && Array.isArray(correctAnswer)) {
      const userAnswers = answer.split(',').map(a => a.trim().toUpperCase());
      const correctAnswers = correctAnswer.map(a => String(a).toUpperCase());
      return JSON.stringify(userAnswers.sort()) === JSON.stringify(correctAnswers.sort());
    }
    return String(answer).toUpperCase().trim() === String(correctAnswer).toUpperCase().trim();
  };

  const handleCopy = async (format = 'text') => {
    let content = '';

    if (format === 'json') {
      content = JSON.stringify(question, null, 2);
    } else if (format === 'markdown') {
      content = formatAsMarkdown();
    } else {
      content = `Soal ${index + 1}: ${questionText}\n`;
      if (question.options) {
        content += question.options.map(o => `${o.id}. ${o.text}`).join('\n');
      }
      content += `\nJawaban: ${correctAnswer}`;
      if (question.explanation) {
        content += `\nPenjelasan: ${question.explanation}`;
      }
    }

    try {
      await navigator.clipboard.writeText(content);
      // Show brief success indication
      const btn = document.activeElement;
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="text-green-500">✓ Copied!</span>';
        setTimeout(() => btn.innerHTML = originalText, 1500);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatAsMarkdown = () => {
    let md = `### Soal ${index + 1}\n\n${questionText}\n\n`;

    if (question.options) {
      question.options.forEach(opt => {
        const marker = showAnswers && opt.is_correct ? '- [x]' : '- [ ]';
        md += `${marker} **${opt.id}.** ${opt.text}\n`;
      });
    }

    if (showAnswers) {
      md += `\n**Jawaban:** ${correctAnswer}\n`;
      if (question.explanation) {
        md += `\n> 💡 **Penjelasan:** ${question.explanation}\n`;
      }
    }

    return md;
  };

  const handleEdit = async () => {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_PROXY_URL}/api/agent/edit-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionId: question.id,
          field: 'question_text',
          newValue: editedText
        })
      });

      if (response.ok) {
        if (onEdit) {
          onEdit(question.id, { question_text: editedText });
        }
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error editing question:', error);
      // Update locally anyway
      if (onEdit) {
        onEdit(question.id, { question_text: editedText });
      }
      setIsEditing(false);
    }
  };

  const getDifficultyBadge = (difficulty) => {
    const badges = {
      easy: { class: 'badge-easy', icon: '🟢', text: 'Mudah' },
      medium: { class: 'badge-medium', icon: '🟡', text: 'Sedang' },
      hard: { class: 'badge-hard', icon: '🔴', text: 'Sulit' }
    };
    return badges[difficulty] || badges.medium;
  };

  const getTypeLabel = (type) => {
    const labels = {
      multiple_choice: 'Pilihan Ganda',
      true_false: 'Benar/Salah',
      multibox: 'Multi Pilihan',
      essay: 'Essay',
      short_answer: 'Jawaban Singkat',
      fill_blank: 'Isian'
    };
    return labels[type] || type;
  };

  const difficultyBadge = getDifficultyBadge(question.difficulty);

  return (
    <div className="question-card-interactive">
      {/* Header */}
      <div className="question-card-header">
        <div className="question-meta">
          <span className="question-number-badge">#{index + 1}</span>
          <span className="question-type-badge">{getTypeLabel(question.type)}</span>
          <span className={`difficulty-badge ${difficultyBadge.class}`}>
            {difficultyBadge.icon} {difficultyBadge.text}
          </span>
        </div>
        <div className="question-actions">
          <button
            className="action-btn"
            onClick={() => handleCopy('text')}
            title="Copy soal"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            className="action-btn"
            onClick={() => handleCopy('json')}
            title="Copy JSON"
          >
            <FileJson className="w-4 h-4" />
          </button>
          <button
            className="action-btn"
            onClick={() => handleCopy('markdown')}
            title="Copy Markdown"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            className="action-btn"
            onClick={handleEdit}
            title={isEditing ? 'Save' : 'Edit'}
          >
            {isEditing ? <Check className="w-4 h-4 text-green-500" /> : <Edit2 className="w-4 h-4" />}
          </button>
          {isEditing && (
            <button
              className="action-btn"
              onClick={() => { setIsEditing(false); setEditedText(questionText); }}
              title="Cancel"
            >
              <X className="w-4 h-4 text-red-500" />
            </button>
          )}
        </div>
      </div>

      {/* Question Text */}
      <div className="question-content">
        {isEditing ? (
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="question-edit-textarea"
            rows={3}
          />
        ) : (
          <p className="question-text">{questionText}</p>
        )}
      </div>

      {/* Options */}
      {question.options && question.type !== 'essay' && (
        <div className={`options-container ${question.type === 'true_false' ? 'tf-layout' : ''}`}>
          {question.options.map((option) => (
            <label
              key={option.id}
              className={`option-label ${feedback && option.id.toUpperCase() === String(correctAnswer).toUpperCase()
                ? 'correct-option'
                : feedback && userAnswer.toUpperCase() === option.id.toUpperCase() && !feedback.isCorrect
                  ? 'wrong-option'
                  : ''
                } ${showAnswers && option.is_correct ? 'show-correct' : ''}`}
            >
              <input
                type={question.type === 'multibox' ? 'checkbox' : 'radio'}
                name={`question-${question.id}`}
                value={option.id}
                onChange={(e) => {
                  if (question.type === 'multibox') {
                    // Handle multi-select
                    const current = userAnswer ? userAnswer.split(',') : [];
                    if (e.target.checked) {
                      current.push(option.id);
                    } else {
                      const idx = current.indexOf(option.id);
                      if (idx > -1) current.splice(idx, 1);
                    }
                    setUserAnswer(current.join(','));
                  } else {
                    setUserAnswer(option.id);
                  }
                }}
                disabled={feedback !== null}
              />
              <span className="option-id">{option.id}.</span>
              <span className="option-text">{option.text}</span>
              {showAnswers && option.is_correct && (
                <span className="correct-marker">✓</span>
              )}
            </label>
          ))}
        </div>
      )}

      {/* Short Answer / Fill Blank Input */}
      {(question.type === 'short_answer' || question.type === 'fill_blank') && (
        <div className="short-answer-container">
          <input
            type="text"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="Ketik jawaban..."
            className="short-answer-input"
            disabled={feedback !== null}
          />
        </div>
      )}

      {/* Submit Answer Button */}
      {!feedback && question.type !== 'essay' && (
        <div className="submit-answer-container">
          <Button
            onClick={() => handleAnswerSubmit(userAnswer)}
            disabled={!userAnswer}
            className="submit-answer-btn"
          >
            <Send className="w-4 h-4 mr-2" />
            Kirim Jawaban
          </Button>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className={`feedback-container ${feedback.isCorrect ? 'correct' : 'incorrect'}`}>
          <div className="feedback-text">{feedback.feedback}</div>
          {feedback.pointsEarned !== undefined && (
            <div className="points-info">
              Poin: {feedback.pointsEarned}/{feedback.maxPoints}
            </div>
          )}
        </div>
      )}

      {/* Explanation Toggle */}
      {(showAnswers || feedback) && question.explanation && (
        <div className="explanation-container">
          <button
            className="explanation-toggle"
            onClick={() => setShowExplanation(!showExplanation)}
          >
            {showExplanation ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showExplanation ? 'Sembunyikan' : 'Lihat'} Penjelasan
            {showExplanation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showExplanation && (
            <div className="explanation-content">
              💡 {question.explanation}
            </div>
          )}
        </div>
      )}

      {/* ID for reference */}
      <div className="question-footer">
        <span className="question-id">ID: {question.id}</span>
        {question.points && <span className="question-points">Poin: {question.points}</span>}
      </div>
    </div>
  );
};

export default QuestionCard;

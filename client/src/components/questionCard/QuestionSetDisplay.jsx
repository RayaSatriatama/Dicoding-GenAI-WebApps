import React, { useState } from 'react';
import { Download, Eye, EyeOff, RotateCcw, Pencil, Check } from 'lucide-react';
import QuestionCard from './QuestionCard';
import QuestionExport from './QuestionExport';
import { Button } from '@/components/ui/button';
import './QuestionSetDisplay.css';

/**
 * QuestionSetDisplay Component
 *
 * Displays a complete question set with:
 * - All questions with interactive testing
 * - Show/hide answers toggle
 * - Export functionality
 * - Edit capabilities
 * - Score tracking
 */

const QuestionSetDisplay = ({
  questionSet,
  sessionId,
  onQuestionsUpdate
}) => {
  const [showAnswers, setShowAnswers] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState({});
  const [editedQuestions, setEditedQuestions] = useState({});

  if (!questionSet || !questionSet.questions) {
    return null;
  }

  const totalQuestions = questionSet.questions.length;
  const answeredCount = Object.keys(answeredQuestions).length;
  const correctCount = Object.values(answeredQuestions).filter(a => a.isCorrect).length;
  const totalPoints = Object.values(answeredQuestions).reduce((sum, a) => sum + (a.pointsEarned || 0), 0);
  const maxPoints = questionSet.total_points || totalQuestions;

  const handleAnswer = (questionId, result) => {
    setAnsweredQuestions(prev => ({
      ...prev,
      [questionId]: result
    }));
  };

  const handleEdit = (questionId, updates) => {
    setEditedQuestions(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], ...updates }
    }));

    if (onQuestionsUpdate) {
      onQuestionsUpdate(questionId, updates);
    }
  };

  const resetProgress = () => {
    setAnsweredQuestions({});
  };

  const getQuestionWithEdits = (question) => {
    const edits = editedQuestions[question.id];
    if (!edits) return question;

    return {
      ...question,
      ...edits,
      question_text: edits.question_text || question.question_text || question.question
    };
  };

  return (
    <div className="question-set-display">
      {/* Header */}
      <div className="question-set-header">
        <div className="header-info">
          <h2 className="set-title">📝 {questionSet.title || 'Generated Questions'}</h2>
          {questionSet.description && (
            <p className="set-description">{questionSet.description}</p>
          )}
        </div>
        <div className="header-stats">
          <span className="stat-item">
            <strong>{totalQuestions}</strong> Soal
          </span>
          <span className="stat-item">
            <strong>{maxPoints}</strong> Total Poin
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      {answeredCount > 0 && (
        <div className="progress-section">
          <div className="progress-header">
            <span>Progress: {answeredCount}/{totalQuestions}</span>
            <span className="score">
              Skor: {correctCount}/{answeredCount} ({totalPoints} poin)
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
            >
              <div
                className="progress-correct"
                style={{ width: `${(correctCount / Math.max(answeredCount, 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="question-set-controls">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAnswers(!showAnswers)}
        >
          {showAnswers ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
          {showAnswers ? 'Sembunyikan Jawaban' : 'Tampilkan Jawaban'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowExportModal(true)}
        >
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>

        {answeredCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={resetProgress}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        )}
      </div>

      {/* Tips */}
      <div className="question-tips">
        💡 <strong>Tips:</strong> Pilih jawaban dan klik "Kirim Jawaban" untuk menguji pemahaman.
        Gunakan tombol edit (✏️) untuk mengubah soal, atau export untuk menyimpan.
      </div>

      {/* Questions */}
      <div className="questions-list">
        {questionSet.questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={getQuestionWithEdits(question)}
            index={index}
            sessionId={sessionId}
            onAnswer={(result) => handleAnswer(question.id, result)}
            onEdit={(id, updates) => handleEdit(id, updates)}
            showAnswers={showAnswers}
          />
        ))}
      </div>

      {/* Summary */}
      {answeredCount === totalQuestions && (
        <div className="completion-summary">
          <h3>🎉 Selesai!</h3>
          <div className="summary-stats">
            <div className="summary-item">
              <span className="label">Benar</span>
              <span className="value correct">{correctCount}</span>
            </div>
            <div className="summary-item">
              <span className="label">Salah</span>
              <span className="value incorrect">{answeredCount - correctCount}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total Poin</span>
              <span className="value">{totalPoints}/{maxPoints}</span>
            </div>
            <div className="summary-item">
              <span className="label">Persentase</span>
              <span className="value">{Math.round((correctCount / answeredCount) * 100)}%</span>
            </div>
          </div>
          <Button onClick={resetProgress} className="mt-4">
            <RotateCcw className="w-4 h-4 mr-2" />
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <QuestionExport
          sessionId={sessionId}
          questionSet={questionSet}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
};

export default QuestionSetDisplay;

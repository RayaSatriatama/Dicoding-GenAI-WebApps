import "./chatPage.css";
import NewPrompt from "../../components/newPrompt/NewPrompt";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { IKImage } from "imagekitio-react";
import React, { useState, useContext } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Bot, User, AlertCircle, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { useUser, useAuth } from "@clerk/clerk-react";
import '../../style/TypingAnimation.css';
import { ConfigContext } from "../../components/configStore/ConfigStore";

const ChatPage = () => {
  const path = useLocation().pathname;
  const chatId = path.split("/").pop();

  // Get user info from Clerk
  const { user } = useUser();

  // Get config for quiz settings - this will re-render when settings change
  const { config } = useContext(ConfigContext);
  const quizSettings = config?.quizSettings || {
    showExplanation: 'correct-only',
    showCorrectAnswer: 'after-wrong',
    allowRetry: false,
    shuffleOptions: false,
    showScore: true,
  };

  // Quiz state for interactive answering
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizFeedback, setQuizFeedback] = useState({});

  // Unifies all True/False related values (A, B, True, False, Benar, Salah).
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

  // Calculate score from feedback with points
  const calculateScore = (questions = []) => {
    const entries = Object.entries(quizFeedback);
    let earnedPoints = 0;
    let maxPoints = 0;
    let correct = 0;
    let wrong = 0;

    entries.forEach(([questionId, feedback]) => {
      const question = questions.find(q => q.id === questionId);
      const points = question?.points || 10; // Default 10 points if not specified

      if (feedback.correct) {
        earnedPoints += points;
        correct++;
      } else {
        wrong++;
      }
    });

    // Calculate max possible points from all questions
    maxPoints = questions.reduce((sum, q) => sum + (q.points || 10), 0);

    return { correct, wrong, total: entries.length, earnedPoints, maxPoints };
  };

  // Helper functions for quiz settings
  const shouldShowExplanation = (questionId, hasExplanation) => {
    if (!hasExplanation) return false;

    const feedback = quizFeedback[questionId];
    const isAnswered = !!feedback;

    const result = (() => {
      switch (quizSettings.showExplanation) {
        case 'always':
          return true;
        case 'correct-only':
          return isAnswered && feedback?.correct;
        case 'after-answer':
          return isAnswered;
        case 'never':
          return false;
        default:
          return isAnswered && feedback?.correct;
      }
    })();

    return result;
  };

  const shouldShowCorrectAnswer = (questionId) => {
    const feedback = quizFeedback[questionId];
    const isAnswered = !!feedback;

    switch (quizSettings.showCorrectAnswer) {
      case 'always':
        return true;
      case 'after-wrong':
        return isAnswered && !feedback?.correct;
      case 'never':
        return false;
      default:
        // Handle legacy boolean value
        if (quizSettings.showCorrectAnswer === true) {
          return isAnswered && !feedback?.correct;
        }
        return false;
    }
  };

  const canRetry = (questionId) => {
    const feedback = quizFeedback[questionId];
    if (!feedback) return false;

    const allowRetry = quizSettings.allowRetry;
    // Handle new string values and legacy boolean
    if (allowRetry === 'always') return true;
    if (allowRetry === 'after-wrong') return !feedback.correct;
    if (allowRetry === 'never' || allowRetry === false) return false;
    // Legacy boolean true = after-wrong behavior
    if (allowRetry === true) return !feedback.correct;
    return false;
  };

  const handleAnswerChange = (questionId, value) => {
    setQuizAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const retryQuestion = (questionId) => {
    setQuizAnswers(prev => {
      const newAnswers = { ...prev };
      delete newAnswers[questionId];
      return newAnswers;
    });
    setQuizFeedback(prev => {
      const newFeedback = { ...prev };
      delete newFeedback[questionId];
      return newFeedback;
    });
  };

  const submitAnswer = (questionId, correctAnswer) => {
    const userAnswer = quizAnswers[questionId];
    if (!userAnswer) return;

    // Check if answer is correct
    let isCorrect = false;

    // Check key exist in questions map to find type
    // But here we rely on generic robust check

    const normUser = normalizeTF(userAnswer);
    const normCorrect = normalizeTF(correctAnswer);

    if (normUser === 'true' || normUser === 'false') {
      isCorrect = normUser === normCorrect;
    } else if (Array.isArray(correctAnswer)) {
      isCorrect = correctAnswer.includes(userAnswer);
    } else {
      isCorrect = String(userAnswer).toLowerCase() === String(correctAnswer).toLowerCase();
    }

    setQuizFeedback(prev => ({
      ...prev,
      [questionId]: { correct: isCorrect, message: isCorrect ? 'Benar!' : 'Salah!' }
    }));
  };

  // Submit matching question - checks all pairs
  const submitMatchingAnswer = (questionId, items, correctAnswer) => {
    // Collect all matching answers for this question
    const userMatches = {};
    items.forEach((item, idx) => {
      const key = `${questionId}-${item.id || idx}`;
      userMatches[item.id || idx] = quizAnswers[key];
    });

    // Check if all pairs are matched
    const allMatched = items.every((item, idx) => userMatches[item.id || idx]);
    if (!allMatched) return;

    // Compare with correct answer
    let isCorrect = true;
    if (typeof correctAnswer === 'object') {
      for (const [key, value] of Object.entries(correctAnswer)) {
        if (String(userMatches[key]) !== String(value)) {
          isCorrect = false;
          break;
        }
      }
    } else {
      isCorrect = false;
    }

    setQuizFeedback(prev => ({
      ...prev,
      [questionId]: { correct: isCorrect, message: isCorrect ? 'Benar!' : 'Salah!' }
    }));
  };

  // Check if matching question has all fields filled
  const isMatchingComplete = (questionId, items) => {
    return items.every((item, idx) => {
      const key = `${questionId}-${item.id || idx}`;
      return quizAnswers[key];
    });
  };

  // Auth token
  const { getToken } = useAuth();

  const { isPending, error, data } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: async () => {
      const token = await getToken();
      return fetch(`${import.meta.env.VITE_API_URL}/api/chats/${chatId}`, {
        credentials: "include",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      }).then((res) => {
        if (!res.ok) {
          throw new Error('Server error');
        }
        return res.json();
      });
    },
  });

  const isValidJSON = (str) => {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  };

  // Parse questions from JSON - handles both array and {questions: [...]} formats
  const parseQuestions = (jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      // If it's an array, return it directly
      if (Array.isArray(parsed)) {
        return parsed;
      }
      // If it has a questions property, return that
      if (parsed.questions && Array.isArray(parsed.questions)) {
        return parsed.questions;
      }
      // If it's a single question object, wrap in array
      if (parsed.id && parsed.type) {
        return [parsed];
      }
      return [];
    } catch (e) {
      return [];
    }
  };

  const renderQuestionForm = (questions) => {
    // Ensure questions is always an array
    if (!Array.isArray(questions) || questions.length === 0) {
      return null;
    }

    const score = calculateScore(questions);

    return (
      <>
        {/* Score Display */}
        {quizSettings.showScore && score.total > 0 && (
          <div className="quiz-score-display">
            <div className="score-item points">
              <span className="score-points">{score.earnedPoints}</span>
              <span className="score-max">/{score.maxPoints} pts</span>
            </div>
            <div className="score-divider" />
            <div className="score-item correct">
              <CheckCircle size={14} />
              <span>{score.correct}</span>
            </div>
            <div className="score-item wrong">
              <XCircle size={14} />
              <span>{score.wrong}</span>
            </div>
            <div className="score-item total">
              <span>{score.total}/{questions.length}</span>
            </div>
          </div>
        )}

        {questions.map((question, index) => {
          const feedback = quizFeedback[question.id];
          const isAnswered = !!feedback;

          switch (question.type) {
            case "multiple_choice":
              return (
                <div key={question.id} className={`question-card ${isAnswered ? (feedback.correct ? 'correct' : 'incorrect') : ''}`}>
                  <div className="question-header">
                    <span className="question-number">Soal {index + 1}</span>
                    <span className="question-type">Pilihan Ganda</span>
                    {question.points && <span className="question-points">{question.points} pts</span>}
                  </div>
                  <p className="question-text">{question.question}</p>
                  <div className="options-list">
                    {question.options.map((option) => (
                      <label
                        key={option.id}
                        className={`option-item ${quizAnswers[question.id] === option.id ? 'selected' : ''} ${isAnswered && option.id === question.correct_answer ? 'correct-option' : ''}`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          checked={quizAnswers[question.id] === option.id}
                          onChange={() => handleAnswerChange(question.id, option.id)}
                          disabled={isAnswered}
                        />
                        <span className="option-text">{option.text}</span>
                      </label>
                    ))}
                  </div>
                  {!isAnswered && quizAnswers[question.id] && (
                    <button
                      className="submit-answer-btn"
                      onClick={() => submitAnswer(question.id, question.correct_answer)}
                    >
                      Kirim Jawaban
                    </button>
                  )}
                  {isAnswered && (
                    <div className={`feedback-inline ${feedback.correct ? 'correct' : 'incorrect'}`}>
                      {feedback.correct ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      <span>{feedback.correct ? 'Benar!' : 'Salah!'}</span>
                    </div>
                  )}
                  {shouldShowCorrectAnswer(question.id) && question.correct_answer && (
                    <div className="answer-section">
                      <div className="answer-item">
                        <strong>Jawaban:</strong> <Markdown remarkPlugins={[remarkGfm]}>{String(question.correct_answer)}</Markdown>
                      </div>
                    </div>
                  )}
                  {shouldShowExplanation(question.id, question.explanation) && (
                    <div className="answer-section">
                      <div className="explanation-item">
                        <strong>Penjelasan:</strong>
                        <div className="markdown-content"><Markdown remarkPlugins={[remarkGfm]}>{question.explanation}</Markdown></div>
                      </div>
                    </div>
                  )}
                  {canRetry(question.id) && (
                    <button
                      className="retry-btn"
                      onClick={() => retryQuestion(question.id)}
                    >
                      <RotateCcw size={14} /> Coba Lagi
                    </button>
                  )}
                </div>
              );
            case "multibox":
            case "multiple_select":
              // Get current selected answers as array
              const selectedAnswers = Array.isArray(quizAnswers[question.id]) ? quizAnswers[question.id] : [];
              const handleMultiboxChange = (optionId) => {
                const newAnswers = selectedAnswers.includes(optionId)
                  ? selectedAnswers.filter(id => id !== optionId)
                  : [...selectedAnswers, optionId];
                handleAnswerChange(question.id, newAnswers);
              };
              const submitMultiboxAnswer = () => {
                const correctAnswers = Array.isArray(question.correct_answer)
                  ? question.correct_answer
                  : [question.correct_answer];
                const isCorrect =
                  selectedAnswers.length === correctAnswers.length &&
                  selectedAnswers.every(a => correctAnswers.includes(a));
                setQuizFeedback(prev => ({
                  ...prev,
                  [question.id]: { correct: isCorrect, message: isCorrect ? 'Benar!' : 'Salah!' }
                }));
              };
              return (
                <div key={question.id} className={`question-card ${isAnswered ? (feedback.correct ? 'correct' : 'incorrect') : ''}`}>
                  <div className="question-header">
                    <span className="question-number">Soal {index + 1}</span>
                    <span className="question-type">Pilihan Ganda Kompleks</span>
                    {question.points && <span className="question-points">{question.points} pts</span>}
                  </div>
                  <p className="question-text">{question.question}</p>
                  <p className="question-hint">Pilih semua jawaban yang benar</p>
                  <div className="options-list checkbox-list">
                    {question.options.map((option) => (
                      <label
                        key={option.id}
                        className={`option-item checkbox ${selectedAnswers.includes(option.id) ? 'selected' : ''} ${isAnswered && (Array.isArray(question.correct_answer) ? question.correct_answer.includes(option.id) : question.correct_answer === option.id) ? 'correct-option' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAnswers.includes(option.id)}
                          onChange={() => handleMultiboxChange(option.id)}
                          disabled={isAnswered}
                        />
                        <span className="option-text">{option.text}</span>
                      </label>
                    ))}
                  </div>
                  {!isAnswered && selectedAnswers.length > 0 && (
                    <button
                      className="submit-answer-btn"
                      onClick={submitMultiboxAnswer}
                    >
                      Kirim Jawaban
                    </button>
                  )}
                  {isAnswered && (
                    <div className={`feedback-inline ${feedback.correct ? 'correct' : 'incorrect'}`}>
                      {feedback.correct ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      <span>{feedback.correct ? 'Benar!' : 'Salah!'}</span>
                    </div>
                  )}
                  {shouldShowCorrectAnswer(question.id) && question.correct_answer && (
                    <div className="answer-section">
                      <div className="answer-item">
                        <strong>Jawaban:</strong> <Markdown remarkPlugins={[remarkGfm]}>{Array.isArray(question.correct_answer) ? question.correct_answer.join(', ') : String(question.correct_answer)}</Markdown>
                      </div>
                    </div>
                  )}
                  {shouldShowExplanation(question.id, question.explanation) && (
                    <div className="answer-section">
                      <div className="explanation-item">
                        <strong>Penjelasan:</strong>
                        <div className="markdown-content"><Markdown remarkPlugins={[remarkGfm]}>{question.explanation}</Markdown></div>
                      </div>
                    </div>
                  )}
                  {canRetry(question.id) && (
                    <button
                      className="retry-btn"
                      onClick={() => retryQuestion(question.id)}
                    >
                      <RotateCcw size={14} /> Coba Lagi
                    </button>
                  )}
                </div>
              );
            case "true_false":
              return (
                <div key={question.id} className={`question-card ${isAnswered ? (feedback.correct ? 'correct' : 'incorrect') : ''}`}>
                  <div className="question-header">
                    <span className="question-number">Soal {index + 1}</span>
                    <span className="question-type">Benar/Salah</span>
                    {question.points && <span className="question-points">{question.points} pts</span>}
                  </div>
                  <p className="question-text">{question.question}</p>
                  <div className="options-list tf-options">
                    <label className={`option-item ${quizAnswers[question.id] === 'benar' || quizAnswers[question.id] === 'true' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name={question.id}
                        checked={quizAnswers[question.id] === 'benar' || quizAnswers[question.id] === 'true'}
                        onChange={() => handleAnswerChange(question.id, 'benar')}
                        disabled={isAnswered}
                      />
                      <span className="option-text">Benar</span>
                    </label>
                    <label className={`option-item ${quizAnswers[question.id] === 'salah' || quizAnswers[question.id] === 'false' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name={question.id}
                        checked={quizAnswers[question.id] === 'salah' || quizAnswers[question.id] === 'false'}
                        onChange={() => handleAnswerChange(question.id, 'salah')}
                        disabled={isAnswered}
                      />
                      <span className="option-text">Salah</span>
                    </label>
                  </div>
                  {!isAnswered && quizAnswers[question.id] && (
                    <button
                      className="submit-answer-btn"
                      onClick={() => submitAnswer(question.id, question.correct_answer)}
                    >
                      Kirim Jawaban
                    </button>
                  )}
                  {isAnswered && (
                    <div className={`feedback-inline ${feedback.correct ? 'correct' : 'incorrect'}`}>
                      {feedback.correct ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      <span>{feedback.correct ? 'Benar!' : 'Salah!'}</span>
                    </div>
                  )}
                  {shouldShowCorrectAnswer(question.id) && question.correct_answer && (
                    <div className="answer-section">
                      <div className="answer-item">
                        <strong>Jawaban:</strong> <Markdown remarkPlugins={[remarkGfm]}>{String(question.correct_answer)}</Markdown>
                      </div>
                    </div>
                  )}
                  {shouldShowExplanation(question.id, question.explanation) && (
                    <div className="answer-section">
                      <div className="explanation-item">
                        <strong>Penjelasan:</strong>
                        <div className="markdown-content"><Markdown remarkPlugins={[remarkGfm]}>{question.explanation}</Markdown></div>
                      </div>
                    </div>
                  )}
                  {canRetry(question.id) && (
                    <button
                      className="retry-btn"
                      onClick={() => retryQuestion(question.id)}
                    >
                      <RotateCcw size={14} /> Coba Lagi
                    </button>
                  )}
                </div>
              );
            case "essay":
            case "short_answer":
              return (
                <div key={question.id} className={`question-card ${isAnswered ? (feedback.correct ? 'correct' : 'incorrect') : ''}`}>
                  <div className="question-header">
                    <span className="question-number">Soal {index + 1}</span>
                    <span className="question-type">{question.type === 'essay' ? 'Essay' : 'Jawaban Singkat'}</span>
                    {question.points && <span className="question-points">{question.points} pts</span>}
                  </div>
                  <p className="question-text">{question.question || question.question_text}</p>
                  <div className="text-answer-container">
                    <textarea
                      className="text-answer-input"
                      placeholder={question.type === 'essay' ? "Tulis jawaban essay Anda..." : "Tulis jawaban singkat..."}
                      value={quizAnswers[question.id] || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      disabled={isAnswered}
                      rows={question.type === 'essay' ? 5 : 2}
                    />
                  </div>
                  {!isAnswered && quizAnswers[question.id] && (
                    <button
                      className="submit-answer-btn"
                      onClick={() => submitAnswer(question.id, question.correct_answer)}
                    >
                      Kirim Jawaban
                    </button>
                  )}
                  {isAnswered && (
                    <div className={`feedback-inline ${feedback.correct ? 'correct' : 'incorrect'}`}>
                      {feedback.correct ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      <span>{feedback.correct ? 'Benar!' : 'Salah!'}</span>
                    </div>
                  )}
                  {shouldShowCorrectAnswer(question.id) && question.correct_answer && (
                    <div className="answer-section">
                      <div className="answer-item">
                        <strong>Kunci Jawaban:</strong> <Markdown remarkPlugins={[remarkGfm]}>{String(question.correct_answer)}</Markdown>
                      </div>
                    </div>
                  )}
                  {shouldShowExplanation(question.id, question.explanation) && (
                    <div className="answer-section">
                      <div className="explanation-item">
                        <strong>Penjelasan:</strong>
                        <div className="markdown-content"><Markdown remarkPlugins={[remarkGfm]}>{question.explanation}</Markdown></div>
                      </div>
                    </div>
                  )}
                  {canRetry(question.id) && (
                    <button
                      className="retry-btn"
                      onClick={() => retryQuestion(question.id)}
                    >
                      <RotateCcw size={14} /> Coba Lagi
                    </button>
                  )}
                </div>
              );
            case "fill_blank":
              return (
                <div key={question.id} className={`question-card ${isAnswered ? (feedback.correct ? 'correct' : 'incorrect') : ''}`}>
                  <div className="question-header">
                    <span className="question-number">Soal {index + 1}</span>
                    <span className="question-type">Isian</span>
                    {question.points && <span className="question-points">{question.points} pts</span>}
                  </div>
                  <p className="question-text">{question.question || question.question_text}</p>
                  <div className="fill-blank-container">
                    <input
                      type="text"
                      className="fill-blank-input"
                      placeholder="Ketik jawaban..."
                      value={quizAnswers[question.id] || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      disabled={isAnswered}
                    />
                  </div>
                  {!isAnswered && quizAnswers[question.id] && (
                    <button
                      className="submit-answer-btn"
                      onClick={() => submitAnswer(question.id, question.correct_answer)}
                    >
                      Kirim Jawaban
                    </button>
                  )}
                  {isAnswered && (
                    <div className={`feedback-inline ${feedback.correct ? 'correct' : 'incorrect'}`}>
                      {feedback.correct ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      <span>{feedback.correct ? 'Benar!' : 'Salah!'}</span>
                    </div>
                  )}
                  {shouldShowCorrectAnswer(question.id) && question.correct_answer && (
                    <div className="answer-section">
                      <div className="answer-item">
                        <strong>Jawaban:</strong> <Markdown remarkPlugins={[remarkGfm]}>{String(question.correct_answer)}</Markdown>
                      </div>
                    </div>
                  )}
                  {shouldShowExplanation(question.id, question.explanation) && (
                    <div className="answer-section">
                      <div className="explanation-item">
                        <strong>Penjelasan:</strong>
                        <div className="markdown-content"><Markdown remarkPlugins={[remarkGfm]}>{question.explanation}</Markdown></div>
                      </div>
                    </div>
                  )}
                  {canRetry(question.id) && (
                    <button
                      className="retry-btn"
                      onClick={() => retryQuestion(question.id)}
                    >
                      <RotateCcw size={14} /> Coba Lagi
                    </button>
                  )}
                </div>
              );
            case "matching":
              const matchingItems = question.items || question.options || [];
              return (
                <div key={question.id} className={`question-card ${isAnswered ? (feedback.correct ? 'correct' : 'incorrect') : ''}`}>
                  <div className="question-header">
                    <span className="question-number">Soal {index + 1}</span>
                    <span className="question-type">Menjodohkan</span>
                    {question.points && <span className="question-points">{question.points} pts</span>}
                  </div>
                  <p className="question-text">{question.question || question.question_text}</p>
                  <div className="matching-container">
                    {matchingItems.map((item, idx) => (
                      <div key={item.id || idx} className="matching-row">
                        <span className="matching-item">{item.id || idx + 1}. {item.text}</span>
                        <span className="matching-arrow">→</span>
                        <select
                          className="matching-select"
                          value={quizAnswers[`${question.id}-${item.id || idx}`] || ''}
                          onChange={(e) => handleAnswerChange(`${question.id}-${item.id || idx}`, e.target.value)}
                          disabled={isAnswered}
                        >
                          <option value="">Pilih...</option>
                          {(question.matches || question.options || []).map((match, mIdx) => (
                            <option key={match.id || mIdx} value={match.id || mIdx}>
                              {match.id || mIdx + 1}. {match.text}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  {!isAnswered && isMatchingComplete(question.id, matchingItems) && (
                    <button
                      className="submit-answer-btn"
                      onClick={() => submitMatchingAnswer(question.id, matchingItems, question.correct_answer)}
                    >
                      Kirim Jawaban
                    </button>
                  )}
                  {isAnswered && (
                    <div className={`feedback-inline ${feedback.correct ? 'correct' : 'incorrect'}`}>
                      {feedback.correct ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      <span>{feedback.correct ? 'Benar!' : 'Salah!'}</span>
                    </div>
                  )}
                  {shouldShowCorrectAnswer(question.id) && question.correct_answer && (
                    <div className="answer-section">
                      <div className="answer-item">
                        <strong>Jawaban:</strong> {typeof question.correct_answer === 'object'
                          ? Object.entries(question.correct_answer).map(([k, v]) => `${k}→${v}`).join(', ')
                          : String(question.correct_answer)}
                      </div>
                    </div>
                  )}
                  {shouldShowExplanation(question.id, question.explanation) && (
                    <div className="answer-section">
                      <div className="explanation-item">
                        <strong>Penjelasan:</strong>
                        <div className="markdown-content"><Markdown remarkPlugins={[remarkGfm]}>{question.explanation}</Markdown></div>
                      </div>
                    </div>
                  )}
                  {canRetry(question.id) && (
                    <button
                      className="retry-btn"
                      onClick={() => retryQuestion(question.id)}
                    >
                      <RotateCcw size={14} /> Coba Lagi
                    </button>
                  )}
                </div>
              );
            default:
              // Fallback for any unhandled question type - render as generic question
              return (
                <div key={question.id} className={`question-card ${isAnswered ? (feedback.correct ? 'correct' : 'incorrect') : ''}`}>
                  <div className="question-header">
                    <span className="question-number">Soal {index + 1}</span>
                    <span className="question-type">{question.type || 'Soal'}</span>
                    {question.points && <span className="question-points">{question.points} pts</span>}
                  </div>
                  <p className="question-text">{question.question || question.question_text}</p>
                  {/* Render options if available */}
                  {question.options && question.options.length > 0 && (
                    <div className="options-list">
                      {question.options.map((option) => (
                        <label
                          key={option.id}
                          className={`option-item ${quizAnswers[question.id] === option.id ? 'selected' : ''} ${isAnswered && option.id === question.correct_answer ? 'correct-option' : ''}`}
                        >
                          <input
                            type="radio"
                            name={question.id}
                            checked={quizAnswers[question.id] === option.id}
                            onChange={() => handleAnswerChange(question.id, option.id)}
                            disabled={isAnswered}
                          />
                          <span className="option-text">{option.text}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {!isAnswered && quizAnswers[question.id] && (
                    <button
                      className="submit-answer-btn"
                      onClick={() => submitAnswer(question.id, question.correct_answer)}
                    >
                      Kirim Jawaban
                    </button>
                  )}
                  {isAnswered && (
                    <div className={`feedback-inline ${feedback.correct ? 'correct' : 'incorrect'}`}>
                      {feedback.correct ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      <span>{feedback.correct ? 'Benar!' : 'Salah!'}</span>
                    </div>
                  )}
                  {shouldShowCorrectAnswer(question.id) && question.correct_answer && (
                    <div className="answer-section">
                      <div className="answer-item">
                        <strong>Jawaban:</strong> <Markdown remarkPlugins={[remarkGfm]}>{String(question.correct_answer)}</Markdown>
                      </div>
                    </div>
                  )}
                  {shouldShowExplanation(question.id, question.explanation) && (
                    <div className="answer-section">
                      <div className="explanation-item">
                        <strong>Penjelasan:</strong>
                        <div className="markdown-content"><Markdown remarkPlugins={[remarkGfm]}>{question.explanation}</Markdown></div>
                      </div>
                    </div>
                  )}
                </div>
              );
          }
        })}
      </>
    );
  };

  const [loadingMessages, setLoadingMessages] = useState(false);

  return (
    <div className="chatPage">
      <div className="chat-wrapper">
        <div className="chat-container">
          {isPending || loadingMessages ? (
            <div className="loading-container">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p className="loading-text">Memuat percakapan...</p>
            </div>
          ) : error ? (
            <div className="error-container">
              <AlertCircle className="w-12 h-12 text-red-400" />
              <p>Terjadi kesalahan saat memuat chat</p>
            </div>
          ) : (
            data?.history?.map((message, i) => (
              <React.Fragment key={i}>
                {message.img && message.img.trim() !== "" && (
                  <div className="image-message">
                    <IKImage
                      urlEndpoint={import.meta.env.VITE_IMAGE_KIT_ENDPOINT}
                      path={message.img}
                      height="300"
                      width="400"
                      transformation={[{ height: 300, width: 400 }]}
                      loading="lazy"
                      lqip={{ active: true, quality: 20 }}
                      className="chat-image"
                    />
                  </div>
                )}
                <div
                  className={`message-bubble ${message.role === "user" ? "user" : "assistant"}`}
                  onLoad={() => setLoadingMessages(false)}
                >
                  <div className="message-avatar">
                    {message.role === "user" ? (
                      user?.imageUrl ? (
                        <img src={user.imageUrl} alt="User" className="avatar-img" />
                      ) : (
                        <User className="w-5 h-5" />
                      )
                    ) : (
                      <img src="/gemini-bot.png" alt="Gemini" className="avatar-img" />
                    )}
                  </div>
                  <div className="message-content">
                    {isValidJSON(message.parts[0].text) ? (
                      <div className="questions-container">
                        {renderQuestionForm(parseQuestions(message.parts[0].text))}
                      </div>
                    ) : (
                      <div className="message-text typing-animation complete">
                        <Markdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code(props) {
                              const { children, className, node, ...rest } = props;
                              const match = /language-(\w+)/.exec(className || '');
                              const codeString = String(children).replace(/\n$/, '');
                              const isCodeBlock = match || codeString.includes('\n');

                              if (isCodeBlock) {
                                return (
                                  <SyntaxHighlighter
                                    {...rest}
                                    PreTag="div"
                                    children={codeString}
                                    language={match ? match[1] : 'text'}
                                    style={oneDark}
                                    customStyle={{
                                      margin: '1em 0',
                                      padding: '1rem',
                                      borderRadius: '0.5rem',
                                      fontSize: '0.875rem',
                                      lineHeight: '1.6',
                                    }}
                                  />
                                );
                              }

                              return (
                                <code {...rest} className="inline-code">
                                  {children}
                                </code>
                              );
                            }
                          }}
                        >
                          {message.parts[0].text}
                        </Markdown>
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            ))
          )}
          {data && <NewPrompt data={data} />}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;

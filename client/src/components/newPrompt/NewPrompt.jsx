import { useEffect, useRef, useState, useContext, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import "./newPrompt.css";
import "../chatInput/chatInput.css";
import Upload from "../upload/Upload";
import { DocumentSelector, DocumentSelectorTrigger } from "../documentSelector/DocumentSelector";
import { IKImage } from "imagekitio-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import TypingAnimation from '../../style/TypingAnimation';
import { ConfigContext } from "../../components/configStore/ConfigStore";
import { Send, Paperclip, Bot, User, CheckCircle, XCircle, AlertCircle, RotateCcw, Timer, X } from "lucide-react";

const speed = 2;

// Unifies all True/False related values (A, B, True, False, Benar, Salah).
// Returns 'true' or 'false' (as strings)
const normalizeTF = (val) => {
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

const NewPrompt = ({ data }) => {
  const { config } = useContext(ConfigContext);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [img, setImg] = useState({
    isLoading: false,
    error: "",
    dbData: {},
    aiData: {},
  });
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);

  // Quiz answer state
  const [quizAnswers, setQuizAnswers] = useState({}); // {questionId: answer}
  const [quizFeedback, setQuizFeedback] = useState({}); // {questionId: {correct, message}}
  const [questionTimers, setQuestionTimers] = useState({}); // {questionId: remainingSeconds}
  const timerIntervals = useRef({}); // Store interval IDs

  // Get quiz settings from config
  const quizSettings = config.quizSettings || {
    showExplanation: 'correct-only',
    showCorrectAnswer: true,
    allowRetry: false,
    shuffleOptions: false,
    timedQuiz: false,
    timePerQuestion: 30,
  };

  // Timer management
  const startTimer = useCallback((questionId) => {
    if (!quizSettings.timedQuiz) return;

    const timeLimit = quizSettings.timePerQuestion || 30;
    setQuestionTimers(prev => ({ ...prev, [questionId]: timeLimit }));

    // Clear existing interval if any
    if (timerIntervals.current[questionId]) {
      clearInterval(timerIntervals.current[questionId]);
    }

    timerIntervals.current[questionId] = setInterval(() => {
      setQuestionTimers(prev => {
        const current = prev[questionId];
        if (current <= 1) {
          clearInterval(timerIntervals.current[questionId]);
          // Time's up - mark as wrong if not answered
          if (!quizFeedback[questionId]) {
            setQuizFeedback(prevFeedback => ({
              ...prevFeedback,
              [questionId]: { correct: false, message: 'Waktu habis!' }
            }));
          }
          return { ...prev, [questionId]: 0 };
        }
        return { ...prev, [questionId]: current - 1 };
      });
    }, 1000);
  }, [quizSettings.timedQuiz, quizSettings.timePerQuestion, quizFeedback]);

  // Stop timer when question is answered
  const stopTimer = useCallback((questionId) => {
    if (timerIntervals.current[questionId]) {
      clearInterval(timerIntervals.current[questionId]);
      delete timerIntervals.current[questionId];
    }
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timerIntervals.current).forEach(interval => clearInterval(interval));
    };
  }, []);

  // Helper: Should show explanation based on settings
  const shouldShowExplanation = (questionId, hasExplanation) => {
    if (!hasExplanation) return false;

    const feedback = quizFeedback[questionId];
    const isAnswered = !!feedback;

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
  };

  // Helper: Should show correct answer based on settings
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

  // Helper: Can retry the question
  const canRetry = (questionId) => {
    const feedback = quizFeedback[questionId];
    return quizSettings.allowRetry && feedback && !feedback.correct;
  };

  // Retry a question
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

  // Shuffle array helper (for shuffleOptions)
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Store shuffled options per question (memoized on first render)
  const [shuffledOptionsMap, setShuffledOptionsMap] = useState({});

  const getOptions = (question) => {
    if (!quizSettings.shuffleOptions || !question.options) {
      return question.options || [];
    }

    // Use cached shuffled options or create new
    if (!shuffledOptionsMap[question.id]) {
      setShuffledOptionsMap(prev => ({
        ...prev,
        [question.id]: shuffleArray(question.options)
      }));
      return question.options; // Return original for first render
    }
    return shuffledOptionsMap[question.id];
  };

  const endRef = useRef(null);
  const formRef = useRef(null);
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  useEffect(() => {
    endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [data, question, answer, img.dbData]);

  // Auto-scroll when loading/generating
  useEffect(() => {
    if (loadingAnswer || answer) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [loadingAnswer, answer]);

  // Scroll during typing animation
  useEffect(() => {
    const scrollInterval = setInterval(() => {
      if (loadingAnswer || answer) {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }, 500);
    return () => clearInterval(scrollInterval);
  }, [loadingAnswer, answer]);

  const mutation = useMutation({
    mutationFn: async ({ question, answer, img, sessionId }) => {
      const token = await getToken();
      return fetch(`${import.meta.env.VITE_API_URL}/api/chats/${sessionId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: question?.length > 0 ? question : undefined,
          answer,
          img: img && img.dbData ? img.dbData.filePath : undefined,
        }),
      }).then((res) => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", data._id] })
        .then(() => {
          formRef.current?.reset();
          setQuestion("");
          setAnswer("");
          setImg({
            isLoading: false,
            error: "",
            dbData: {},
            aiData: {},
          });
        });
    },
    onError: (err) => {
      console.log(err);
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

    // Handle quiz answer submission
    const handleAnswerChange = (questionId, value, isMultiple = false) => {
      if (isMultiple) {
        // For multiple_select, toggle the value in array
        setQuizAnswers(prev => {
          const current = prev[questionId] || [];
          const newAnswers = current.includes(value)
            ? current.filter(v => v !== value)
            : [...current, value];
          return { ...prev, [questionId]: newAnswers };
        });
      } else {
        setQuizAnswers(prev => ({ ...prev, [questionId]: value }));
      }
    };

    const submitAnswer = async (questionIndex, questionId) => {
      const userAnswer = quizAnswers[questionId];
      if (!userAnswer || (Array.isArray(userAnswer) && userAnswer.length === 0)) return;

      // Stop timer when answering
      stopTimer(questionId);

      const answerText = Array.isArray(userAnswer) ? userAnswer.join(',') : userAnswer;
      const prompt = `jawab ${questionIndex + 1} ${answerText}`;

      // Send to chat
      add(prompt, false);
    };

    // Timer display component
    const TimerDisplay = ({ questionId }) => {
      const timeLeft = questionTimers[questionId];
      const isLow = timeLeft !== undefined && timeLeft <= 10;

      if (!quizSettings.timedQuiz || quizFeedback[questionId]) return null;

      // Start timer if not started
      if (timeLeft === undefined && !quizFeedback[questionId]) {
        startTimer(questionId);
        return null;
      }

      return (
        <div className={`question-timer ${isLow ? 'warning' : ''} ${timeLeft === 0 ? 'expired' : ''}`}>
          <Timer size={14} />
          <span>{timeLeft}s</span>
        </div>
      );
    };

    return questions.map((question, index) => {
      const feedback = quizFeedback[question.id];
      const isAnswered = !!feedback;
      const options = getOptions(question);
      const isTimedOut = questionTimers[question.id] === 0;

      switch (question.type) {
        case "multiple_choice":
          return (
            <div key={question.id} className={`question-card-inline ${isAnswered ? (feedback.correct ? 'correct' : 'incorrect') : ''} ${isTimedOut && !isAnswered ? 'timed-out' : ''}`}>
              <div className="question-header-inline">
                <span className="question-number-inline">Soal {index + 1}</span>
                <span className="question-type-badge">Pilihan Ganda</span>
                {question.points && <span className="question-points-inline">{question.points} pts</span>}
                <TimerDisplay questionId={question.id} />
              </div>
              <p className="question-text-inline">{question.question}</p>
              <div className="options-list-inline">
                {options.map((option) => (
                  <label key={option.id} className={`option-item-inline ${quizAnswers[question.id] === option.id ? 'selected' : ''} ${isAnswered && option.id === question.correct_answer ? 'correct-option' : ''}`}>
                    <input
                      type="radio"
                      name={question.id}
                      value={option.id}
                      checked={quizAnswers[question.id] === option.id}
                      onChange={() => handleAnswerChange(question.id, option.id)}
                      disabled={isAnswered && !canRetry(question.id)}
                    />
                    <span>{option.id}. {option.text}</span>
                  </label>
                ))}
              </div>
              {!isAnswered && quizAnswers[question.id] && (
                <button
                  className="submit-answer-btn"
                  onClick={() => submitAnswer(index, question.id)}
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
                <div className="answer-inline">
                  <strong>Jawaban Benar:</strong> {String(question.correct_answer)}
                </div>
              )}
              {shouldShowExplanation(question.id, question.explanation) && (
                <div className="explanation-inline">
                  <strong>Penjelasan:</strong> {question.explanation}
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

        case "multiple_select":
        case "multibox":
          return (
            <div key={question.id} className={`question-card-inline ${isAnswered ? (feedback.correct ? 'correct' : 'incorrect') : ''} ${isTimedOut && !isAnswered ? 'timed-out' : ''}`}>
              <div className="question-header-inline">
                <span className="question-number-inline">Soal {index + 1}</span>
                <span className="question-type-badge multi">Pilihan Ganda (Multi)</span>
                {question.points && <span className="question-points-inline">{question.points} pts</span>}
                <TimerDisplay questionId={question.id} />
              </div>
              <p className="question-text-inline">{question.question}</p>
              <p className="question-hint">Pilih semua jawaban yang benar</p>
              <div className="options-list-inline">
                {getOptions(question).map((option) => {
                  const currentAnswers = quizAnswers[question.id] || [];
                  const correctAnswers = Array.isArray(question.correct_answer) ? question.correct_answer : [question.correct_answer];
                  return (
                    <label key={option.id} className={`option-item-inline checkbox ${currentAnswers.includes(option.id) ? 'selected' : ''} ${isAnswered && correctAnswers.includes(option.id) ? 'correct-option' : ''}`}>
                      <input
                        type="checkbox"
                        name={question.id}
                        value={option.id}
                        checked={currentAnswers.includes(option.id)}
                        onChange={() => handleAnswerChange(question.id, option.id, true)}
                        disabled={isAnswered && !canRetry(question.id)}
                      />
                      <span>{option.id}. {option.text}</span>
                    </label>
                  );
                })}
              </div>
              {!isAnswered && (quizAnswers[question.id]?.length > 0) && (
                <button
                  className="submit-answer-btn"
                  onClick={() => submitAnswer(index, question.id)}
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
                <div className="answer-inline">
                  <strong>Jawaban Benar:</strong> {Array.isArray(question.correct_answer) ? question.correct_answer.join(', ') : String(question.correct_answer)}
                </div>
              )}
              {shouldShowExplanation(question.id, question.explanation) && (
                <div className="explanation-inline">
                  <strong>Penjelasan:</strong> {question.explanation}
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
            <div key={question.id} className={`question-card-inline ${isAnswered ? (feedback.correct ? 'correct' : 'incorrect') : ''} ${isTimedOut && !isAnswered ? 'timed-out' : ''}`}>
              <div className="question-header-inline">
                <span className="question-number-inline">Soal {index + 1}</span>
                <span className="question-type-badge tf">Benar/Salah</span>
                {question.points && <span className="question-points-inline">{question.points} pts</span>}
                <TimerDisplay questionId={question.id} />
              </div>
              <p className="question-text-inline">{question.question}</p>
              <div className="options-list-inline tf">
                <label className={`option-item-inline ${quizAnswers[question.id] === 'benar' ? 'selected' : ''} ${isAnswered && (normalizeTF(question.correct_answer) === 'true') ? 'correct-option' : ''}`}>
                  <input
                    type="radio"
                    name={question.id}
                    value="benar"
                    checked={quizAnswers[question.id] === 'benar'}
                    onChange={() => handleAnswerChange(question.id, 'benar')}
                    disabled={isAnswered && !canRetry(question.id)}
                  />
                  <span>Benar</span>
                </label>
                <label className={`option-item-inline ${quizAnswers[question.id] === 'salah' ? 'selected' : ''} ${isAnswered && (normalizeTF(question.correct_answer) === 'false') ? 'correct-option' : ''}`}>
                  <input
                    type="radio"
                    name={question.id}
                    value="salah"
                    checked={quizAnswers[question.id] === 'salah'}
                    onChange={() => handleAnswerChange(question.id, 'salah')}
                    disabled={isAnswered && !canRetry(question.id)}
                  />
                  <span>Salah</span>
                </label>
              </div>
              {!isAnswered && quizAnswers[question.id] && (
                <button
                  className="submit-answer-btn"
                  onClick={() => submitAnswer(index, question.id)}
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
                <div className="answer-inline">
                  <strong>Jawaban Benar:</strong> {String(question.correct_answer)}
                </div>
              )}
              {shouldShowExplanation(question.id, question.explanation) && (
                <div className="explanation-inline">
                  <strong>Penjelasan:</strong> {question.explanation}
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
          return (
            <div key={question.id} className={`question-card-inline ${isAnswered ? (feedback.correct ? 'correct' : 'incorrect') : ''} ${isTimedOut && !isAnswered ? 'timed-out' : ''}`}>
              <div className="question-header-inline">
                <span className="question-number-inline">Soal {index + 1}</span>
                <span className="question-type-badge matching">Menjodohkan</span>
                {question.points && <span className="question-points-inline">{question.points} pts</span>}
                <TimerDisplay questionId={question.id} />
              </div>
              <p className="question-text-inline">{question.question}</p>
              <div className="matching-container">
                {question.items && question.items.length > 0 && question.matches && question.matches.length > 0 ? (
                  <table className="matching-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th></th>
                        <th>Pasangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {question.items.map((item, i) => (
                        <tr key={item.id}>
                          <td>{item.id}. {item.text}</td>
                          <td>→</td>
                          <td>
                            <select
                              className="matching-select"
                              value={quizAnswers[`${question.id}-${item.id}`] || ''}
                              onChange={(e) => handleAnswerChange(`${question.id}-${item.id}`, e.target.value)}
                              disabled={isAnswered && !canRetry(question.id)}
                            >
                              <option value="">Pilih...</option>
                              {question.matches.map(match => (
                                <option key={match.id} value={match.id}>{match.id}. {match.text}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="matching-empty-error">
                    <em>Data penjodohkan sedang dimuat atau tidak tersedia...</em>
                  </div>
                )}
              </div>
              {isAnswered && (
                <div className={`feedback-inline ${feedback.correct ? 'correct' : 'incorrect'}`}>
                  {feedback.correct ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  <span>{feedback.correct ? 'Benar!' : 'Salah!'}</span>
                </div>
              )}
              {shouldShowCorrectAnswer(question.id) && question.correct_answer && (
                <div className="answer-inline">
                  <strong>Jawaban:</strong> {typeof question.correct_answer === 'object'
                    ? Object.entries(question.correct_answer).map(([k, v]) => `${k}-${v}`).join(', ')
                    : String(question.correct_answer)}
                </div>
              )}
              {shouldShowExplanation(question.id, question.explanation) && (
                <div className="explanation-inline">
                  <strong>Penjelasan:</strong> {question.explanation}
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
            <div key={question.id} className={`question-card-inline ${isAnswered ? (feedback.correct ? 'correct' : 'incorrect') : ''} ${isTimedOut && !isAnswered ? 'timed-out' : ''}`}>
              <div className="question-header-inline">
                <span className="question-number-inline">Soal {index + 1}</span>
                <span className="question-type-badge fill">Isian</span>
                {question.points && <span className="question-points-inline">{question.points} pts</span>}
                <TimerDisplay questionId={question.id} />
              </div>
              <p className="question-text-inline">{question.question}</p>
              <div className="fill-blank-input">
                <input
                  type="text"
                  placeholder="Ketik jawaban..."
                  value={quizAnswers[question.id] || ''}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  className="text-answer-input"
                  disabled={isAnswered && !canRetry(question.id)}
                />
                {!isAnswered && quizAnswers[question.id] && (
                  <button
                    className="submit-answer-btn inline"
                    onClick={() => submitAnswer(index, question.id)}
                  >
                    Kirim
                  </button>
                )}
              </div>
              {isAnswered && (
                <div className={`feedback-inline ${feedback.correct ? 'correct' : 'incorrect'}`}>
                  {feedback.correct ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  <span>{feedback.correct ? 'Benar!' : 'Salah!'}</span>
                </div>
              )}
              {shouldShowCorrectAnswer(question.id) && question.correct_answer && (
                <div className="answer-inline">
                  <strong>Jawaban:</strong> {String(question.correct_answer)}
                </div>
              )}
              {shouldShowExplanation(question.id, question.explanation) && (
                <div className="explanation-inline">
                  <strong>Penjelasan:</strong> {question.explanation}
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

        case "short_answer":
        case "essay":
          return (
            <div key={question.id} className={`question-card-inline ${isAnswered ? (feedback.correct ? 'correct' : 'incorrect') : ''} ${isTimedOut && !isAnswered ? 'timed-out' : ''}`}>
              <div className="question-header-inline">
                <span className="question-number-inline">Soal {index + 1}</span>
                <span className="question-type-badge essay">{question.type === 'essay' ? 'Essay' : 'Jawaban Singkat'}</span>
                {question.points && <span className="question-points-inline">{question.points} pts</span>}
                <TimerDisplay questionId={question.id} />
              </div>
              <p className="question-text-inline">{question.question}</p>
              <div className="essay-input">
                <textarea
                  placeholder={question.type === 'essay' ? "Tulis jawaban essay Anda..." : "Tulis jawaban singkat..."}
                  value={quizAnswers[question.id] || ''}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  className="text-answer-textarea"
                  rows={question.type === 'essay' ? 5 : 2}
                  disabled={isAnswered && !canRetry(question.id)}
                />
                {!isAnswered && quizAnswers[question.id] && (
                  <button
                    className="submit-answer-btn"
                    onClick={() => submitAnswer(index, question.id)}
                  >
                    Kirim Jawaban
                  </button>
                )}
              </div>
              {isAnswered && (
                <div className={`feedback-inline ${feedback.correct ? 'correct' : 'incorrect'}`}>
                  {feedback.correct ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  <span>{feedback.correct ? 'Benar!' : 'Salah!'}</span>
                </div>
              )}
              {shouldShowCorrectAnswer(question.id) && question.correct_answer && (
                <div className="answer-inline">
                  <strong>Kunci Jawaban:</strong> {String(question.correct_answer)}
                </div>
              )}
              {shouldShowExplanation(question.id, question.explanation) && (
                <div className="explanation-inline">
                  <strong>Penjelasan:</strong> {question.explanation}
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
            <div key={question.id} className={`question-card-inline ${isAnswered ? (feedback.correct ? 'correct' : 'incorrect') : ''} ${isTimedOut && !isAnswered ? 'timed-out' : ''}`}>
              <div className="question-header-inline">
                <span className="question-number-inline">Soal {index + 1}</span>
                <span className="question-type-badge">{question.type || 'Soal'}</span>
                {question.points && <span className="question-points-inline">{question.points} pts</span>}
                <TimerDisplay questionId={question.id} />
              </div>
              <p className="question-text-inline">{question.question || question.question_text}</p>
              {/* Render options if available */}
              {question.options && question.options.length > 0 && (
                <div className="options-list-inline">
                  {question.options.map((option) => (
                    <label
                      key={option.id}
                      className={`option-item-inline ${quizAnswers[question.id] === option.id ? 'selected' : ''} ${isAnswered && option.id === question.correct_answer ? 'correct-option' : ''}`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={option.id}
                        checked={quizAnswers[question.id] === option.id}
                        onChange={() => handleAnswerChange(question.id, option.id)}
                        disabled={(isAnswered && !canRetry(question.id)) || isTimedOut}
                      />
                      <span>{option.id}. {option.text}</span>
                    </label>
                  ))}
                </div>
              )}
              {!isAnswered && !isTimedOut && quizAnswers[question.id] && (
                <button
                  className="submit-answer-btn"
                  onClick={() => submitAnswer(index, question.id)}
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
                <div className="answer-inline">
                  <strong>Jawaban Benar:</strong> {String(question.correct_answer)}
                </div>
              )}
              {shouldShowExplanation(question.id, question.explanation) && (
                <div className="explanation-inline">
                  <strong>Penjelasan:</strong> {question.explanation}
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
      }
    });
  };

  const add = async (text, isInitial) => {
    let question = "";
    if (!isInitial) {
      question = text;
    }

    // Apply default soal settings to the text if this looks like a question generation request
    const isQuestionRequest = /buat|buatkan|generate|soal|pertanyaan|quiz|kuis/i.test(text);
    let modifiedText = text;

    if (isQuestionRequest && config.quizSettings) {
      const qs = config.quizSettings;
      const additions = [];

      // Apply difficulty
      if (qs.useDifficulty && qs.difficulty) {
        const difficultyMap = {
          lots: 'LOTS',
          mots: 'MOTS',
          hots: 'HOTS',
          random: 'acak'
        };
        additions.push(`kesulitan ${difficultyMap[qs.difficulty] || qs.difficulty}`);
      }

      // Apply number of questions
      if (qs.useNumQuestions && qs.numQuestions) {
        additions.push(`${qs.numQuestions} soal`);
      }

      // Apply question types
      if (qs.useQuestionTypes && qs.questionTypes?.length > 0) {
        const typeMap = {
          'multiple_choice': 'pilihan ganda',
          'true_false': 'benar/salah',
          'short_answer': 'jawaban singkat',
          'essay': 'essay',
          'matching': 'menjodohkan',
          'fill_blank': 'isian kosong'
        };
        const typeNames = qs.questionTypes.map(t => typeMap[t] || t).join(', ');
        additions.push(`tipe ${typeNames}`);
      }

      // Apply language
      if (qs.useLanguage && qs.language) {
        additions.push(`bahasa ${qs.language === 'id' ? 'Indonesia' : 'English'}`);
      }

      // Append settings to the text if any additions
      if (additions.length > 0) {
        modifiedText = `${text} (${additions.join(', ')})`;
      }
    }

    // Check if this is an answer submission (e.g., "jawab 1 B")
    const answerMatch = text.match(/jawab\s*(\d+)\s*(benar|salah|true|false|[A-Ea-e,\s]+)/i);
    const submittingQuestionIndex = answerMatch ? parseInt(answerMatch[1]) - 1 : null;

    // Close document selector when submitting
    setShowDocumentSelector(false);

    try {
      setLoadingAnswer(true);

      if (!data?._id) {
        console.error('ID sesi tidak ada');
        return;
      }

      // Build chat history from existing messages for Kotaemon
      const chatHistory = data?.history?.map((msg, i, arr) => {
        if (msg.role === "user" && arr[i + 1]?.role === "model") {
          return [msg.parts[0].text, arr[i + 1].parts[0].text];
        }
        return null;
      }).filter(Boolean) || [];

      // Kotaemon proxy endpoint - simplified URL (no path variations needed)
      const urlEndpoint = import.meta.env.VITE_POST_URL_AGENT;
      const token = await getToken();

      const response = await fetch(urlEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          chatInput: modifiedText,
          sessionId: data._id,
          action: "sendMessage",
          model: config.model,
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          topK: config.topK,
          topP: config.topP,
          enableThinking: config.enableThinking ?? true,
          thinkingBudget: config.thinkingBudget || 8192,
          document: config.document,
          // Send selected documents array for multi-select
          selectedDocuments: config.selectedDocuments || [],
          history: chatHistory,
          agentStyle: isQuestionRequest ? "generate-question" : (config.agentStyle || "none"),
          quizSettings: config.quizSettings, // Send quiz settings to backend
          imageUrl: isInitial && data?.history?.[0]?.img // Initial load: check history
            ? `${import.meta.env.VITE_IMAGE_KIT_ENDPOINT}${data.history[0].img}`
            : img?.dbData?.filePath // New message: check state
              ? `${import.meta.env.VITE_IMAGE_KIT_ENDPOINT}${img.dbData.filePath}`
              : undefined,
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Terjadi kesalahan HTTP! status: ${response.status}`);
      }

      const responseData = await response.json();

      // Keep markdown formatting intact - only clean if response is pure JSON wrapped in code fence
      let output = responseData.output || "";

      // Improved JSON extraction: Look for JSON code block anywhere in the string
      const jsonBlockMatch = output.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonBlockMatch) {
        // If found, treat the content of the block as the "answer" for parsing purposes
        // But we might want to keep the intro text? 
        // For the Quiz UI to work, 'answer' state must be VALID JSON.
        // If we want to show the intro text, we'd need a separate state or handle it in render.
        // For now, let's prioritize showing the UI.
        output = jsonBlockMatch[1].trim();
      } else if (output.trim().startsWith('{') || output.trim().startsWith('[')) {
        // It might be raw JSON
        output = output.trim();
      }

      output = output || "Maaf, saya tidak dapat menghasilkan respons.";

      // Parse feedback from answer checking response
      if (submittingQuestionIndex !== null && output) {
        const isCorrect = output.toLowerCase().includes('benar!') || output.toLowerCase().includes('correct');
        const questionId = `q${submittingQuestionIndex + 1}`;

        setQuizFeedback(prev => ({
          ...prev,
          [questionId]: {
            correct: isCorrect,
            message: output
          }
        }));
      }

      if (!output || output.trim() === "") {
        console.error("Output kosong, tidak mengirim mutasi.");
        setAnswer("Maaf, tidak ada output yang valid yang diterima.");
        return;
      }

      await mutation.mutate({
        question: question,
        answer: output,
        img: img,
        sessionId: data._id,
      });

    } catch (err) {
      console.error('Terjadi kesalahan di fungsi add:', err);
      setAnswer("Maaf, terjadi kesalahan saat mendapatkan respons.");
    } finally {
      setLoadingAnswer(false);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    const text = e.target.text.value;
    if (!text) return;

    // Set question immediately so user message appears
    setQuestion(text);
    // Clear input
    e.target.text.value = "";

    add(text, false);
  };

  // IN PRODUCTION WE DON'T NEED IT
  const hasRun = useRef(false);

  useEffect(() => {
    if (!hasRun.current) {
      if (data?.history?.length === 1) {
        add(data.history[0].parts[0].text, true);
      }
    }
    hasRun.current = true;
  }, []);

  return (
    <>
      {/* Image preview */}
      {img.isLoading && (
        <div className="image-loading">
          <div className="loading-spinner-small"></div>
          <span>Mengupload gambar...</span>
        </div>
      )}
      {img.dbData?.filePath && (
        <div className="image-preview">
          <IKImage
            urlEndpoint={import.meta.env.VITE_IMAGE_KIT_ENDPOINT}
            path={img.dbData?.filePath}
            width="380"
            transformation={[{ width: 380 }]}
            className="preview-image"
          />
        </div>
      )}

      {/* User question */}
      {question && (
        <div className="message-bubble user new-message">
          <div className="message-avatar user-avatar">
            <User className="w-5 h-5" />
          </div>
          <div className="message-content">
            <div className="message-text">
              {isValidJSON(question) ? (
                <div className="questions-inline">
                  {renderQuestionForm(parseQuestions(question))}
                </div>
              ) : (
                question
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Response */}
      {loadingAnswer ? (
        <div className="ai-thinking">
          <div className="thinking-avatar">
            <img src="/gemini-bot.png" alt="Gemini" className="avatar-img" />
          </div>
          <div className="thinking-content">
            <div className="thinking-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="thinking-text">AI sedang berpikir...</span>
          </div>
        </div>
      ) : answer && (
        <div className="message-bubble assistant new-message">
          <div className="message-avatar">
            <img src="/gemini-bot.png" alt="Gemini" className="avatar-img" />
          </div>
          <div className="message-content">
            <div className="message-text">
              {isValidJSON(answer) ? (
                <div className="questions-inline">
                  {renderQuestionForm(parseQuestions(answer))}
                </div>
              ) : (
                <TypingAnimation text={answer} speed={speed} />
              )}
            </div>
          </div>
        </div>
      )}

      <div className="endChat" ref={endRef}></div>

      {/* Input form */}
      <div className="chat-input-container">
        {/* Selected Documents Display - Above Input */}
        {Array.isArray(config.selectedDocuments) && config.selectedDocuments.length > 0 && (
          <div className="selected-docs-display">
            <span className="selected-docs-label">File:</span>
            <div className="selected-docs-chips">
              {config.selectedDocuments.map((docPath, idx) => {
                const fullName = docPath.split('/').pop()?.replace(/^\d{8}_\d{6}_/, '') || docPath;
                // Truncate long filenames
                const displayName = fullName.length > 12 ? fullName.substring(0, 8) + '...' : fullName;
                return (
                  <div key={idx} className="doc-chip">
                    <span className="doc-chip-text" title={fullName}>{displayName}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newDocs = config.selectedDocuments.filter((_, i) => i !== idx);
                        setConfig({
                          ...config,
                          selectedDocuments: newDocs,
                          document: newDocs.length > 0 ? newDocs[0] : 'none'
                        });
                      }}
                      className="doc-chip-remove"
                      aria-label="Hapus dokumen"
                    >
                      <X />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <form className="chat-input-form" onSubmit={handleSubmit} ref={formRef}>
          {/* Document selector popup */}
          {showDocumentSelector && (
            <DocumentSelector onClose={() => setShowDocumentSelector(false)} />
          )}
          <div className="upload-wrapper">
            <Upload setImg={setImg} />
          </div>
          <DocumentSelectorTrigger
            onClick={() => setShowDocumentSelector(!showDocumentSelector)}
            selectedCount={
              Array.isArray(config.selectedDocuments)
                ? config.selectedDocuments.length
                : (config.document && config.document !== 'none' ? 1 : 0)
            }
          />
          <input
            type="text"
            name="text"
            placeholder="Tanyakan apa saja..."
            autoComplete="off"
            disabled={loadingAnswer}
          />
          <button type="submit" disabled={loadingAnswer}>
            {loadingAnswer ? (
              <div className="loading-spinner-small"></div>
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>
    </>
  );
};

export default NewPrompt;

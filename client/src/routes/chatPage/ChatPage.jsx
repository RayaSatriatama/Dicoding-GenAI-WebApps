import "./chatPage.css";
import NewPrompt from "../../components/newPrompt/NewPrompt";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { IKImage } from "imagekitio-react";
import React, { useState } from 'react';
import TypingAnimation from '../../style/TypingAnimation';
import { Bot, User, AlertCircle } from "lucide-react";

const speed = 1;

const ChatPage = () => {
  const path = useLocation().pathname;
  const chatId = path.split("/").pop();

  const { isPending, error, data } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/api/chats/${chatId}`, {
        credentials: "include",
      }).then((res) => {
        if (!res.ok) {
          throw new Error('Server error');
        }
        return res.json();
      }),
  });

  const isValidJSON = (str) => {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  };

  const renderQuestionForm = (questions) => {
    return questions.map((question, index) => {
      switch (question.type) {
        case "multiple_choice":
          return (
            <div key={question.id} className="question-card">
              <div className="question-header">
                <span className="question-number">Soal {index + 1}</span>
                <span className="question-type">Pilihan Ganda</span>
              </div>
              <p className="question-text">{question.question}</p>
              <div className="options-list">
                {question.options.map((option) => (
                  <label key={option.id} className="option-item">
                    <input type="radio" name={question.id} />
                    <span className="option-text">{option.text}</span>
                  </label>
                ))}
              </div>
              <div className="answer-section">
                <div className="answer-item">
                  <strong>Jawaban:</strong> {String(question.correct_answer)}
                </div>
                <div className="explanation-item">
                  <strong>Penjelasan:</strong> {question.explanation}
                </div>
              </div>
            </div>
          );
        case "multibox":
          return (
            <div key={question.id} className="question-card">
              <div className="question-header">
                <span className="question-number">Soal {index + 1}</span>
                <span className="question-type">Multi Jawaban</span>
              </div>
              <p className="question-text">{question.question}</p>
              <div className="options-list">
                {question.options.map((option) => (
                  <label key={option.id} className="option-item checkbox">
                    <input type="checkbox" name={question.id} />
                    <span className="option-text">{option.text}</span>
                  </label>
                ))}
              </div>
              <div className="answer-section">
                <div className="answer-item">
                  <strong>Jawaban:</strong> {String(question.correct_answer)}
                </div>
                <div className="explanation-item">
                  <strong>Penjelasan:</strong> {question.explanation}
                </div>
              </div>
            </div>
          );
        case "true_false":
          return (
            <div key={question.id} className="question-card">
              <div className="question-header">
                <span className="question-number">Soal {index + 1}</span>
                <span className="question-type">Benar/Salah</span>
              </div>
              <p className="question-text">{question.question}</p>
              <div className="options-list tf-options">
                <label className="option-item">
                  <input type="radio" name={question.id} />
                  <span className="option-text">Benar</span>
                </label>
                <label className="option-item">
                  <input type="radio" name={question.id} />
                  <span className="option-text">Salah</span>
                </label>
              </div>
              <div className="answer-section">
                <div className="answer-item">
                  <strong>Jawaban:</strong> {String(question.correct_answer)}
                </div>
                <div className="explanation-item">
                  <strong>Penjelasan:</strong> {question.explanation}
                </div>
              </div>
            </div>
          );
        default:
          return null;
      }
    });
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
                      <User className="w-5 h-5" />
                    ) : (
                      <Bot className="w-5 h-5" />
                    )}
                  </div>
                  <div className="message-content">
                    {isValidJSON(message.parts[0].text) ? (
                      <div className="questions-container">
                        {renderQuestionForm(JSON.parse(message.parts[0].text).questions)}
                      </div>
                    ) : (
                      <div className="message-text">
                        <TypingAnimation text={message.parts[0].text} speed={speed} />
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

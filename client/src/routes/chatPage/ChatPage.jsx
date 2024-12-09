import "./chatPage.css";
import NewPrompt from "../../components/newPrompt/NewPrompt";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import Markdown from "react-markdown";
import { IKImage } from "imagekitio-react";
import React, { useState } from 'react';
import TypingAnimation from '../../style/TypingAnimation';

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
          // Handle server-side error
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
    return questions.map((question) => {
      switch (question.type) {
        case "multiple_choice":
          return (
            <div key={question.id}>
              <b>
                <TypingAnimation text={`Pertanyaan: ${question.question}`} speed={speed} />
              </b>
              {question.options.map((option) => (
                <div key={option.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <input type="radio" id={option.id} name={question.id} />
                  <label htmlFor={option.id} style={{ marginLeft: '8px' }}>
                    <TypingAnimation text={option.text} speed={speed} />
                  </label>
                </div>
              ))}
              <br />
              <b>
                <TypingAnimation text={`Jawaban: ${String(question.correct_answer)}`} speed={speed} />
              </b>
              <b>
                <TypingAnimation text={`Penjelasan: ${question.explanation}`} speed={speed} />
              </b>
              <br />
            </div>
          );
        case "multibox":
          return (
            <div key={question.id}>
              <b>
                <TypingAnimation text={`Pertanyaan: ${question.question}`} speed={speed} />
              </b>
              {question.options.map((option) => (
                <div key={option.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <input type="checkbox" id={option.id} name={question.id} />
                  <label htmlFor={option.id} style={{ marginLeft: '8px' }}>
                    <TypingAnimation text={option.text} speed={speed} />
                  </label>
                </div>
              ))}
              <br />
              <b>
                <TypingAnimation text={`Jawaban: ${String(question.correct_answer)}`} speed={speed} />
              </b>
              <b>
                <TypingAnimation text={`Penjelasan: ${question.explanation}`} speed={speed} />
              </b>
              <br />
            </div>
          );
        case "true_false":
          return (
            <div key={question.id}>
              <b>
                <TypingAnimation text={`Pertanyaan: ${question.question}`} speed={speed} />
              </b>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input type="radio" id={`true-${question.id}`} name={question.id} />
                <label htmlFor={`true-${question.id}`} style={{ marginLeft: '8px' }}>
                  <TypingAnimation text="True" speed={speed} />
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input type="radio" id={`false-${question.id}`} name={question.id} />
                <label htmlFor={`false-${question.id}`} style={{ marginLeft: '8px' }}>
                  <TypingAnimation text="False" speed={speed} />
                </label>
              </div>
              <br />
              <b>
                <TypingAnimation text={`Jawaban: ${String(question.correct_answer)}`} speed={speed} />
              </b>
              <b>
                <TypingAnimation text={`Penjelasan: ${question.explanation}`} speed={speed} />
              </b>
              <br />
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
      <div className="wrapper">
        <div className="chat">
          {isPending || loadingMessages ? (
            <div className="loading-spinner"></div>
          ) : error ? (
            "Something went wrong!"
          ) : (
            data?.history?.map((message, i) => (
              <React.Fragment key={i}>
                {message.img && message.img.trim() !== "" && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <IKImage
                      urlEndpoint={import.meta.env.VITE_IMAGE_KIT_ENDPOINT}
                      path={message.img}
                      height="300"
                      width="400"
                      transformation={[{ height: 300, width: 400 }]}
                      loading="lazy"
                      lqip={{ active: true, quality: 20 }}
                      style={{ alignSelf: 'flex-end' }}
                    />
                  </div>
                )}
                <div
                  className={message.role === "user" ? "message user" : "message"}
                  onLoad={() => setLoadingMessages(false)}
                >
                  {isValidJSON(message.parts[0].text) ? (
                    renderQuestionForm(JSON.parse(message.parts[0].text).questions)
                  ) : (
                    <TypingAnimation text={message.parts[0].text} speed={speed} />
                  )}
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

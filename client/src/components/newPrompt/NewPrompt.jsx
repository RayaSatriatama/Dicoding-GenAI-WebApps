import { useEffect, useRef, useState, useContext } from "react";
import "./newPrompt.css";
import Upload from "../upload/Upload";
import { IKImage } from "imagekitio-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import TypingAnimation from '../../style/TypingAnimation';
import { ConfigContext } from "../../components/configStore/ConfigStore";
import { Send, Paperclip, Bot, User } from "lucide-react";

const speed = 2;

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

  const endRef = useRef(null);
  const formRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [data, question, answer, img.dbData]);

  useEffect(() => {
    if (loadingAnswer) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [data, question, answer, img.dbData, loadingAnswer]);

  const mutation = useMutation({
    mutationFn: ({ question, answer, img, sessionId }) => {
      return fetch(`${import.meta.env.VITE_API_URL}/api/chats/${sessionId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
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
          formRef.current.reset();
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

  const renderQuestionForm = (questions) => {
    return questions.map((question, index) => {
      switch (question.type) {
        case "multiple_choice":
          return (
            <div key={question.id} className="question-card-inline">
              <div className="question-header-inline">
                <span className="question-number-inline">Soal {index + 1}</span>
              </div>
              <p className="question-text-inline">{question.question}</p>
              <div className="options-list-inline">
                {question.options.map((option) => (
                  <label key={option.id} className="option-item-inline">
                    <input type="radio" name={question.id} />
                    <span>{option.text}</span>
                  </label>
                ))}
              </div>
              <div className="answer-inline">
                <strong>Jawaban:</strong> {String(question.correct_answer)}
              </div>
              <div className="explanation-inline">
                <strong>Penjelasan:</strong> {question.explanation}
              </div>
            </div>
          );
        case "multibox":
          return (
            <div key={question.id} className="question-card-inline">
              <div className="question-header-inline">
                <span className="question-number-inline">Soal {index + 1}</span>
              </div>
              <p className="question-text-inline">{question.question}</p>
              <div className="options-list-inline">
                {question.options.map((option) => (
                  <label key={option.id} className="option-item-inline">
                    <input type="checkbox" name={question.id} />
                    <span>{option.text}</span>
                  </label>
                ))}
              </div>
              <div className="answer-inline">
                <strong>Jawaban:</strong> {String(question.correct_answer)}
              </div>
              <div className="explanation-inline">
                <strong>Penjelasan:</strong> {question.explanation}
              </div>
            </div>
          );
        case "true_false":
          return (
            <div key={question.id} className="question-card-inline">
              <div className="question-header-inline">
                <span className="question-number-inline">Soal {index + 1}</span>
              </div>
              <p className="question-text-inline">{question.question}</p>
              <div className="options-list-inline tf">
                <label className="option-item-inline">
                  <input type="radio" name={question.id} />
                  <span>Benar</span>
                </label>
                <label className="option-item-inline">
                  <input type="radio" name={question.id} />
                  <span>Salah</span>
                </label>
              </div>
              <div className="answer-inline">
                <strong>Jawaban:</strong> {String(question.correct_answer)}
              </div>
              <div className="explanation-inline">
                <strong>Penjelasan:</strong> {question.explanation}
              </div>
            </div>
          );
        default:
          return null;
      }
    });
  };

  const add = async (text, isInitial) => {
    let question = "";
    if (!isInitial) {
      question = text;
    }

    try {
      setLoadingAnswer(true);

      if (!data?._id) {
        console.error('ID sesi tidak ada');
        return;
      }

      let nonSearch = false;
      if (config.model == "hf.co/QuantFactory/Llama-3.1-8B-ArliAI-Indo-Formax-v1.0-GGUF:latest" ||
        config.model == "hf.co/QuantFactory/komodo-7b-base-GGUF:latest" ||
        config.model == "hf.co/QuantFactory/Llama-3.1-8B-ArliAI-Indo-Formax-v1.0-GGUF:latest" ||
        config.model == "hf.co/QuantFactory/komodo-7b-base-GGUF:latest") {
        nonSearch = true;
      }

      let urlEndpoint;
      if (config.agentStyle != "none") {
        urlEndpoint = import.meta.env.VITE_POST_URL_AGENT + "/" + config.agentStyle + "/" + config.platform.toLowerCase();
      } else if (nonSearch) {
        urlEndpoint = import.meta.env.VITE_POST_URL_AGENT + "/" + config.agentStyle + "/" + config.platform.toLowerCase() + "/nonsearch";
      } else {
        urlEndpoint = import.meta.env.VITE_POST_URL_AGENT + "/none/" + config.platform.toLowerCase();
      }

      const response = await fetch(urlEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatInput: text,
          sessionId: data._id,
          action: "sendMessage",
          model: config.model,
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          topK: config.topK,
          topP: config.topP,
          document: config.document,
        })
      });

      if (!response.ok) {
        throw new Error(`Terjadi kesalahan HTTP! status: ${response.status}`);
      }

      const responseData = await response.json();

      const output = responseData.output.replace(/```json\n?/g, "").replace(/```/g, "")
        || "Maaf, saya tidak dapat menghasilkan respons.";

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
                  {renderQuestionForm(JSON.parse(question).questions)}
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
            <Bot className="w-5 h-5" />
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
            <Bot className="w-5 h-5" />
          </div>
          <div className="message-content">
            <div className="message-text">
              {isValidJSON(answer) ? (
                <div className="questions-inline">
                  {renderQuestionForm(JSON.parse(answer).questions)}
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
      <div className="prompt-container">
        <form className="prompt-form" onSubmit={handleSubmit} ref={formRef}>
          <div className="upload-wrapper">
            <Upload setImg={setImg} />
          </div>
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

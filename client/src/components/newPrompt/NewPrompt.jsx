import { useEffect, useRef, useState, useContext } from "react";
import "./newPrompt.css";
import Upload from "../upload/Upload";
import { IKImage } from "imagekitio-react";
import Markdown from "react-markdown";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import TypingAnimation from '../../style/TypingAnimation';
import { ConfigContext } from "../../components/configStore/ConfigStore";

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
      console.log("Mutation Success:", data);
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
    return questions.map((question) => {
      switch (question.type) {
        case "multiple_choice":
          return (
            <div key={question.id}>
              <TypingAnimation text={`Pertanyaan: ${question.question}`} speed={speed} />
              {question.options.map((option) => (
                <div key={option.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <input type="radio" id={option.id} name={question.id} />
                  <label htmlFor={option.id} style={{ marginLeft: '8px' }}>
                    <TypingAnimation text={option.text} speed={speed} />
                  </label>
                </div>
              ))}
              <br />
              <TypingAnimation text={`Jawaban: ${String(question.correct_answer)}`} speed={speed} />
              <TypingAnimation text={`Penjelasan: ${question.explanation}`} speed={speed} />
              <br />
            </div>
          );
        case "multibox":
          return (
            <div key={question.id}>
              <TypingAnimation text={`Pertanyaan: ${question.question}`} speed={speed} />
              {question.options.map((option) => (
                <div key={option.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <input type="checkbox" id={option.id} name={question.id} />
                  <label htmlFor={option.id} style={{ marginLeft: '8px' }}>
                    <TypingAnimation text={option.text} speed={speed} />
                  </label>
                </div>
              ))}
              <br />
              <TypingAnimation text={`Jawaban: ${String(question.correct_answer)}`} speed={speed} />
              <TypingAnimation text={`Penjelasan: ${question.explanation}`} speed={speed} />
              <br />
            </div>
          );
        case "true_false":
          return (
            <div key={question.id}>
              <TypingAnimation text={`Pertanyaan: ${question.question}`} speed={speed} />
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
              <TypingAnimation text={`Jawaban: ${String(question.correct_answer)}`} speed={speed} />
              <TypingAnimation text={`Penjelasan: ${question.explanation}`} speed={speed} />
              <br />
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

      // const response = await fetch("http://localhost:5678/webhook-test/agent/chat-forum/gemini", {

      const response = await fetch(`${import.meta.env.VITE_POST_URL_AGENT}/${config.agentStyle}/${config.platform.toLowerCase()}`, {
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

      console.log(output);

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
      {/* ADD NEW CHAT */}
      {img.isLoading && <div className="">Loading...</div>}
      {img.dbData?.filePath && (
        <IKImage
          urlEndpoint={import.meta.env.VITE_IMAGE_KIT_ENDPOINT}
          path={img.dbData?.filePath}
          width="380"
          transformation={[{ width: 380 }]}
        />
      )}
      {question && (
        <div className="message user">
          {isValidJSON(question) ? (
            renderQuestionForm(JSON.parse(question).questions)
          ) : (
            question
          )}
        </div>
      )}
      {loadingAnswer ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <TypingAnimation text="AI sedang berpikir..." speed={speed} />
        </div>
      ) : answer && (
        <div className="message">
          {isValidJSON(answer) ? (
            renderQuestionForm(JSON.parse(answer).questions)
          ) : (
            <TypingAnimation text={answer} speed={speed} />
          )}
        </div>
      )}
      <div className="endChat" ref={endRef}></div>
      <form className="newForm" onSubmit={handleSubmit} ref={formRef}>
        <Upload setImg={setImg} />
        <input id="file" type="file" multiple={false} hidden />
        <input type="text" name="text" placeholder="Tanyakan apa saja..." />
        <button>
          <svg
            viewBox="0 0 384 512"
            xmlns="http://www.w3.org/2000/svg"
            height="24px"
            width="24px"
            fill="currentColor"
          >
            <path d="M374.6 246.6C368.4 252.9 360.2 256 352 256s-16.38-3.125-22.62-9.375L224 141.3V448c0 17.69-14.33 31.1-31.1 31.1S160 465.7 160 448V141.3L54.63 246.6c-12.5 12.5-32.75 12.5-45.25 0s-12.5-32.75 0-45.25l160-160c12.5-12.5 32.75-12.5 45.25 0l160 160C387.1 213.9 387.1 234.1 374.6 246.6z" />
          </svg>
        </button>
      </form>
    </>
  );
};

export default NewPrompt;

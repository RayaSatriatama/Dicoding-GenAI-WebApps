import { Link } from "react-router-dom";
import "./homepage.css";
import { TypeAnimation } from "react-type-animation";
import { useState } from "react";
import { ArrowRight, Sparkles, MessageSquare, FileText, HelpCircle } from "lucide-react";

const Homepage = () => {
  const [typingStatus, setTypingStatus] = useState("human1");

  return (
    <div className="homepage">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-primary/5 to-accent/5 rounded-full blur-3xl"></div>
      </div>

      <div className="left">
        <div className="badge">
          <Sparkles className="w-4 h-4" />
          <span>Powered by Advanced AI</span>
        </div>
        <h1 className="font-heading">
          Dicoding<br />
          <span className="text-gradient">Generative AI</span>
        </h1>
        <h2>AI for Education, Education for All</h2>
        <p className="description">
          Platform pembelajaran berbasis AI yang membantu Anda membuat soal, menganalisis dokumen, dan menjawab pertanyaan dengan cepat dan akurat.
        </p>
        <div className="cta-buttons">
          <Link to="/dashboard" className="primary-cta">
            <span>Mulai Sekarang</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link to="/sign-up" className="secondary-cta">
            Daftar Gratis
          </Link>
        </div>

        {/* Feature pills */}
        <div className="feature-pills">
          <div className="pill">
            <MessageSquare className="w-4 h-4" />
            <span>Chat AI</span>
          </div>
          <div className="pill">
            <FileText className="w-4 h-4" />
            <span>Analisis Dokumen</span>
          </div>
          <div className="pill">
            <HelpCircle className="w-4 h-4" />
            <span>Buat Soal</span>
          </div>
        </div>
      </div>

      <div className="right">
        <div className="imgContainer">
          <div className="bgContainer">
            <div className="bg"></div>
          </div>
          <img src="/bot.png" alt="AI Assistant Bot" className="bot" />
          <div className="chat">
            <div className="chat-avatar">
              <img
                src={
                  typingStatus === "human1"
                    ? "/human1.jpeg"
                    : typingStatus === "human2"
                      ? "/human2.jpeg"
                      : "/bot.png"
                }
                alt="User avatar"
              />
              <span className={`status-indicator ${typingStatus === "bot" ? "is-bot" : ""}`}></span>
            </div>
            <div className="chat-content">
              <TypeAnimation
                sequence={[
                  "Pengguna: Apa itu teknologi AI dan bagaimana cara kerjanya?",
                  2000,
                  () => {
                    setTypingStatus("bot");
                  },
                  "Agent: Teknologi AI adalah kecerdasan buatan yang memungkinkan mesin untuk belajar dan membuat keputusan secara otomatis.",
                  2000,
                  () => {
                    setTypingStatus("human2");
                  },
                  "Pengguna2: Apa saja contoh penerapan AI dalam kehidupan sehari-hari?",
                  2000,
                  () => {
                    setTypingStatus("bot");
                  },
                  "Agent: Beberapa contoh penerapan AI adalah asisten virtual seperti Siri dan Google Assistant, serta sistem rekomendasi di platform seperti Netflix dan YouTube.",
                  2000,
                  () => {
                    setTypingStatus("human1");
                  },
                ]}
                wrapper="span"
                repeat={Infinity}
                cursor={true}
                omitDeletionAnimation={true}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Homepage;
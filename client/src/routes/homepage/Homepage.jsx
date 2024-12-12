import { Link } from "react-router-dom";
import "./homepage.css";
import { TypeAnimation } from "react-type-animation";
import { useState } from "react";

const Homepage = () => {
  const [typingStatus, setTypingStatus] = useState("human1");

  return (
    <div className="homepage">
      <img src="/orbital.png" alt="" className="orbital" />
      <div className="left">
        <h1>Dicoding Generative AI</h1>
        <h2>AI for Education, Education for All</h2>
        <Link to="/dashboard"><p className="get-started">Get Started</p></Link>
      </div>
      <div className="right">
        <div className="imgContainer">
          <div className="bgContainer">
            <div className="bg"></div>
          </div>
          <img src="/bot.png" alt="" className="bot" />
          <div className="chat">
            <img
              src={
                typingStatus === "human1"
                  ? "/human1.jpeg"
                  : typingStatus === "human2"
                    ? "/human2.jpeg"
                    : "bot.png"
              }
              alt=""
            />
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
      {/* <div className="terms">
        <img src="/logo.png" alt="" />
        <div className="links">
          <Link to="/">Terms of Service</Link>
          <span>|</span>
          <Link to="/">Privacy Policy</Link>
        </div>
      </div> */}
    </div>
  );
};

export default Homepage;
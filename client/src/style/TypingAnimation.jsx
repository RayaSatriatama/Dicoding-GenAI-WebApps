import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

const TypingAnimation = ({ text, speed = 10 }) => {
  const typingRef = useRef(null);
  const [displayText, setDisplayText] = React.useState("");

  useEffect(() => {
    let isCancelled = false;

    function textTypingEffect(text, i = 0) {
      if (isCancelled) return;

      setDisplayText((prev) => prev + text[i]);

      if (i < text.length - 1) {
        setTimeout(() => {
          textTypingEffect(text, i + 1);
        }, speed);
      }
    }

    setDisplayText(""); // Reset display text
    textTypingEffect(text);

    return () => {
      isCancelled = true;
    };
  }, [text, speed]);

  return (
    <div className="text" ref={typingRef}>
      <ReactMarkdown>{displayText}</ReactMarkdown>
    </div>
  );
};

export default TypingAnimation;
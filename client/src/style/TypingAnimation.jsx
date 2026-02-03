import React, { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './TypingAnimation.css';

const TypingAnimation = ({ text, speed = 5, onComplete, isStreaming = false }) => {
  const typingRef = useRef(null);
  const [displayText, setDisplayText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const animationRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;
    let charIndex = 0;

    setDisplayText("");
    setIsComplete(false);

    // Character-by-character animation with batch processing
    function animate() {
      if (isCancelled) return;

      if (charIndex < text.length) {
        // Add characters in small batches for smooth but fast animation
        const batchSize = 3;
        setDisplayText(text.slice(0, charIndex + batchSize));
        charIndex += batchSize;
        animationRef.current = setTimeout(animate, speed);
      } else {
        setDisplayText(text); // Ensure full text is shown
        setIsComplete(true);
        onComplete?.();
      }
    }

    animate();

    return () => {
      isCancelled = true;
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [text, speed, onComplete]);

  return (
    <div className={`typing-animation ${isComplete ? 'complete' : 'typing'}`} ref={typingRef}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { children, className, node, ...rest } = props;
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            // Determine if this is a code block (has language OR has newlines OR is inside pre)
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
        {displayText}
      </Markdown>
      {!isComplete && <span className="typing-cursor">|</span>}
    </div>
  );
};

export default TypingAnimation;

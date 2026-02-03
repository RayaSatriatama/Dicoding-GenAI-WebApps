import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

export const ConfigContext = createContext();

const defaultConfig = {
  platform: 'Gemini',
  model: 'gemini-2.5-flash',
  maxTokens: 2048,
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  enableThinking: true,
  thinkingBudget: 8192,
  agentStyle: 'generate-question',
  document: 'none',
  selectedDocuments: [], // Multi-select documents for RAG
  // Quiz Settings
  quizSettings: {
    showExplanation: 'correct-only', // 'always', 'correct-only', 'after-answer', 'never'
    showCorrectAnswer: 'after-wrong', // 'always', 'after-wrong', 'never'
    allowRetry: false,               // Allow retry on wrong answers
    shuffleOptions: false,           // Shuffle answer options
    autoAdvance: false,              // Auto advance to next question
    showScore: true,                 // Show running score
    timedQuiz: false,                // Enable timer per question
    timePerQuestion: 30,             // Seconds per question (if timed)
    // Default Soal settings (togglable)
    useDifficulty: false,            // Enable difficulty setting
    difficulty: 'medium',            // Default difficulty: easy, medium, hard, random
    useNumQuestions: false,          // Enable num questions setting
    numQuestions: 5,                 // Default number of questions
    useQuestionTypes: false,         // Enable question types setting
    questionTypes: ['multiple_choice'], // Selected question types (multi-select)
    useLanguage: false,              // Enable language setting
    language: 'id',                  // Language: id (Indonesian), en (English)
  },
};

const getStorageKey = (userId) => `dicoding_settings_${userId || 'guest'}`;

export const ConfigProvider = ({ children }) => {
  const { userId, isLoaded } = useAuth();
  const [config, setConfigState] = useState(defaultConfig);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load settings from localStorage when user changes
  useEffect(() => {
    if (!isLoaded) return;
    
    const storageKey = getStorageKey(userId);
    try {
      const savedConfig = localStorage.getItem(storageKey);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        // Merge with default to ensure new fields are present
        setConfigState(prev => ({
          ...defaultConfig,
          ...parsed,
          quizSettings: {
            ...defaultConfig.quizSettings,
            ...parsed.quizSettings,
          }
        }));
      } else {
        setConfigState(defaultConfig);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setConfigState(defaultConfig);
    }
    setIsInitialized(true);
  }, [userId, isLoaded]);

  // Save settings to localStorage whenever config changes
  const setConfig = useCallback((newConfig) => {
    setConfigState(newConfig);
    
    // Save to localStorage
    const storageKey = getStorageKey(userId);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newConfig));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [userId]);

  return (
    <ConfigContext.Provider value={{ config, setConfig, isInitialized }}>
      {children}
    </ConfigContext.Provider>
  );
};
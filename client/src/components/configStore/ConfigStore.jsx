import React, { createContext, useState } from 'react';

export const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
  const defaultPlatform = 'Gemini';
  const [config, setConfig] = useState({
    platform: defaultPlatform,
    model: 'gemini-1.5-flash-8b',
    maxTokens: 2048,
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    agentStyle: 'generate-question',
    document: 'none',
  });

  return (
    <ConfigContext.Provider value={{ config, setConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};
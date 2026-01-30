import React, { useContext, useEffect, useState } from "react";
import { ConfigContext } from "../configStore/ConfigStore";
import { Settings, RotateCcw, Cpu, FileText, Sliders, Gauge, X } from 'lucide-react'
import { useAuth } from '@clerk/clerk-react';
import "./settingsPanel.css";

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

const presets = {
  "Gemini": {
    models: [
      // Gemini 3 models (Latest)
      "gemini-3-pro",
      "gemini-3-flash",
      // Gemini 2.5 models
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      // Gemini 2.0 models (Deprecated - will be shut down March 31, 2026)
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      // Gemini 1.5 models (Legacy)
      "gemini-1.5-pro",
      "gemini-1.5-pro-latest",
      "gemini-1.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash-8b",
      "gemini-1.5-flash-8b-latest",
      // Experimental/Preview models
      "gemini-2.5-pro-preview-06-05",
      "gemini-2.5-flash-preview-04-17",
      // Latest aliases
      "gemini-pro-latest",
      "gemini-flash-latest",
    ],
    maxTokens: 2048,
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    agentStyles: ["generate-question", "chat-forum"],
    documents: ["None", "General Knowledge", "Code Documentation"]
  },
  "Ollama": {
    models: [
      "hf.co/AscendingGrass/Llama-3.2_3B_C242-ET01_GGUF",
      "hf.co/QuantFactory/komodo-7b-base-GGUF:latest",
      "llama3.1:8b-instruct-q4_K_M",
      "hf.co/AscendingGrass/Llama-3.1_8B_C242-ET01_GGUF:latest",
      "llama3.2:latest",
      "hf.co/gmonsoon/llama3-8b-cpt-sahabatai-v1-instruct-GGUF"
    ].sort(),
    maxTokens: 4096,
    temperature: 0.7,
    topK: 1,
    topP: 0.9,
    agentStyles: ["generate-question", "chat-forum"],
    documents: ["None", "Scientific Papers", "Legal Documents"]
  }
}

export function SettingsPanel({ isOpen, onClose }) {
  const { config, setConfig } = useContext(ConfigContext);
  const { userId } = useAuth();
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/documents`, {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const allDocuments = await response.json();
          const userDocuments = allDocuments.filter(doc => doc.userId === userId);
          setDocuments(userDocuments.map(doc => doc.path));
        } else {
          console.error("Failed to fetch documents");
        }
      } catch (error) {
        console.error("Error fetching documents:", error);
      }
    };

    fetchDocuments();
  }, [userId]);

  const handlePlatformChange = (value) => {
    if (!presets[value]) {
      console.error(`Invalid platform: ${value}`);
      return;
    }
    setConfig({
      ...config,
      platform: value,
      model: presets[value].models[0],
      maxTokens: presets[value].maxTokens,
      temperature: presets[value].temperature,
      topK: presets[value].topK,
      topP: presets[value].topP,
      agentStyle: presets[value].agentStyles[0],
      document: presets[value].documents[0],
    });
  }

  const platform = config.platform || Object.keys(presets)[0];

  return (
    <div className={`settings-panel ${isOpen ? 'open' : ''}`}>
      <div className="settings-header">
        <h2 className="settings-title">
          <Settings className="w-5 h-5 text-primary" />
          Konfigurasi AI
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 rounded-lg hover:bg-slate-200"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="settings-scroll">
        <div className="settings-content">
          <ConfigSection title="Agents" icon={<Cpu className="w-4 h-4" />}>
            <ConfigItem label="Agent Style">
              <Select onValueChange={(style) => setConfig({ ...config, agentStyle: style })} value={config.agentStyle}>
                <SelectTrigger id="agent-style" className="w-full">
                  <SelectValue placeholder="Select agent style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="none" value="none">none</SelectItem>
                  {presets[config.platform].agentStyles.map((style) => (
                    <SelectItem key={style} value={style}>{style}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ConfigItem>
          </ConfigSection>

          <ConfigSection title="Document" icon={<FileText className="w-4 h-4" />}>
            <ConfigItem label="Document">
              <Select onValueChange={(doc) => setConfig({ ...config, document: doc })} value={config.document}>
                <SelectTrigger id="document" className="w-full">
                  <SelectValue placeholder="Select document" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="none" value="none">none</SelectItem>
                  {documents.map((title) => (
                    <SelectItem key={title} value={title}>
                      {title.replace(/^\d+-/, '')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ConfigItem>
          </ConfigSection>

          <ConfigSection title="Model" icon={<Cpu className="w-4 h-4" />}>
            <div className="space-y-2">
              <ConfigItem label="Platform">
                <Select onValueChange={handlePlatformChange} value={config.platform}>
                  <SelectTrigger id="platform" className="w-full">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(presets).map((key) => (
                      <SelectItem key={key} value={key}>{key}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ConfigItem>
              <ConfigItem label="Model">
                <Select onValueChange={(model) => setConfig({ ...config, model })} value={config.model}>
                  <SelectTrigger id="model" className="w-full">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {presets[platform].models.sort().map((m) => (
                      <SelectItem key={m} value={m}>{m.replace(/^hf\.co\//, '')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ConfigItem>
            </div>
          </ConfigSection>

          <ConfigSection title="Settings" icon={<Sliders className="w-4 h-4" />}>
            <div className="space-y-2">
              <ConfigItem label={
                <div className="flex items-center justify-between w-full">
                  <span>Max Tokens</span>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={config.unlimitedTokens}
                      onCheckedChange={(value) => setConfig({ ...config, unlimitedTokens: value })}
                      className="scale-75"
                    />
                    <span className="text-xs text-muted-foreground">Unlimited</span>
                  </div>
                </div>
              }>
                <div className="flex items-center gap-2">
                  <Slider
                    id="maxTokens"
                    min={128}
                    max={16384}
                    step={128}
                    value={[config.maxTokens]}
                    onValueChange={(value) => setConfig({ ...config, maxTokens: value[0] })}
                    disabled={config.unlimitedTokens}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={config.maxTokens}
                    onChange={(e) => setConfig({ ...config, maxTokens: Math.min(16384, Math.max(128, parseInt(e.target.value) || 128)) })}
                    min={128}
                    max={16384}
                    disabled={config.unlimitedTokens}
                    className="w-20"
                  />
                  <ResetButton onClick={() => setConfig({ ...config, maxTokens: presets[config.platform].maxTokens })} />
                </div>
              </ConfigItem>
              <ConfigItem label="Temperature">
                <div className="flex items-center gap-2">
                  <Slider
                    id="temperature"
                    min={0}
                    max={1}
                    step={0.01}
                    value={[config.temperature]}
                    onValueChange={(value) => setConfig({ ...config, temperature: value[0] })}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={config.temperature}
                    onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                    min={0}
                    max={1}
                    step={0.01}
                    className="w-16"
                  />
                  <ResetButton onClick={() => setConfig({ ...config, temperature: presets[config.platform].temperature })} />
                </div>
              </ConfigItem>
            </div>
          </ConfigSection>

          <ConfigSection title="Sampling" icon={<Gauge className="w-4 h-4" />}>
            <div className="space-y-2">
              <ConfigItem label="Top-K">
                <div className="flex items-center gap-2">
                  <Slider
                    id="top-k"
                    min={0}
                    max={100}
                    value={[config.topK]}
                    onValueChange={(value) => setConfig({ ...config, topK: value[0] })}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={config.topK}
                    onChange={(e) => setConfig({ ...config, topK: parseInt(e.target.value) })}
                    min={0}
                    max={100}
                    className="w-16"
                  />
                  <ResetButton onClick={() => setConfig({ ...config, topK: presets[config.platform].topK })} />
                </div>
              </ConfigItem>
              <ConfigItem label="Top-P">
                <div className="flex items-center gap-2">
                  <Slider
                    id="top-p"
                    min={0}
                    max={1}
                    step={0.01}
                    value={[config.topP]}
                    onValueChange={(value) => setConfig({ ...config, topP: value[0] })}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={config.topP}
                    onChange={(e) => setConfig({ ...config, topP: parseFloat(e.target.value) })}
                    min={0}
                    max={1}
                    step={0.01}
                    className="w-16"
                  />
                  <ResetButton onClick={() => setConfig({ ...config, topP: presets[config.platform].topP })} />
                </div>
              </ConfigItem>
            </div>
          </ConfigSection>
        </div>
      </ScrollArea>
    </div>
  )
}

function ConfigSection({ title, icon, children }) {
  return (
    <div className="config-section">
      <h3 className="config-section-title">
        <span className="text-primary">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  )
}

function ConfigItem({ label, children }) {
  return (
    <div className="config-item">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  )
}

function ResetButton({ onClick }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="h-7 w-7 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors duration-200 flex-shrink-0"
      title="Reset to default"
    >
      <RotateCcw className="h-3.5 w-3.5" />
    </Button>
  )
}

export default SettingsPanel;

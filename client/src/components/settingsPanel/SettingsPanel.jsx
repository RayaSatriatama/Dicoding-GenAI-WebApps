import React, { useContext } from "react";
import { ConfigContext } from "../configStore/ConfigStore";
import {
  Settings, RotateCcw, Cpu, Sliders, Gauge, FileText,
  GraduationCap, Sparkles, Timer, Shuffle, Eye, RefreshCw,
  Award, Clock, Languages, Hash, ListChecks, HelpCircle, Database, Brain, X
} from 'lucide-react'
import "./settingsPanel.css";

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const presets = {
  "Gemini": {
    models: [
      "gemini-3-pro", "gemini-3-flash",
      "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite",
      "gemini-2.0-flash", "gemini-2.0-flash-lite",
      "gemini-1.5-pro", "gemini-1.5-pro-latest",
      "gemini-1.5-flash", "gemini-1.5-flash-latest",
      "gemini-1.5-flash-8b", "gemini-1.5-flash-8b-latest",
      "gemini-2.5-pro-preview-06-05", "gemini-2.5-flash-preview-04-17",
      "gemini-pro-latest", "gemini-flash-latest",
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

  const updateQuizSetting = (key, value) => {
    setConfig({
      ...config,
      quizSettings: { ...config.quizSettings, [key]: value }
    });
  };

  return (
    <div className={`settings-panel ${isOpen ? 'open' : ''}`}>
      <div className="settings-header">
        <h2 className="settings-title">
          <Settings className="w-5 h-5 text-primary" />
          Pengaturan
        </h2>
        <button
          className="settings-close-btn"
          onClick={onClose}
          aria-label="Close settings"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <ScrollArea className="settings-scroll">
        <div className="settings-content">
          <Accordion type="single" collapsible className="space-y-3">

            {/* ==================== AI SETTINGS SECTION ==================== */}
            <AccordionItem value="ai-settings" className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
              <AccordionTrigger className="px-4 py-3 bg-primary/5 hover:bg-primary/10 transition-colors duration-200 cursor-pointer">
                <div className="flex items-center gap-2 text-[0.9375rem] font-medium text-slate-600">
                  <Sparkles className="w-4 h-4" />
                  <span>Pengaturan AI</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 py-4 space-y-4">

                {/* Agent & Document */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" />
                    Konteks
                  </h4>
                  <div className="space-y-3">
                    <ConfigItem label="Agent Style">
                      <Select onValueChange={(style) => setConfig({ ...config, agentStyle: style })} value={config.agentStyle}>
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue placeholder="Select agent style" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="cursor-pointer">none</SelectItem>
                          {presets[config.platform].agentStyles.map((style) => (
                            <SelectItem key={style} value={style} className="cursor-pointer">{style}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ConfigItem>
                  </div>
                </div>

                {/* Model & Platform */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    Model
                  </h4>
                  <div className="space-y-3">
                    <ConfigItem label="Platform">
                      <Select onValueChange={handlePlatformChange} value={config.platform}>
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(presets).map((key) => (
                            <SelectItem key={key} value={key} className="cursor-pointer">{key}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ConfigItem>
                    <ConfigItem label="Model">
                      <Select onValueChange={(model) => setConfig({ ...config, model })} value={config.model}>
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          {presets[platform].models.sort().map((m) => (
                            <SelectItem key={m} value={m} className="cursor-pointer">{m.replace(/^hf\.co\//, '')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ConfigItem>
                  </div>
                </div>

                {/* Generation Settings */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    Generasi
                  </h4>
                  <ConfigItem label="Max Tokens">
                    <div className="flex items-center gap-2">
                      <Slider
                        min={128}
                        max={16384}
                        step={128}
                        value={[config.maxTokens]}
                        onValueChange={(value) => setConfig({ ...config, maxTokens: value[0] })}
                        className="flex-1 cursor-pointer"
                      />
                      <Input
                        type="number"
                        value={config.maxTokens}
                        onChange={(e) => setConfig({ ...config, maxTokens: Math.min(16384, Math.max(128, parseInt(e.target.value) || 128)) })}
                        min={128}
                        max={16384}
                        className="w-20"
                      />
                      <ResetButton onClick={() => setConfig({ ...config, maxTokens: presets[config.platform].maxTokens })} />
                    </div>
                  </ConfigItem>
                </div>

                {/* Sampling */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5" />
                    Sampling
                  </h4>
                  <div className="space-y-3">
                    <ConfigItem label="Temperature">
                      <div className="flex items-center gap-2">
                        <Slider
                          min={0}
                          max={1}
                          step={0.01}
                          value={[config.temperature]}
                          onValueChange={(value) => setConfig({ ...config, temperature: value[0] })}
                          className="flex-1 cursor-pointer"
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
                    <ConfigItem label="Top-K">
                      <div className="flex items-center gap-2">
                        <Slider
                          min={0}
                          max={100}
                          value={[config.topK]}
                          onValueChange={(value) => setConfig({ ...config, topK: value[0] })}
                          className="flex-1 cursor-pointer"
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
                          min={0}
                          max={1}
                          step={0.01}
                          value={[config.topP]}
                          onValueChange={(value) => setConfig({ ...config, topP: value[0] })}
                          className="flex-1 cursor-pointer"
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
                </div>

                {/* Thinking Mode (for Gemini 2.5+) */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5" />
                    Mode Berpikir (Thinking)
                  </h4>
                  <p className="text-xs text-muted-foreground -mt-1">Untuk model Gemini 2.5 Flash/Pro</p>
                  <div className="space-y-3">
                    <ToggleOption
                      icon={<Brain className="w-3.5 h-3.5" />}
                      label="Aktifkan Thinking"
                      description="AI akan berpikir lebih dalam sebelum menjawab"
                      checked={config.enableThinking ?? false}
                      onCheckedChange={(value) => setConfig({ ...config, enableThinking: value })}
                    />

                    {config.enableThinking && (
                      <ConfigItem label={
                        <div className="flex items-center justify-between w-full">
                          <span>Thinking Budget (tokens)</span>
                          <span className="text-xs font-mono text-muted-foreground bg-slate-100 px-2 py-0.5 rounded">
                            {config.thinkingBudget || 8192}
                          </span>
                        </div>
                      }>
                        <div className="flex items-center gap-2">
                          <Slider
                            min={1024}
                            max={24576}
                            step={1024}
                            value={[config.thinkingBudget || 8192]}
                            onValueChange={(value) => setConfig({ ...config, thinkingBudget: value[0] })}
                            className="flex-1 cursor-pointer"
                          />
                          <Input
                            type="number"
                            value={config.thinkingBudget || 8192}
                            onChange={(e) => setConfig({ ...config, thinkingBudget: Math.min(24576, Math.max(1024, parseInt(e.target.value) || 1024)) })}
                            min={1024}
                            max={24576}
                            step={1024}
                            className="w-20"
                          />
                          <ResetButton onClick={() => setConfig({ ...config, thinkingBudget: 8192 })} />
                        </div>
                      </ConfigItem>
                    )}
                  </div>
                </div>

              </AccordionContent>
            </AccordionItem>

            {/* ==================== QUIZ SETTINGS SECTION ==================== */}
            <AccordionItem value="quiz-settings" className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
              <AccordionTrigger className="px-4 py-3 bg-primary/5 hover:bg-primary/10 transition-colors duration-200 cursor-pointer">
                <div className="flex items-center gap-2 text-[0.9375rem] font-medium text-slate-600">
                  <GraduationCap className="w-4 h-4" />
                  <span>Pengaturan Quiz</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 py-4 space-y-4">

                {/* Quiz Behavior */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5" />
                    Perilaku Quiz
                  </h4>
                  <div className="space-y-3">
                    <ConfigItem label={
                      <span className="flex items-center gap-1.5">
                        <HelpCircle className="w-3 h-3 text-slate-400" />
                        Tampilkan Penjelasan
                      </span>
                    }>
                      <Select
                        value={config.quizSettings?.showExplanation || 'correct-only'}
                        onValueChange={(value) => updateQuizSetting('showExplanation', value)}
                      >
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="always" className="cursor-pointer">Selalu tampilkan</SelectItem>
                          <SelectItem value="correct-only" className="cursor-pointer">Hanya saat benar</SelectItem>
                          <SelectItem value="after-answer" className="cursor-pointer">Setelah menjawab</SelectItem>
                          <SelectItem value="never" className="cursor-pointer">Jangan tampilkan</SelectItem>
                        </SelectContent>
                      </Select>
                    </ConfigItem>

                    <ConfigItem label={
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3 h-3 text-slate-400" />
                        Tampilkan Jawaban Benar
                      </span>
                    }>
                      <Select
                        value={config.quizSettings?.showCorrectAnswer || 'after-wrong'}
                        onValueChange={(value) => updateQuizSetting('showCorrectAnswer', value)}
                      >
                        <SelectTrigger className="w-full cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="always" className="cursor-pointer">Selalu tampilkan</SelectItem>
                          <SelectItem value="after-wrong" className="cursor-pointer">Setelah menjawab salah</SelectItem>
                          <SelectItem value="never" className="cursor-pointer">Jangan tampilkan</SelectItem>
                        </SelectContent>
                      </Select>
                    </ConfigItem>

                    <div className="space-y-2">
                      <ConfigItem label={
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Izinkan Coba Lagi</span>
                        </div>
                      }>
                        <Select
                          value={config.quizSettings?.allowRetry || 'never'}
                          onValueChange={(value) => updateQuizSetting('allowRetry', value)}
                        >
                          <SelectTrigger className="w-full cursor-pointer h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="never" className="cursor-pointer">Nonaktifkan</SelectItem>
                            <SelectItem value="after-wrong" className="cursor-pointer">Ulangi jika salah</SelectItem>
                            <SelectItem value="always" className="cursor-pointer">Selalu tampilkan</SelectItem>
                          </SelectContent>
                        </Select>
                      </ConfigItem>
                      {/* <ToggleOption
                        icon={<Shuffle className="w-3.5 h-3.5" />}
                        label="Acak Pilihan"
                        description="Acak urutan opsi A/B/C/D"
                        checked={config.quizSettings?.shuffleOptions ?? false}
                        onCheckedChange={(value) => updateQuizSetting('shuffleOptions', value)}
                      /> */}
                      <ToggleOption
                        icon={<Award className="w-3.5 h-3.5" />}
                        label="Tampilkan Skor"
                        description="Tampilkan skor benar/salah di atas soal"
                        checked={config.quizSettings?.showScore ?? true}
                        onCheckedChange={(value) => updateQuizSetting('showScore', value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Timer Settings */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5" />
                    Pengaturan Timer
                  </h4>
                  <p className="text-xs text-muted-foreground -mt-1">Batas waktu untuk menjawab setiap soal</p>
                  <div className="space-y-3">
                    <ToggleOption
                      icon={<Clock className="w-3.5 h-3.5" />}
                      label="Mode Timer"
                      description="Aktifkan countdown timer per soal"
                      checked={config.quizSettings?.timedQuiz ?? false}
                      onCheckedChange={(value) => updateQuizSetting('timedQuiz', value)}
                    />

                    {config.quizSettings?.timedQuiz && (
                      <div className="space-y-1.5 pl-6 border-l-2 border-emerald-200">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-medium text-slate-600">Waktu per Soal</Label>
                          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {config.quizSettings?.timePerQuestion || 30}s
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Slider
                            min={10}
                            max={120}
                            step={5}
                            value={[config.quizSettings?.timePerQuestion || 30]}
                            onValueChange={(value) => updateQuizSetting('timePerQuestion', value[0])}
                            className="flex-1 cursor-pointer"
                          />
                          <Input
                            type="number"
                            value={config.quizSettings?.timePerQuestion || 30}
                            onChange={(e) => updateQuizSetting('timePerQuestion', parseInt(e.target.value) || 30)}
                            min={10}
                            max={120}
                            className="w-16"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Default Question Settings */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Default Soal
                  </h4>
                  <p className="text-xs text-muted-foreground -mt-1">Aktifkan opsi untuk mengatur nilai default</p>

                  <div className="space-y-2">
                    {/* Difficulty Toggle */}
                    <ToggleWithContent
                      icon={<Gauge className="w-3.5 h-3.5" />}
                      label="Tingkat Kesulitan"
                      enabled={config.quizSettings?.useDifficulty ?? false}
                      onEnabledChange={(value) => updateQuizSetting('useDifficulty', value)}
                    >
                      <Select
                        value={config.quizSettings?.difficulty || 'mots'}
                        onValueChange={(value) => updateQuizSetting('difficulty', value)}
                      >
                        <SelectTrigger className="w-full cursor-pointer h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="random" className="cursor-pointer">Acak</SelectItem>
                          <SelectItem value="lots" className="cursor-pointer">LOTS (Mudah)</SelectItem>
                          <SelectItem value="mots" className="cursor-pointer">MOTS (Sedang)</SelectItem>
                          <SelectItem value="hots" className="cursor-pointer">HOTS (Sulit)</SelectItem>
                        </SelectContent>
                      </Select>
                    </ToggleWithContent>

                    {/* Number of Questions Toggle */}
                    <ToggleWithContent
                      icon={<Hash className="w-3.5 h-3.5" />}
                      label="Jumlah Soal"
                      badge={config.quizSettings?.useNumQuestions ? (config.quizSettings?.numQuestions || 5) : null}
                      enabled={config.quizSettings?.useNumQuestions ?? false}
                      onEnabledChange={(value) => updateQuizSetting('useNumQuestions', value)}
                    >
                      <Slider
                        min={1}
                        max={20}
                        step={1}
                        value={[config.quizSettings?.numQuestions || 5]}
                        onValueChange={(value) => updateQuizSetting('numQuestions', value[0])}
                        className="cursor-pointer"
                      />
                    </ToggleWithContent>

                    {/* Question Types Multi-Select Toggle */}
                    <ToggleWithContent
                      icon={<ListChecks className="w-3.5 h-3.5" />}
                      label="Tipe Soal"
                      enabled={config.quizSettings?.useQuestionTypes ?? false}
                      onEnabledChange={(value) => updateQuizSetting('useQuestionTypes', value)}
                    >
                      <div className="flex flex-wrap gap-1">
                        {[
                          { value: 'multiple_choice', label: 'Pilihan Ganda' },
                          { value: 'multibox', label: 'Pilihan Ganda Kompleks' },
                          { value: 'true_false', label: 'Benar/Salah' },
                          { value: 'short_answer', label: 'Jawaban Singkat' },
                          { value: 'essay', label: 'Essay' },
                          { value: 'matching', label: 'Menjodohkan' },
                          { value: 'fill_blank', label: 'Isian Kosong' },
                        ].map((type) => {
                          const isSelected = (config.quizSettings?.questionTypes || ['multiple_choice']).includes(type.value);
                          return (
                            <button
                              key={type.value}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const current = config.quizSettings?.questionTypes || ['multiple_choice'];
                                const newTypes = isSelected
                                  ? current.filter(t => t !== type.value)
                                  : [...current, type.value];
                                updateQuizSetting('questionTypes', newTypes.length > 0 ? newTypes : ['multiple_choice']);
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded cursor-pointer border transition-all whitespace-nowrap ${isSelected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background border-border hover:border-primary/50 text-muted-foreground'
                                }`}
                            >
                              {type.label}
                            </button>
                          );
                        })}
                      </div>
                    </ToggleWithContent>

                    {/* Language Toggle */}
                    <ToggleWithContent
                      icon={<Languages className="w-3.5 h-3.5" />}
                      label="Bahasa"
                      enabled={config.quizSettings?.useLanguage ?? false}
                      onEnabledChange={(value) => updateQuizSetting('useLanguage', value)}
                    >
                      <Select
                        value={config.quizSettings?.language || 'id'}
                        onValueChange={(value) => updateQuizSetting('language', value)}
                      >
                        <SelectTrigger className="w-full cursor-pointer h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="id" className="cursor-pointer">Indonesia</SelectItem>
                          <SelectItem value="en" className="cursor-pointer">English</SelectItem>
                        </SelectContent>
                      </Select>
                    </ToggleWithContent>
                  </div>
                </div>

              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </div>
      </ScrollArea>
    </div>
  )
}

function ConfigItem({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  )
}

function ToggleOption({ icon, label, description, checked, onCheckedChange }) {
  return (
    <div
      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors duration-150 cursor-pointer group"
      onClick={() => onCheckedChange(!checked)}
    >
      <div className="flex items-start gap-2">
        <span className="text-slate-400 mt-0.5 group-hover:text-slate-600 transition-colors">{icon}</span>
        <div className="space-y-0">
          <p className="text-sm font-medium text-slate-700 leading-tight">{label}</p>
          {description && (
            <p className="text-xs text-slate-400 leading-tight">{description}</p>
          )}
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

function ResetButton({ onClick }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="h-7 w-7 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors duration-200 flex-shrink-0 cursor-pointer"
      title="Reset to default"
    >
      <RotateCcw className="h-3.5 w-3.5" />
    </Button>
  )
}

function ToggleWithContent({ icon, label, badge, enabled, onEnabledChange, children }) {
  return (
    <div className={`rounded-lg border transition-all duration-200 ${enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-background'}`}>
      <div
        className="flex items-center justify-between py-2 px-3 cursor-pointer"
        onClick={() => onEnabledChange(!enabled)}
      >
        <div className="flex items-center gap-2">
          <span className={`transition-colors ${enabled ? 'text-primary' : 'text-slate-400'}`}>{icon}</span>
          <span className={`text-sm font-medium transition-colors ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
          {badge !== null && badge !== undefined && (
            <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">{badge}</span>
          )}
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          className="cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      {enabled && (
        <div className="px-3 pb-3 pt-1">
          {children}
        </div>
      )}
    </div>
  )
}

export default SettingsPanel;

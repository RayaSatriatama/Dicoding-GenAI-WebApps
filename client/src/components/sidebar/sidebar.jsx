import React, { useContext, useEffect, useState } from "react";
import { ConfigContext } from "../configStore/ConfigStore";
import {
  Settings, RotateCcw, Cpu, Sliders, Gauge, Database,
  GraduationCap, FileText, Bot, Sparkles, Timer, Shuffle,
  Eye, EyeOff, RefreshCw, Award, Clock, Languages, Hash,
  ListChecks, HelpCircle
} from 'lucide-react'
import { useAuth } from '@clerk/clerk-react';

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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
      "gemini-2.5-flash", "gemini-2.5-flash-preview-05-20", "gemini-2.5-pro", "gemini-2.5-pro-preview-05-06",
      "gemini-2.0-flash", "gemini-2.0-flash-exp", "gemini-2.0-flash-lite",
      "gemini-1.5-flash", "gemini-1.5-flash-001", "gemini-1.5-flash-002",
      "gemini-1.5-flash-8b", "gemini-1.5-flash-8b-001", "gemini-1.5-flash-latest",
      "gemini-1.5-pro", "gemini-1.5-pro-001", "gemini-1.5-pro-002", "gemini-1.5-pro-latest",
      "gemini-1.0-pro", "gemini-1.0-pro-001", "gemini-1.0-pro-latest",
      "gemini-pro", "gemini-pro-vision", "learnlm-1.5-pro-experimental"
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

export function Sidebar() {
  const { config, setConfig } = useContext(ConfigContext);
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
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

  const updateQuizSetting = (key, value) => {
    setConfig({
      ...config,
      quizSettings: { ...config.quizSettings, [key]: value }
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full transition-all duration-200 bg-white hover:bg-primary text-slate-600 hover:text-white border-slate-200 hover:border-primary shadow-sm cursor-pointer"
        >
          <Settings className="h-5 w-5" />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[360px] sm:w-[420px] overflow-y-auto bg-slate-50 border-l border-slate-200 shadow-2xl p-0"
      >
        <SheetHeader className="p-4 bg-white border-b border-slate-200 sticky top-0 z-10">
          <SheetTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Pengaturan
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-4rem)]">
          <div className="p-4">
            <Accordion type="multiple" defaultValue={["ai-settings", "quiz-settings"]} className="space-y-3">

              {/* ==================== AI SETTINGS SECTION ==================== */}
              <AccordionItem value="ai-settings" className="border rounded-xl bg-white shadow-sm overflow-hidden">
                <AccordionTrigger className="px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors duration-200 text-blue-700 font-semibold">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    <span>Pengaturan AI</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 py-4 space-y-5">

                  {/* Model & Platform */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5" />
                      Model
                    </h4>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-slate-600">Platform</Label>
                        <Select onValueChange={handlePlatformChange} value={config.platform}>
                          <SelectTrigger className="w-full h-9 cursor-pointer">
                            <SelectValue placeholder="Select platform" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(presets).map((key) => (
                              <SelectItem key={key} value={key} className="cursor-pointer">{key}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-slate-600">Model</Label>
                        <Select onValueChange={(model) => setConfig({ ...config, model })} value={config.model}>
                          <SelectTrigger className="w-full h-9 cursor-pointer">
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            {presets[platform].models.sort().map((m) => (
                              <SelectItem key={m} value={m} className="cursor-pointer">{m.replace(/^hf\.co\//, '')}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Context */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5" />
                      Konteks
                    </h4>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-slate-600">Agent Style</Label>
                        <Select onValueChange={(style) => setConfig({ ...config, agentStyle: style })} value={config.agentStyle}>
                          <SelectTrigger className="w-full h-9 cursor-pointer">
                            <SelectValue placeholder="Select agent style" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="cursor-pointer">none</SelectItem>
                            {presets[config.platform].agentStyles.map((style) => (
                              <SelectItem key={style} value={style} className="cursor-pointer">{style}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-slate-600">Document</Label>
                        <Select onValueChange={(doc) => setConfig({ ...config, document: doc })} value={config.document}>
                          <SelectTrigger className="w-full h-9 cursor-pointer">
                            <SelectValue placeholder="Select document" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="cursor-pointer">none</SelectItem>
                            {documents.map((doc) => (
                              <SelectItem key={doc} value={doc} className="cursor-pointer">{doc}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Generation */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5" />
                      Generasi
                    </h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-medium text-slate-600">Max Tokens</Label>
                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {config.maxTokens}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Slider
                          min={256}
                          max={8096}
                          step={256}
                          value={[config.maxTokens]}
                          onValueChange={(value) => setConfig({ ...config, maxTokens: value[0] })}
                          className="flex-1 cursor-pointer"
                        />
                        <Input
                          type="number"
                          value={config.maxTokens}
                          onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) || 2048 })}
                          min={256}
                          max={8096}
                          className="w-20 h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sampling */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5" />
                      Sampling
                    </h4>
                    <div className="space-y-4">
                      {/* Temperature */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-medium text-slate-600">Temperature</Label>
                          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {config.temperature?.toFixed(2)}
                          </span>
                        </div>
                        <Slider
                          min={0}
                          max={2}
                          step={0.01}
                          value={[config.temperature]}
                          onValueChange={(value) => setConfig({ ...config, temperature: value[0] })}
                          className="cursor-pointer"
                        />
                      </div>
                      {/* Top-K */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-medium text-slate-600">Top-K</Label>
                          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {config.topK}
                          </span>
                        </div>
                        <Slider
                          min={1}
                          max={100}
                          step={1}
                          value={[config.topK]}
                          onValueChange={(value) => setConfig({ ...config, topK: value[0] })}
                          className="cursor-pointer"
                        />
                      </div>
                      {/* Top-P */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-medium text-slate-600">Top-P</Label>
                          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {config.topP?.toFixed(2)}
                          </span>
                        </div>
                        <Slider
                          min={0}
                          max={1}
                          step={0.01}
                          value={[config.topP]}
                          onValueChange={(value) => setConfig({ ...config, topP: value[0] })}
                          className="cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Reset Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePlatformChange(config.platform)}
                    className="w-full mt-2 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset ke Default
                  </Button>
                </AccordionContent>
              </AccordionItem>

              {/* ==================== QUIZ SETTINGS SECTION ==================== */}
              <AccordionItem value="quiz-settings" className="border rounded-xl bg-white shadow-sm overflow-hidden">
                <AccordionTrigger className="px-4 py-3 bg-emerald-50 hover:bg-emerald-100 transition-colors duration-200 text-emerald-700 font-semibold">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-emerald-500" />
                    <span>Pengaturan Quiz</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 py-4 space-y-5">

                  {/* Quiz Behavior */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <ListChecks className="w-3.5 h-3.5" />
                      Perilaku Quiz
                    </h4>
                    <div className="space-y-3">
                      {/* Show Explanation */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                          <HelpCircle className="w-3 h-3 text-slate-400" />
                          Tampilkan Penjelasan
                        </Label>
                        <Select
                          value={config.quizSettings?.showExplanation || 'correct-only'}
                          onValueChange={(value) => updateQuizSetting('showExplanation', value)}
                        >
                          <SelectTrigger className="w-full h-9 cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="always" className="cursor-pointer">Selalu tampilkan</SelectItem>
                            <SelectItem value="correct-only" className="cursor-pointer">Hanya saat benar</SelectItem>
                            <SelectItem value="after-answer" className="cursor-pointer">Setelah menjawab</SelectItem>
                            <SelectItem value="never" className="cursor-pointer">Jangan tampilkan</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Toggle Options */}
                      <div className="space-y-2">
                        <ToggleOption
                          icon={<Eye className="w-3.5 h-3.5" />}
                          label="Tampilkan Jawaban Benar"
                          description="Setelah menjawab salah"
                          checked={config.quizSettings?.showCorrectAnswer ?? true}
                          onCheckedChange={(value) => updateQuizSetting('showCorrectAnswer', value)}
                        />
                        <ToggleOption
                          icon={<RefreshCw className="w-3.5 h-3.5" />}
                          label="Izinkan Coba Lagi"
                          description="Ulangi jika salah"
                          checked={config.quizSettings?.allowRetry ?? false}
                          onCheckedChange={(value) => updateQuizSetting('allowRetry', value)}
                        />
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
                          description="Skor berjalan"
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
                    <div className="space-y-3">
                      <ToggleOption
                        icon={<Clock className="w-3.5 h-3.5" />}
                        label="Mode Timer"
                        description="Batas waktu per soal"
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
                              className="w-16 h-8 text-xs"
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
                    <div className="space-y-3">
                      {/* Difficulty */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-slate-600">Tingkat Kesulitan</Label>
                        <Select
                          value={config.quizSettings?.difficulty || 'medium'}
                          onValueChange={(value) => updateQuizSetting('difficulty', value)}
                        >
                          <SelectTrigger className="w-full h-9 cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy" className="cursor-pointer">Mudah</SelectItem>
                            <SelectItem value="medium" className="cursor-pointer">Sedang</SelectItem>
                            <SelectItem value="hard" className="cursor-pointer">Sulit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Number of Questions */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                            <Hash className="w-3 h-3 text-slate-400" />
                            Jumlah Soal
                          </Label>
                          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {config.quizSettings?.numQuestions || 5}
                          </span>
                        </div>
                        <Slider
                          min={1}
                          max={20}
                          step={1}
                          value={[config.quizSettings?.numQuestions || 5]}
                          onValueChange={(value) => updateQuizSetting('numQuestions', value[0])}
                          className="cursor-pointer"
                        />
                      </div>

                      {/* Question Type */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-slate-600">Tipe Soal</Label>
                        <Select
                          value={config.quizSettings?.questionType || 'multiple_choice'}
                          onValueChange={(value) => updateQuizSetting('questionType', value)}
                        >
                          <SelectTrigger className="w-full h-9 cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="multiple_choice" className="cursor-pointer">Pilihan Ganda</SelectItem>
                            <SelectItem value="true_false" className="cursor-pointer">Benar/Salah</SelectItem>
                            <SelectItem value="short_answer" className="cursor-pointer">Jawaban Singkat</SelectItem>
                            <SelectItem value="essay" className="cursor-pointer">Essay</SelectItem>
                            <SelectItem value="matching" className="cursor-pointer">Menjodohkan</SelectItem>
                            <SelectItem value="fill_blank" className="cursor-pointer">Isian Kosong</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Language */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                          <Languages className="w-3 h-3 text-slate-400" />
                          Bahasa
                        </Label>
                        <Select
                          value={config.quizSettings?.language || 'id'}
                          onValueChange={(value) => updateQuizSetting('language', value)}
                        >
                          <SelectTrigger className="w-full h-9 cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="id" className="cursor-pointer">Indonesia</SelectItem>
                            <SelectItem value="en" className="cursor-pointer">English</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// Toggle Option Component
function ToggleOption({ icon, label, description, checked, onCheckedChange }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors duration-150 cursor-pointer group"
      onClick={() => onCheckedChange(!checked)}>
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

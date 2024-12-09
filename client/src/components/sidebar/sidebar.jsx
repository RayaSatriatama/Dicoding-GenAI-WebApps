import React, { useContext } from "react";
import { ConfigContext } from "../configStore/ConfigStore";
import { Settings, Trash2 } from 'lucide-react'

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

const presets = {
  "Gemini": {
    models: [
      "aqa", "chat-bison-001", "gemini-1.0-pro", "gemini-1.0-pro-001", "gemini-1.0-pro-latest",
      "gemini-1.0-pro-vision-latest", "gemini-1.5-flash", "gemini-1.5-flash-001",
      "gemini-1.5-flash-001-tuning", "gemini-1.5-flash-002", "gemini-1.5-flash-8b",
      "gemini-1.5-flash-8b-001", "gemini-1.5-flash-8b-exp-0827", "gemini-1.5-flash-8b-exp-0924",
      "gemini-1.5-flash-8b-latest", "gemini-1.5-flash-exp-0827", "gemini-1.5-flash-latest",
      "gemini-1.5-pro", "gemini-1.5-pro-001", "gemini-1.5-pro-002", "gemini-1.5-pro-exp-0801",
      "gemini-1.5-pro-exp-0827", "gemini-1.5-pro-latest", "gemini-exp-1114", "gemini-exp-1121",
      "gemini-exp-1206", "gemini-pro", "gemini-pro-vision", "learnlm-1.5-pro-experimental",
      "text-bison-001"
    ],
    maxTokens: 2048,
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    agentStyles: ["generate-question", "chat-forum"],
    documents: ["None", "General Knowledge", "Code Documentation"]
  },
  "Ollama": {
    models: ["hf.co/gmonsoon/gemma2-9b-cpt-sahabatai-v1-instruct-GGUF:latest", "hf.co/gmonsoon/llama3-8b-cpt-sahabatai-v1-instruct-GGUF:latest", "hf.co/QuantFactory/komodo-7b-base-GGUF:latest", "llama3-8b-cpt-sahabatai-v1-instruct", "llama3.1:8b-instruct-q4_K_M"],
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
  const [open, setOpen] = React.useState(false)

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

  // Ensure config.platform is valid before accessing presets
  const platform = config.platform || Object.keys(presets)[0];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full transition-all duration-300 bg-white hover:bg-gray-900 text-gray-900 hover:text-white"
        >
          <Settings className="h-5 w-5" />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[300px] sm:w-[400px] overflow-y-auto bg-background/80 backdrop-blur-md border-l border-primary/20 shadow-xl transition-all duration-300"
      >
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold text-primary">Configuration</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-5rem)] pb-10">
          <div className="space-y-8 p-6">
            <ConfigSection title="Model">
              <div className="space-y-4">
                <ConfigItem label="Platform">
                  <Select onValueChange={handlePlatformChange} value={config.platform}>
                    <SelectTrigger id="platform">
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
                    <SelectTrigger id="model">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {presets[platform].models.sort().map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ConfigItem>
              </div>
            </ConfigSection>

            <ConfigSection title="Setting">
              <div className="space-y-4">
                <ConfigItem label="Max Tokens">
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      value={config.maxTokens}
                      onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                      min={0}
                      max={9999}
                      disabled={config.unlimitedTokens}
                      className="w-24"
                    />
                    <Switch
                      checked={config.unlimitedTokens}
                      onCheckedChange={(value) => setConfig({ ...config, unlimitedTokens: value })}
                    />
                    <Label htmlFor="unlimited-tokens" className="text-sm">Unlimited</Label>
                    <ResetButton onClick={() => setConfig({ ...config, maxTokens: presets[config.platform].maxTokens })} />
                  </div>
                </ConfigItem>
                <ConfigItem label="Temperature">
                  <div className="flex items-center space-x-2">
                    <Slider
                      id="temperature"
                      min={0}
                      max={1}
                      step={0.01}
                      value={[config.temperature]}
                      onValueChange={(value) => setConfig({ ...config, temperature: value[0] })}
                      className="w-[60%]"
                    />
                    <Input
                      type="number"
                      value={config.temperature}
                      onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                      min={0}
                      max={1}
                      step={0.01}
                      className="w-20"
                    />
                    <ResetButton onClick={() => setConfig({ ...config, temperature: presets[config.platform].temperature })} />
                  </div>
                </ConfigItem>
              </div>
            </ConfigSection>

            <ConfigSection title="Sampling">
              <div className="space-y-4">
                <ConfigItem label="Top-K">
                  <div className="flex items-center space-x-2">
                    <Slider
                      id="top-k"
                      min={0}
                      max={100}
                      value={[config.topK]}
                      onValueChange={(value) => setConfig({ ...config, topK: value[0] })}
                      className="w-[60%]"
                    />
                    <Input
                      type="number"
                      value={config.topK}
                      onChange={(e) => setConfig({ ...config, topK: parseInt(e.target.value) })}
                      min={0}
                      max={100}
                      className="w-20"
                    />
                    <ResetButton onClick={() => setConfig({ ...config, topK: presets[config.platform].topK })} />
                  </div>
                </ConfigItem>
                <ConfigItem label="Top-P">
                  <div className="flex items-center space-x-2">
                    <Slider
                      id="top-p"
                      min={0}
                      max={1}
                      step={0.01}
                      value={[config.topP]}
                      onValueChange={(value) => setConfig({ ...config, topP: value[0] })}
                      className="w-[60%]"
                    />
                    <Input
                      type="number"
                      value={config.topP}
                      onChange={(e) => setConfig({ ...config, topP: parseFloat(e.target.value) })}
                      min={0}
                      max={1}
                      step={0.01}
                      className="w-20"
                    />
                    <ResetButton onClick={() => setConfig({ ...config, topP: presets[config.platform].topP })} />
                  </div>
                </ConfigItem>
              </div>
            </ConfigSection>

            <ConfigSection title="Agents">
              <ConfigItem label="Agent Style">
                <Select onValueChange={(style) => setConfig({ ...config, agentStyle: style })} value={config.agentStyle}>
                  <SelectTrigger id="agent-style">
                    <SelectValue placeholder="Select agent style" />
                  </SelectTrigger>
                  <SelectContent>
                    {presets[config.platform].agentStyles.map((style) => (
                      <SelectItem key={style} value={style}>{style}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ConfigItem>
            </ConfigSection>

            <ConfigSection title="Document">
              <ConfigItem label="Document">
                <Select onValueChange={(doc) => setConfig({ ...config, document: doc })} value={config.document}>
                  <SelectTrigger id="document">
                    <SelectValue placeholder="Select document" />
                  </SelectTrigger>
                  <SelectContent>
                    {presets[config.platform].documents.map((doc) => (
                      <SelectItem key={doc} value={doc}>{doc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ConfigItem>
            </ConfigSection>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function ConfigSection({ title, children }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary">{title}</h3>
      {children}
    </div>
  )
}

function ConfigItem({ label, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function ResetButton({ onClick }) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      className="h-8 w-8 rounded-full bg-white hover:bg-gray-900 text-gray-900 hover:text-white transition-colors duration-200"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}

export default Sidebar;
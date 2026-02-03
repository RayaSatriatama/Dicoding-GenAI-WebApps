import React, { useState } from 'react';
import { Download, Copy, FileJson, FileText, File, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import './QuestionExport.css';

/**
 * QuestionExport Component
 * 
 * Provides export functionality for question sets:
 * - JSON (for programmatic use)
 * - Markdown (for documentation)
 * - Moodle XML (for LMS import)
 * - Aiken format (simple Moodle import)
 */

const QuestionExport = ({ sessionId, questionSet, onClose }) => {
  const [exportFormat, setExportFormat] = useState('json');
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [exportedContent, setExportedContent] = useState('');
  const [error, setError] = useState(null);

  const formatOptions = [
    { value: 'json', label: 'JSON', icon: <FileJson className="w-4 h-4" />, ext: '.json' },
    { value: 'markdown', label: 'Markdown', icon: <FileText className="w-4 h-4" />, ext: '.md' },
    { value: 'moodle_xml', label: 'Moodle XML', icon: <File className="w-4 h-4" />, ext: '.xml' },
    { value: 'aiken', label: 'Aiken', icon: <File className="w-4 h-4" />, ext: '.txt' },
  ];

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_PROXY_URL}/api/agent/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          format: exportFormat,
          includeAnswers
        })
      });

      if (response.ok) {
        const result = await response.json();
        setExportedContent(result.content);
      } else {
        throw new Error('Export failed');
      }
    } catch (err) {
      console.error('Export error:', err);
      // Fallback to local export
      setExportedContent(exportLocally());
    } finally {
      setIsExporting(false);
    }
  };

  const exportLocally = () => {
    if (!questionSet) return '';
    
    if (exportFormat === 'json') {
      const data = { ...questionSet };
      if (!includeAnswers) {
        data.questions = data.questions.map(q => ({
          ...q,
          correct_answer: undefined,
          explanation: undefined,
          options: q.options?.map(o => ({ ...o, is_correct: undefined }))
        }));
      }
      return JSON.stringify(data, null, 2);
    }
    
    if (exportFormat === 'markdown') {
      let md = `# ${questionSet.title || 'Question Set'}\n\n`;
      if (questionSet.description) md += `*${questionSet.description}*\n\n`;
      md += `**Total Questions:** ${questionSet.questions?.length || 0}\n\n---\n\n`;
      
      questionSet.questions?.forEach((q, i) => {
        md += `## Question ${i + 1}\n\n${q.question_text || q.question}\n\n`;
        
        if (q.options) {
          q.options.forEach(opt => {
            const marker = includeAnswers && opt.is_correct ? '- [x]' : '- [ ]';
            md += `${marker} **${opt.id}.** ${opt.text}\n`;
          });
        }
        
        if (includeAnswers) {
          md += `\n**Answer:** ${q.correct_answer}\n`;
          if (q.explanation) md += `\n> 💡 **Explanation:** ${q.explanation}\n`;
        }
        
        md += '\n---\n\n';
      });
      
      return md;
    }
    
    if (exportFormat === 'aiken') {
      return questionSet.questions
        ?.filter(q => q.type === 'multiple_choice')
        .map(q => {
          let text = `${q.question_text || q.question}\n`;
          q.options?.forEach(opt => {
            text += `${opt.id}. ${opt.text}\n`;
          });
          if (includeAnswers) {
            text += `ANSWER: ${q.correct_answer}`;
          }
          return text;
        })
        .join('\n\n') || '';
    }
    
    if (exportFormat === 'moodle_xml') {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<quiz>\n';
      
      questionSet.questions?.forEach(q => {
        if (q.type !== 'multiple_choice') return;
        
        xml += '  <question type="multichoice">\n';
        xml += `    <name><text>${q.id}</text></name>\n`;
        xml += `    <questiontext format="html"><text><![CDATA[${q.question_text || q.question}]]></text></questiontext>\n`;
        xml += '    <single>true</single>\n';
        xml += '    <shuffleanswers>true</shuffleanswers>\n';
        
        q.options?.forEach(opt => {
          const fraction = includeAnswers && opt.is_correct ? '100' : '0';
          xml += `    <answer fraction="${fraction}" format="html">\n`;
          xml += `      <text><![CDATA[${opt.text}]]></text>\n`;
          xml += '    </answer>\n';
        });
        
        xml += '  </question>\n';
      });
      
      xml += '</quiz>';
      return xml;
    }
    
    return '';
  };

  const handleCopy = async () => {
    const content = exportedContent || exportLocally();
    
    try {
      await navigator.clipboard.writeText(content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      setError('Failed to copy to clipboard');
    }
  };

  const handleDownload = () => {
    const content = exportedContent || exportLocally();
    const format = formatOptions.find(f => f.value === exportFormat);
    const filename = `questions_${sessionId}${format?.ext || '.txt'}`;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="export-modal-overlay">
      <div className="export-modal">
        <div className="export-header">
          <h3>Export Questions</h3>
          <button className="close-btn" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="export-body">
          <div className="export-options">
            <div className="option-group">
              <Label>Format</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {formatOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        {opt.icon}
                        <span>{opt.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="option-group flex items-center justify-between">
              <Label htmlFor="include-answers">Include Answers</Label>
              <Switch 
                id="include-answers"
                checked={includeAnswers}
                onCheckedChange={setIncludeAnswers}
              />
            </div>
          </div>
          
          {/* Preview */}
          {exportedContent && (
            <div className="export-preview">
              <Label>Preview</Label>
              <pre className="preview-content">
                {exportedContent.substring(0, 500)}
                {exportedContent.length > 500 && '...'}
              </pre>
            </div>
          )}
          
          {error && (
            <div className="export-error">
              {error}
            </div>
          )}
        </div>
        
        <div className="export-footer">
          <Button variant="outline" onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Generating...' : 'Generate Export'}
          </Button>
          <Button variant="outline" onClick={handleCopy}>
            {copySuccess ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
            {copySuccess ? 'Copied!' : 'Copy'}
          </Button>
          <Button onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuestionExport;

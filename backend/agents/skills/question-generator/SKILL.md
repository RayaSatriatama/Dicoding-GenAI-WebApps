---
name: question-generator
description: Educational quiz and question generation skill with interactive testing. Use when users want to (1) generate quiz questions from topics or documents, (2) create practice tests with various question types (multiple choice, multiple select, true/false, essay, short answer, fill blank, matching), (3) check answers interactively with feedback, (4) export questions to markdown/JSON/Aiken format, or (5) run interactive quiz sessions with score tracking.
---

# Question Generator Skill

Generate educational questions, run interactive quizzes, and export to various formats.

## Supported Question Types

| Type | Description | Answer Format |
|------|-------------|---------------|
| `multiple_choice` | Single correct answer (A/B/C/D) | `B` |
| `multiple_select` | Multiple correct answers | `A,C,D` |
| `true_false` | True or False statement | `benar` or `salah` |
| `essay` | Long-form response | Free text |
| `short_answer` | 1-3 sentence response | Brief text |
| `fill_blank` | Complete the sentence | Word/phrase |
| `matching` | Match items from two columns | `1-C, 2-A, 3-B` |

## Core Workflow

### 1. Generate Questions

Use `generate_questions` tool with parameters:
- `topic`: Subject matter (required)
- `question_type`: One of the types above (default: `multiple_choice`)
- `num_questions`: 1-10 (default: 3)
- `difficulty`: easy/medium/hard (default: `medium`)
- `language`: id/en (default: `id`)
- `quiz_mode`: Hide answers for interactive testing (default: `true`)

Example outputs by type: See [references/question-formats.md](references/question-formats.md)

### 2. Check Answers (Interactive Mode)

Use `check_answer` tool when user submits an answer:
- `question_number`: Which question (1-based)
- `user_answer`: User's response

Provide educational feedback with explanation, not just correct/incorrect.

### 3. Show Answers

Use `show_answers` tool to reveal answer key:
- `show_all`: Show all answers (default: true)
- `question_numbers`: Specific questions only

Include user's score summary when showing answers.

### 4. Export Questions

Use `export_questions` tool:
- `format`: markdown/json/aiken
- `include_answers`: Include answer key (default: true)

Format details: See [references/export-formats.md](references/export-formats.md)

## Quiz Session Flow

```
User: "Buat 3 soal pilihan ganda tentang fotosintesis"
       ↓
Agent: Display questions WITHOUT answers (quiz_mode=true)
       ↓
User: "jawab 1 B"
       ↓
Agent: ✅/❌ + explanation + current score
       ↓
User: "lihat jawaban" (or continues answering)
       ↓
Agent: Show all answers + final score
       ↓
User: "export ke markdown"
       ↓
Agent: Generate exportable file
```

## Answer Input Patterns

Recognize these user input patterns:
- `jawab 1 B` → Check answer B for question 1
- `jawab 2 A,C,D` → Multiple select answer
- `jawab 3 benar` → True/false answer
- `jawab 4 1-C, 2-A, 3-B` → Matching answer
- `1. B, 2. A,C, 3. salah` → Batch answers
- `lihat jawaban` → Show all answers
- `export ke markdown` → Export questions

## Feedback Format

### Correct Answer
```
✅ **BENAR!**
Jawaban Anda: **B. [option text]**
💡 **Penjelasan:** [Educational explanation]
📊 Skor: X/Y (Z%)
```

### Wrong Answer
```
❌ **SALAH!**
Jawaban Anda: **A. [option text]**
Jawaban Benar: **B. [correct text]**
💡 **Penjelasan:** [Educational explanation]
📊 Skor: X/Y (Z%)
```

### Partial (Multiple Select)
```
⚠️ **SEBAGIAN BENAR!**
Jawaban Anda: **A, C**
Jawaban Lengkap: **A, C, D**
💡 **Penjelasan:** [What was missed and why]
📊 Skor: X/Y (Z%)
```

## Integration with RAG

When documents are available in context:
- Generate questions based on document content
- Cite specific sections in explanations
- Maintain factual accuracy to source material

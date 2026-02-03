# Export Format Specifications

This reference contains format specifications for exporting questions.

## Table of Contents
- [Markdown Export](#markdown-export)
- [JSON Export](#json-export)
- [Aiken Format (Moodle)](#aiken-format-moodle)

---

## Markdown Export

Human-readable format for documentation, GitHub, Notion.

### With Answers

```markdown
# Soal [Topic]
*Dibuat pada: [Date]*

**Total:** [N] soal | **Poin:** [N]

---

## Soal 1 (Pilihan Ganda)

Proses fotosintesis terjadi di bagian sel tumbuhan yang disebut...

- [ ] A. Mitokondria
- [x] B. Kloroplas ✓
- [ ] C. Ribosom
- [ ] D. Nukleus

> 💡 **Penjelasan:** Kloroplas mengandung klorofil untuk fotosintesis

---

## Soal 2 (Multiple Select)

Planet yang memiliki cincin adalah... *(pilih semua yang benar)*

- [ ] A. Mars
- [x] B. Jupiter ✓
- [x] C. Saturnus ✓
- [x] D. Uranus ✓
- [x] E. Neptunus ✓

> 💡 **Penjelasan:** Semua planet gas raksasa memiliki sistem cincin

---

## Soal 3 (Matching)

Cocokkan planet dengan cirinya!

| Item | Jawaban |
|------|---------|
| 1. Mars | C. Planet merah |
| 2. Jupiter | A. Planet terbesar |
| 3. Merkurius | B. Terdekat dari matahari |

---

## Kunci Jawaban

| No | Jawaban | Poin |
|----|---------|------|
| 1 | B | 1 |
| 2 | B,C,D,E | 1 |
| 3 | 1-C, 2-A, 3-B | 1 |

**Total Poin:** 3
```

### Without Answers

Same format but:
- Remove `[x]` marks
- Remove `✓` symbols
- Omit "Kunci Jawaban" section
- Omit "Penjelasan" sections

---

## JSON Export

Structured format for APIs, databases, programmatic use.

```json
{
  "metadata": {
    "title": "Soal Fotosintesis",
    "topic": "Fotosintesis",
    "created_at": "2026-02-01T10:30:00Z",
    "total_questions": 3,
    "total_points": 3,
    "difficulty": "medium",
    "language": "id"
  },
  "questions": [
    {
      "id": 1,
      "type": "multiple_choice",
      "text": "Proses fotosintesis terjadi di bagian sel tumbuhan yang disebut...",
      "options": [
        {"id": "A", "text": "Mitokondria", "is_correct": false},
        {"id": "B", "text": "Kloroplas", "is_correct": true},
        {"id": "C", "text": "Ribosom", "is_correct": false},
        {"id": "D", "text": "Nukleus", "is_correct": false}
      ],
      "correct_answer": "B",
      "explanation": "Kloroplas mengandung klorofil untuk fotosintesis",
      "difficulty": "medium",
      "points": 1
    },
    {
      "id": 2,
      "type": "multiple_select",
      "text": "Planet yang memiliki cincin adalah...",
      "options": [
        {"id": "A", "text": "Mars", "is_correct": false},
        {"id": "B", "text": "Jupiter", "is_correct": true},
        {"id": "C", "text": "Saturnus", "is_correct": true},
        {"id": "D", "text": "Uranus", "is_correct": true},
        {"id": "E", "text": "Neptunus", "is_correct": true}
      ],
      "correct_answer": ["B", "C", "D", "E"],
      "explanation": "Semua planet gas raksasa memiliki cincin",
      "difficulty": "medium",
      "points": 1
    },
    {
      "id": 3,
      "type": "matching",
      "text": "Cocokkan planet dengan cirinya!",
      "items": [
        {"id": "1", "text": "Mars"},
        {"id": "2", "text": "Jupiter"},
        {"id": "3", "text": "Merkurius"}
      ],
      "matches": [
        {"id": "A", "text": "Planet terbesar"},
        {"id": "B", "text": "Terdekat dari matahari"},
        {"id": "C", "text": "Planet merah"}
      ],
      "correct_answer": {"1": "C", "2": "A", "3": "B"},
      "explanation": null,
      "difficulty": "medium",
      "points": 1
    }
  ]
}
```

### JSON Schema Notes

- `type`: One of `multiple_choice`, `multiple_select`, `true_false`, `essay`, `short_answer`, `fill_blank`, `matching`
- `correct_answer`: String for single answer, Array for multiple select, Object for matching
- `options`: Present for choice-based types
- `items` + `matches`: Present for matching type only
- `is_correct`: Boolean in options array

---

## Aiken Format (Moodle)

Plain text format for import into Moodle LMS.

### Supported Types

Only `multiple_choice` and `true_false` can be exported to Aiken format.

### Format Specification

```
Question text goes here on one line
A. First option
B. Second option
C. Third option
D. Fourth option
ANSWER: B

Next question text goes here
A. Option one
B. Option two
C. Option three
D. Option four
ANSWER: C
```

### Rules

1. Question text must be a single line (no line breaks)
2. Options start with capital letter, period, space
3. Blank line between questions
4. `ANSWER:` followed by space and correct letter
5. No special characters in question text
6. No explanation or metadata

### True/False in Aiken

```
The sun is the closest star to Earth.
A. True
B. False
ANSWER: A
```

### Multiple Select Limitation

Aiken format does NOT support multiple select. When exporting:
- Convert to markdown or JSON instead, OR
- Split into multiple true/false questions

### Example Output

```
Proses fotosintesis terjadi di bagian sel tumbuhan yang disebut
A. Mitokondria
B. Kloroplas
C. Ribosom
D. Nukleus
ANSWER: B

Gas yang dihasilkan dari proses fotosintesis adalah
A. Karbon dioksida
B. Nitrogen
C. Oksigen
D. Hidrogen
ANSWER: C

Fotosintesis memerlukan cahaya matahari
A. True
B. False
ANSWER: A
```

---

## Export Command Examples

User requests and expected actions:

| User Input | Format | Include Answers |
|------------|--------|-----------------|
| "export ke markdown" | markdown | true |
| "simpan sebagai json" | json | true |
| "export untuk moodle" | aiken | true |
| "download tanpa kunci" | markdown | false |
| "export json tanpa jawaban" | json | false |

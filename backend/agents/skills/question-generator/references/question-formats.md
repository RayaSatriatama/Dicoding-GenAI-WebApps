# Question Format Examples

This reference contains output format examples for each question type.

## Table of Contents
- [Multiple Choice](#multiple-choice)
- [Multiple Select](#multiple-select)
- [True/False](#truefalse)
- [Matching](#matching)
- [Fill in the Blank](#fill-in-the-blank)
- [Short Answer](#short-answer)
- [Essay](#essay)

---

## Multiple Choice

Single correct answer from 4 options.

```markdown
**Soal 1:**
Planet terbesar di tata surya adalah...

A. Mars
B. Jupiter
C. Saturnus
D. Neptunus

<!-- ANSWER_KEY: B -->
```

Display format:
- Question text with "..."
- Options A-D on separate lines
- Hidden answer in HTML comment (quiz mode)

---

## Multiple Select

Multiple correct answers, use checkboxes.

```markdown
**Soal 2:** *(pilih semua yang benar)*
Planet yang termasuk planet dalam (terrestrial) adalah...

☐ A. Merkurius
☐ B. Jupiter
☐ C. Bumi
☐ D. Mars
☐ E. Saturnus

💡 *Jawab dengan format: "jawab 2 A,C,D"*

<!-- ANSWER_KEY: A,C,D -->
```

Display format:
- Include "(pilih semua yang benar)" hint
- Use ☐ checkbox symbol
- Add answer format hint
- Multiple letters in answer key

---

## True/False

Evaluate a statement as true or false.

```markdown
**Soal 3:** Benar atau Salah?
Matahari adalah bintang terdekat dari Bumi.

○ Benar
○ Salah

<!-- ANSWER_KEY: Benar -->
```

Display format:
- "Benar atau Salah?" header
- Statement as question
- Radio-style options (○)

---

## Matching

Match items from two columns.

```markdown
**Soal 4:** Cocokkan planet dengan cirinya!

| No | Planet | | Ciri |
|----|--------|---|------|
| 1. | Mars | | A. Planet terbesar |
| 2. | Jupiter | | B. Planet terdekat dari matahari |
| 3. | Merkurius | | C. Disebut planet merah |

💡 *Jawab dengan format: "jawab 4 1-C, 2-A, 3-B"*

<!-- ANSWER_KEY: 1-C, 2-A, 3-B -->
```

Display format:
- Table with numbered items and lettered matches
- Items and matches should NOT be in correct order
- Add answer format hint
- Answer key uses number-letter pairs

---

## Fill in the Blank

Complete the sentence with missing word/phrase.

```markdown
**Soal 5:**
Proses pembuatan makanan oleh tumbuhan dengan bantuan cahaya matahari disebut _______.

<!-- ANSWER_KEY: fotosintesis -->
```

Display format:
- Use _______ for blank
- One blank per question recommended
- Answer is exact word/phrase

---

## Short Answer

Brief 1-3 sentence response.

```markdown
**Soal 6:**
Jelaskan secara singkat fungsi klorofil dalam proses fotosintesis!

<!-- ANSWER_KEY: Klorofil berfungsi menyerap energi cahaya matahari yang diperlukan untuk mengubah karbon dioksida dan air menjadi glukosa dan oksigen. -->
```

Display format:
- Question ends with "!" or "?"
- Answer key contains expected response
- Evaluation requires semantic matching

---

## Essay

Long-form response requiring detailed explanation.

```markdown
**Soal 7:**
Jelaskan proses fotosintesis secara lengkap, termasuk:
1. Bahan-bahan yang diperlukan
2. Tahapan reaksi terang dan gelap
3. Hasil akhir yang dihasilkan

<!-- ANSWER_KEY: 
Poin utama yang harus ada:
- Bahan: CO2, H2O, cahaya matahari
- Reaksi terang: terjadi di grana, menghasilkan ATP dan NADPH
- Reaksi gelap (Siklus Calvin): terjadi di stroma, fiksasi CO2
- Hasil: glukosa (C6H12O6) dan oksigen (O2)
-->
```

Display format:
- Multi-part questions with numbered sub-points
- Answer key contains rubric/key points
- Evaluation is holistic, not exact match

---

## Quiz Mode Display

When `quiz_mode=true`, show questions without answer keys:

```markdown
🎯 **QUIZ: [TOPIC]**
📚 Jenis: [type] | ⚡ Kesulitan: [difficulty] | 📝 Jumlah: [count] soal

---

[Questions without ANSWER_KEY comments]

---

💬 **Cara menjawab:**
• Pilihan ganda: "jawab 1 C"
• Multiple select: "jawab 2 A,C,D"
• Matching: "jawab 3 1-C, 2-A, 3-B"
• Benar/Salah: "jawab 4 benar"

👀 Ketik "lihat jawaban" untuk kunci
```

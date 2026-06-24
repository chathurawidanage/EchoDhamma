---
name: question-builder
description: Generate comprehensive chapter-revision multiple-choice questions (MCQs) for a Buddhist ebook chapter, incorporating any built-in review questions and covering 100% of the content.
---

# Buddhist Ebook Q&A Builder Skill

This skill provides step-by-step instructions for extracting chapter content from an ebook HTML file, identifying built-in review questions, and generating a comprehensive set of Multiple-Choice Questions (MCQs) for that chapter.

The questions are saved as a JSON file matching the chapter's Table of Contents (TOC) identifier (e.g., `toc-ind-1.json`) inside the book's `questions` folder.

---

## 1. Input Parameters

When invoking this skill, you must locate or be provided with:
1. **Book Directory Path**: e.g., `web/public/ebooks/Abidharma_Margaya`
2. **Target Chapter Anchor/ID**: e.g., `toc-ind-1`

---

## 2. Locating the Chapter Content & Built-In Questions

1. Open the main ebook HTML file (e.g., `web/public/ebooks/Abidharma_Margaya/Abidharma_Margaya.html`).
2. Search for the HTML element matching the given chapter anchor:
   - Example: `<h1 id="toc-ind-1">1. ප්‍ර‍ථම පරිච්ඡේදය</h1>`
3. Identify the end of the chapter content:
   - The chapter text extends until the next heading of the same level (e.g., next `<h1>` element, like `<h1 id="toc-ind-21">2. ද්විතීය පරිච්ඡේදය</h1>`).
4. Read and analyze all paragraph, list, and heading elements within these boundaries.
5. **Check for Built-In Questions**:
   - Look for a questions section at the end of the chapter or its sub-sections (typically under a header like `<p class="subhead">ප්‍ර‍ශ්න</p>` followed by an ordered/unordered list).
   - If present, copy the text of each question exactly as written in the book.

---

## 3. Question Design Guidelines

### Sourcing Built-In Book Questions
- **Wording**: Keep the question text exactly as printed in the book.
- **Conversion to MCQ**: Since the book questions are open-ended, formulate **four** options:
  - One correct option based directly on the chapter content.
  - Three plausible, grammatically matching distractors.
- **Metadata**: Add `"fromBook": true` to the JSON object.

### Sourcing Custom Revision Questions
- **Coverage**: Generate additional questions until **100% of the chapter content** is covered. Every key concept, division, term, or explanation should be testable.
- **Wording**: Use clear, grammatically correct Sinhala matching the style of the book.
- **Metadata**: Set `"fromBook": false` or omit the field.

### Strict Negative Guidelines
- **Avoid Trivial Trivia**: Do not ask meta-questions that do not help revise the actual Buddhist doctrine or subject content.
  - *Bad example*: "ප්‍රථම පරිච්ඡේදයේ ප්‍රධාන මාතෘකාව කුමක්ද?" (What is the main heading of the first chapter?)
- **Avoid Order-Memorization**: Do not ask questions testing memory of arbitrary order in lists.
  - *Bad example*: "ආර්ය අෂ්ටාංගික මාර්ගයේ 4 වන අංගය කුමක්ද?" (What is the 4th item of the Noble Eightfold Path?)
  - *Good alternative*: Ask about the definition, characteristics, or purpose of that factor.

---

## 4. Output JSON Format

Save the questions in `web/public/ebooks/<book_folder>/questions/<chapter_id>.json`.
The format of each JSON file is a JSON array containing objects structured as follows:

```json
[
  {
    "id": "am-q-1-1",
    "question": "අභිධර්ම පිටකයට අයත් ප්‍රධාන ග්‍රන්ථ (ප්‍රකරණ) ගණන කීයද?",
    "options": [
      "7 (සප්ත ප්‍රකරණ)",
      "5",
      "3",
      "12"
    ],
    "correctAnswerIndex": 0,
    "explanation": "ධම්මසංගණී, විභංග, ධාතුකථා, පුද්ගලපඤ්ඤත්ති, කථාවත්ථු, යමක, පට්ඨාන යන ග්‍රන්ථ හත සප්ත ප්‍රකරණ නම් වේ."
  },
  {
    "id": "am-q-1-2",
    "question": "පරමාර්ථ සතර මොනවා ද?",
    "options": [
      "චිත්ත, චෛතසික, رූප, නිර්වාණ",
      "චිත්ත, චෛතසික, රූප, ප්‍රඥප්ති",
      "වේදනා, සංඥා, සංස්කාර, විඥාන",
      "සීල, සමාධි, ප්‍රඥා, විමුක්ති"
    ],
    "correctAnswerIndex": 0,
    "explanation": "අභිධර්මයේ දැක්වෙන උසස්ම සත්‍යයන් හෙවත් පරමාර්ථ ධර්ම හතර වන්නේ සිත (චිත්ත), චෛතසික, රූපය සහ නිවනයි.",
    "fromBook": true
  }
]
```

### JSON Fields Explanation
- `id`: A unique string ID. Use format `<book-abbreviation>-q-<chapter-number>-<question-index>` (e.g. `am-q-1-1`).
- `question`: Sinhala question string.
- `options`: A list of exactly 4 strings.
- `correctAnswerIndex`: 0-indexed integer (0, 1, 2, or 3) representing the correct answer in the `options` array.
- `explanation`: Sinhala explanation clarifying why the correct answer is right and why other options are wrong, referring to the book's explanations.
- `fromBook`: Boolean. True if the question is derived from the book's built-in questions, false/omitted otherwise.

---

## 5. Execution Workflow

When running this skill, complete the following steps:
1. **Load HTML**: Read the book HTML file.
2. **Extract Content**: Locate the start anchor and next heading anchor to extract the target section text.
3. **Parse Questions**: Find and extract any `<p class="subhead">ප්‍ර‍ශ්න</p>` subhead list.
4. **Draft MCQs**:
   - First, map all built-in questions to MCQs with `"fromBook": true`.
   - Next, draft custom MCQs to cover all remaining concepts in the section (aim for 10-15 questions total depending on the size of the section, covering definitions, classifications, reasons, and characteristics).
5. **Double-Check Compliance**:
   - Are there any order-memorization questions? (Remove/rewrite them if so).
   - Are there any trivial/meta questions? (Remove/rewrite them if so).
   - Are there exactly 4 options per question?
   - Is `correctAnswerIndex` correct (0-indexed)?
   - Is the explanation detailed and in Sinhala?
6. **Save**: Write the array to the destination file.
7. **Verify JSON**: Run a lint check or verify the JSON file compiles and parses without errors.

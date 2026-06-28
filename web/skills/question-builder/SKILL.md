---
name: question-builder
description: Generate comprehensive chapter-revision questions (MCQs, multiselect, and wordbuilder formats) for a Buddhist ebook chapter, incorporating any built-in review questions and covering 100% of the content.
---

# Buddhist Ebook Q&A Builder Skill

This skill provides step-by-step instructions for extracting chapter content from an ebook HTML file, identifying built-in review questions, and generating a comprehensive set of interactive questions (MCQs, multiselect, and wordbuilders) for that chapter.

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

### Question Types
The system supports three types of questions:
1. **Standard MCQ (`mcq` - default)**: Best for single-choice questions with 4 options.
2. **Multiselect (`multiselect`)**: Choose-all-that-apply. Excellent when a concept has multiple correct factors, classifications, or components. Suffix the question text with `(සියල්ල තෝරන්න)` to guide the user.
3. **Wordbuilder (`wordbuilder`)**: A word-assembly question. Best for constructing terms, names of consciousnesses/mental states, or short phrases by placing words in the correct sequence.

### Sourcing Built-In Book Questions
- **Wording**: Keep the question text exactly as printed in the book.
- **Conversion to MCQ**: Since the book questions are open-ended, formulate options using the appropriate type:
  - For single-answer questions: **four** options (one correct, three plausible distractors).
  - For multi-answer questions: use the `multiselect` type with a list of options (e.g., 4 to 8 items) and define all correct indexes.
- **Metadata**: Add `"fromBook": true` to the JSON object.

### Sourcing Custom Revision Questions
- **Coverage**: Generate additional questions until **100% of the chapter content** is covered. Every key concept, division, term, or explanation should be testable.
- **Form**: Choose the most natural question type:
  - Use `mcq` for standard single-choice concepts.
  - Use `multiselect` for lists of elements (e.g., "පරමාර්ථ සතර", "චෛතසිකවල සාමාන්‍ය ලක්ෂණ හතර").
  - Use `wordbuilder` for assembling composite terms (e.g., "සෝමනස්ස සහගත ඥාන සම්ප්‍රයුක්ත අසංස්කාරික සිත").
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

### 4.1 Standard MCQ
```json
{
  "id": "am-q-1-1",
  "type": "mcq", // Optional, defaults to "mcq" if omitted
  "question": "අභිධර්ම පිටකයට අයත් ප්‍රධාන ග්‍රන්ථ (ප්‍රකරණ) ගණන කීයද?",
  "options": [
    "7 (සප්ත ප්‍රකරණ)",
    "5",
    "3",
    "12"
  ],
  "correctAnswerIndex": 0,
  "explanation": "ධම්මසංගණී, විභංග, ධාතුකථා, පුද්ගලපඤ්ඤත්ති, කථාවත්ථු, යමක, පට්ඨාන යන ග්‍රන්ථ හත සප්ත ප්‍රකරණ නම් වේ."
}
```

### 4.2 Multiselect
```json
{
  "id": "am-q-4-1",
  "type": "multiselect",
  "question": "පරමාර්ථ සතර මොනවා ද? (සියල්ල තෝරන්න)",
  "options": [
    "චිත්ත",
    "චෛතසික",
    "රූප",
    "නිර්වාණ",
    "ප්‍රඥප්ති",
    "සීල",
    "සමාධි",
    "ප්‍රඥා"
  ],
  "correctAnswerIndices": [0, 1, 2, 3],
  "explanation": "අභිධර්මයේ එන පරමාර්ථ සතර වන්නේ සිත (චිත්ත), චෛතසිකය, රූපය සහ නිවන (නිර්වාණය) යි.",
  "fromBook": true
}
```

### 4.3 Wordbuilder
```json
{
  "id": "am-q-13-10",
  "type": "wordbuilder",
  "question": "කර්ම ඵල විශ්වාසය ඇතිව, සතුටින්, තමාගේම උනන්දුවෙන් දන් දෙන කෙනෙකුට ඇති වන මහා කුසල් සිතේ නම සකසන්න:",
  "words": [
    "සෝමනස්ස සහගත",
    "උපේක්ෂා සහගත",
    "ඥාන සම්ප්‍රයුක්ත",
    "ඥාන විප්‍රයුක්ත",
    "අසංස්කාරික",
    "සසංස්කාරික",
    "දෝමනස්ස සහගත"
  ],
  "correctWordSequence": [
    "සෝමනස්ස සහගත",
    "ඥාන සම්ප්‍රයුක්ත",
    "අසංස්කාරික"
  ],
  "placeholder": "වචන තෝරා සිතේ නම මෙතැන සකසන්න...", // Optional placeholder text
  "explanation": "මෙම ක්‍රියාවෙහි සතුට ඇති බැවින් 'සෝමනස්ස සහගත' ද, කර්ම ඵල විශ්වාසය ඇති බැවින් 'ඥාන සම්ප්‍රයුක්ත' ද, තමාගේම කැමැත්තෙන් සිදු කරන බැවින් 'අසංස්කාරික' ද වේ."
}
```

### JSON Fields Explanation
- `id`: A unique string ID. Use format `<book-abbreviation>-q-<chapter-number>-<question-index>` (e.g. `am-q-1-1`).
- `type`: Question style format. One of `"mcq"`, `"multiselect"`, or `"wordbuilder"`. If omitted, defaults to `"mcq"`.
- `question`: Sinhala question string. For multiselect type, append `(සියල්ල තෝරන්න)`.
- `options`: Array of candidate choice strings (required for `mcq` and `multiselect`).
- `correctAnswerIndex`: 0-indexed integer (required for `mcq`).
- `correctAnswerIndices`: Array of 0-indexed integers representing all correct choices (required for `multiselect`).
- `words`: Array of candidate words in the word pool to display (required for `wordbuilder`).
- `correctWordSequence`: Array of strings in the exact correct order (required for `wordbuilder`).
- `placeholder`: Custom helper string displayed inside the answer sequence slot before choices are clicked (optional, used in `wordbuilder`).
- `explanation`: Sinhala explanation clarifying why the correct answer/sequence is right and why other options are wrong, referring to the book's explanations.
- `fromBook`: Boolean. True if the question is derived from the book's built-in questions, false/omitted otherwise.

---

## 5. Execution Workflow

When running this skill, complete the following steps:
1. **Load HTML**: Read the book HTML file.
2. **Extract Content**: Locate the start anchor and next heading anchor to extract the target section text.
3. **Parse Questions**: Find and extract any `<p class="subhead">ප්‍ර‍ශ්න</p>` subhead list.
4. **Draft Revision Questions**:
   - First, map all built-in questions to MCQs or Multiselect questions with `"fromBook": true`.
   - Next, draft custom questions to cover all remaining concepts in the section (aim for 10-20 questions total depending on the size of the section, covering definitions, classifications, reasons, and characteristics).
   - Strategically mix standard `mcq` with `multiselect` (for lists/categories) and `wordbuilder` (for multi-part Buddhist terms/phrases) to create a diverse and interactive revision session.
5. **Double-Check Compliance**:
   - Are there any order-memorization questions? (Remove/rewrite them if so).
   - Are there any trivial/meta questions? (Remove/rewrite them if so).
   - For `mcq` and `multiselect` questions, are options properly constructed and spelled?
   - For `wordbuilder` questions, do the items in `correctWordSequence` exist exactly inside the `words` array?
   - Are the correct answers (indices/sequences) fully verified and matching the question definitions?
   - Is the explanation detailed and written in clear Sinhala?
6. **Save**: Write the array to the destination file.
7. **Verify JSON**: Run a lint check or verify the JSON file compiles and parses without errors.

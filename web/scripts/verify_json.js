const fs = require('fs');
const path = require('path');

const questionsDir = '/Users/chathura/code/EchoDhamma/web/public/ebooks/Abidharma_Margaya/questions';

function verifyFile(filename) {
  const filePath = path.join(questionsDir, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`File does not exist: ${filename}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    console.error(`Invalid JSON in ${filename}:`, e.message);
    return false;
  }

  if (!Array.isArray(data)) {
    console.error(`${filename} is not a JSON array`);
    return false;
  }

  const tocIndex = filename.replace('toc-ind-', '').replace('.json', '');

  let hasErrors = false;
  data.forEach((q, idx) => {
    const qPrefix = `[${filename} Question ${idx + 1}]`;
    if (!q.id) {
      console.error(`${qPrefix} Missing field 'id'`);
      hasErrors = true;
    } else {
      // Check ID format
      const expectedIdPattern = new RegExp(`^am-q-${tocIndex}-\\d+$`);
      if (!expectedIdPattern.test(q.id)) {
        console.error(`${qPrefix} ID '${q.id}' does not match expected pattern 'am-q-${tocIndex}-N'`);
        hasErrors = true;
      }
    }

    if (!q.question || typeof q.question !== 'string') {
      console.error(`${qPrefix} Missing or invalid 'question'`);
      hasErrors = true;
    }

    // Validate based on question type
    const type = q.type || 'mcq';
    if (type === 'mcq') {
      if (!q.options || !Array.isArray(q.options) || q.options.length !== 4) {
        console.error(`${qPrefix} MCQ: 'options' must be an array of exactly 4 strings`);
        hasErrors = true;
      } else {
        q.options.forEach((opt, oIdx) => {
          if (typeof opt !== 'string' || !opt.trim()) {
            console.error(`${qPrefix} MCQ: Option ${oIdx + 1} is empty or not a string`);
            hasErrors = true;
          }
        });
      }

      if (q.correctAnswerIndex === undefined || typeof q.correctAnswerIndex !== 'number' || q.correctAnswerIndex < 0 || q.correctAnswerIndex > 3) {
        console.error(`${qPrefix} MCQ: 'correctAnswerIndex' must be an integer between 0 and 3`);
        hasErrors = true;
      }
    } else if (type === 'multiselect') {
      if (!q.options || !Array.isArray(q.options) || q.options.length === 0) {
        console.error(`${qPrefix} Multiselect: 'options' must be a non-empty array of strings`);
        hasErrors = true;
      } else {
        q.options.forEach((opt, oIdx) => {
          if (typeof opt !== 'string' || !opt.trim()) {
            console.error(`${qPrefix} Multiselect: Option ${oIdx + 1} is empty or not a string`);
            hasErrors = true;
          }
        });
      }

      if (!q.correctAnswerIndices || !Array.isArray(q.correctAnswerIndices) || q.correctAnswerIndices.length === 0) {
        console.error(`${qPrefix} Multiselect: 'correctAnswerIndices' must be a non-empty array of numbers`);
        hasErrors = true;
      } else {
        q.correctAnswerIndices.forEach(val => {
          if (typeof val !== 'number' || val < 0 || val >= q.options.length) {
            console.error(`${qPrefix} Multiselect: 'correctAnswerIndices' values must be integers between 0 and ${q.options.length - 1}`);
            hasErrors = true;
          }
        });
      }
    } else if (type === 'wordbuilder') {
      if (!q.words || !Array.isArray(q.words) || q.words.length === 0) {
        console.error(`${qPrefix} Wordbuilder: 'words' must be a non-empty array of strings`);
        hasErrors = true;
      } else {
        q.words.forEach((w, wIdx) => {
          if (typeof w !== 'string' || !w.trim()) {
            console.error(`${qPrefix} Wordbuilder: Word ${wIdx + 1} is empty or not a string`);
            hasErrors = true;
          }
        });
      }

      if (!q.correctWordSequence || !Array.isArray(q.correctWordSequence) || q.correctWordSequence.length === 0) {
        console.error(`${qPrefix} Wordbuilder: 'correctWordSequence' must be a non-empty array of strings`);
        hasErrors = true;
      } else {
        q.correctWordSequence.forEach((w, wIdx) => {
          if (typeof w !== 'string' || !w.trim()) {
            console.error(`${qPrefix} Wordbuilder: Correct sequence word ${wIdx + 1} is empty or not a string`);
            hasErrors = true;
          } else if (!q.words.includes(w)) {
            console.error(`${qPrefix} Wordbuilder: Correct sequence word '${w}' is missing from the 'words' pool`);
            hasErrors = true;
          }
        });
      }
    } else {
      console.error(`${qPrefix} Unknown type '${type}'`);
      hasErrors = true;
    }

    if (!q.explanation || typeof q.explanation !== 'string' || !q.explanation.trim()) {
      console.error(`${qPrefix} Missing or empty 'explanation'`);
      hasErrors = true;
    }
  });

  if (hasErrors) {
    return false;
  }

  console.log(`✓ ${filename} validated successfully. Total questions: ${data.length}`);
  return true;
}

const filesToValidate = [];
for (let i = 4; i <= 20; i++) {
  filesToValidate.push(`toc-ind-${i}.json`);
}

let allOk = true;
filesToValidate.forEach(file => {
  if (!verifyFile(file)) {
    allOk = false;
  }
});

if (allOk) {
  console.log('\nAll JSON files validated successfully! 🎉');
  process.exit(0);
} else {
  console.error('\nSome JSON files have validation errors! ❌');
  process.exit(1);
}

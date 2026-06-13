const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '../../src/echodhamma/theros');
const TARGET_DIR = path.join(__dirname, '../src/data');
const TARGET_FILE = path.join(TARGET_DIR, 'theros.json');

function main() {
  console.log('Synchronizing thero configurations...');

  if (!fs.existsSync(SOURCE_DIR)) {
    console.warn(`Source directory not found: ${SOURCE_DIR}`);
    if (fs.existsSync(TARGET_FILE)) {
      console.log('Target theros.json already exists, keeping existing file.');
      process.exit(0);
    }
    console.log('Creating empty theros.json fallback.');
    fs.mkdirSync(TARGET_DIR, { recursive: true });
    fs.writeFileSync(TARGET_FILE, '[]', 'utf-8');
    process.exit(0);
  }

  try {
    const files = fs.readdirSync(SOURCE_DIR);
    const theroConfigs = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(SOURCE_DIR, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        try {
          const config = JSON.parse(fileContent);
          theroConfigs.push(config);
        } catch (err) {
          console.error(`Failed to parse thero config file: ${file}`, err);
        }
      }
    }

    fs.mkdirSync(TARGET_DIR, { recursive: true });
    fs.writeFileSync(TARGET_FILE, JSON.stringify(theroConfigs, null, 2), 'utf-8');
    console.log(`Successfully synchronized ${theroConfigs.length} thero configurations to ${TARGET_FILE}`);
  } catch (error) {
    console.error('Error synchronizing thero configurations:', error);
    process.exit(1);
  }
}

main();

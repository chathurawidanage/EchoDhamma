/**
 * Punyanumodana Certificate Generator
 * Mobile-friendly, high-performance HTML5 Canvas renderer.
 */

const SINHALA_MONTHS = [
  'ජනවාරි', 'පෙබරවාරි', 'මාර්තු', 'අප්‍රේල්', 'මැයි', 'ජූනි',
  'ජූලි', 'අගෝස්තු', 'සැප්තැම්බර්', 'ඔක්තෝබර්', 'නොවැම්බර්', 'දෙසැම්බර්'
];

let templates = [];
let currentTemplate = null;
const loadedImages = {};

let currentZoom = 1.0;
let isFitMode = true;

let currentSwitchToken = 0;

// Loading state helpers
function setPreviewLoading(isLoading, text = 'Loading template...') {
  const loader = document.getElementById('canvasLoader');
  if (loader) {
    const textEl = loader.querySelector('.loader-text');
    if (textEl && text) textEl.textContent = text;
    loader.classList.toggle('active', isLoading);
  }
}

function setDonorLoading(isLoading) {
  const loader = document.getElementById('donorLoader');
  if (loader) {
    loader.style.display = isLoading ? 'inline-flex' : 'none';
  }
}

// Toast helper
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// Convert YYYY-MM-DD to Sinhala date string
function formatSinhalaDate(dateStr) {
  if (!dateStr) return '';
  const [year, monthStr, dayStr] = dateStr.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const sinhalaMonth = SINHALA_MONTHS[monthIdx] || '';
  return `${year} ${sinhalaMonth} මස ${day} වන දින`;
}

// Google Sheet schedule parser and cache
const sheetCache = {};

function parseGoogleSheetUrl(url) {
  if (!url) return null;
  const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const sheetId = idMatch[1];
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return { sheetId, gid };
}

function fetchSheetData(url) {
  if (!url) return Promise.resolve([]);
  if (sheetCache[url]) return Promise.resolve(sheetCache[url]);

  const parsed = parseGoogleSheetUrl(url);
  if (!parsed) return Promise.resolve([]);

  return new Promise((resolve) => {
    const cb = 'gvizCallback_' + Math.random().toString(36).substring(2, 9);
    window[cb] = (data) => {
      delete window[cb];
      document.getElementById(cb)?.remove();
      if (!data || !data.table || !data.table.rows) {
        return resolve([]);
      }
      const rows = data.table.rows.map(r => {
        const d = r.c && r.c[0] ? (r.c[0].f !== undefined ? r.c[0].f : r.c[0].v) : '';
        const n = r.c && r.c[1] ? (r.c[1].f !== undefined ? r.c[1].f : r.c[1].v) : '';
        const cleanName = String(n != null ? n : '')
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean)
          .join('\n')
          .trim();
        return { 
          date: String(d != null ? d : '').trim(), 
          name: cleanName 
        };
      }).filter(r => r.name);
      sheetCache[url] = rows;
      resolve(rows);
    };

    const script = document.createElement('script');
    script.id = cb;
    script.src = `https://docs.google.com/spreadsheets/d/${parsed.sheetId}/gviz/tq?tqx=responseHandler:${cb}&gid=${parsed.gid}`;
    script.onerror = (e) => {
      console.warn('Google Sheet script error:', e);
      delete window[cb];
      script.remove();
      resolve([]);
    };
    document.body.appendChild(script);
  });
}

function findDonorsForDate(rows, dateStr) {
  if (!rows || rows.length === 0 || !dateStr) return [];
  const parts = dateStr.split('-');
  if (parts.length < 3) return [];
  const dayNum = parseInt(parts[2], 10);
  const monthNum = parseInt(parts[1], 10);
  const yearNum = parseInt(parts[0], 10);

  const matched = [];

  rows.forEach(r => {
    const dNum = parseInt(r.date, 10);
    const isDayMatch = !isNaN(dNum) && dNum === dayNum;
    const isFullMatch = r.date === dateStr ||
      r.date === `${dayNum}/${monthNum}/${yearNum}` ||
      r.date === `${dayNum}/${monthNum}` ||
      r.date === `${monthNum}/${dayNum}/${yearNum}`;

    if (isDayMatch || isFullMatch) {
      const clean = (r.name || '').trim();
      if (clean && !matched.includes(clean)) {
        matched.push(clean);
      }
    }
  });

  return matched;
}

// Prepopulate donor name from template's Google Sheet
async function syncDonorFromSheet() {
  const container = document.getElementById('donorOptionsContainer');
  const listEl = document.getElementById('donorOptions');
  if (container) container.style.display = 'none';
  if (listEl) listEl.innerHTML = '';

  if (!currentTemplate || !currentTemplate.data) return;

  const dateInput = document.getElementById('dateInput');
  const nameInput = document.getElementById('nameInput');
  if (!dateInput || !nameInput) return;

  setDonorLoading(true);
  try {
    const rows = await fetchSheetData(currentTemplate.data);
    const donors = findDonorsForDate(rows, dateInput.value);

    if (donors.length > 0) {
      // Default to the first donor for this date
      nameInput.value = donors[0];

      // If multiple donors exist for this date, show clickable options under Donor Name
      if (donors.length > 1 && container && listEl) {
        container.style.display = 'flex';
        listEl.innerHTML = '';

        donors.forEach((donor, idx) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'donor-option-btn' + (idx === 0 ? ' active' : '');
          btn.textContent = donor;

          btn.onclick = () => {
            nameInput.value = donor;
            listEl.querySelectorAll('.donor-option-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCanvas();
          };

          listEl.appendChild(btn);
        });
      }
    }
  } catch (err) {
    console.warn('Sync donor error:', err);
  } finally {
    setDonorLoading(false);
  }
}

// Get configured suffix for current template (e.g. "විසින්", or empty if none)
function getTemplateSuffix() {
  if (!currentTemplate) return 'විසින්';
  const s = currentTemplate.suffix ?? currentTemplate.nameSuffix ?? currentTemplate.prefix;
  return s !== undefined ? String(s).trim() : 'විසින්';
}

// Update UI checkbox label based on current template's suffix
function updateSuffixUI() {
  const labelEl = document.getElementById('appendVisinLabel');
  const textEl = document.getElementById('appendVisinText');
  const suffix = getTemplateSuffix();
  if (!labelEl) return;

  if (!suffix) {
    labelEl.style.display = 'none';
  } else {
    labelEl.style.display = 'inline-flex';
    if (textEl) {
      textEl.innerHTML = `Append <strong>"${suffix}"</strong> at the end`;
    }
  }
}

// Format name (trims lines, appends configured suffix if enabled and not already present)
function formatName(rawName) {
  const text = (rawName || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
  if (!text) return '';

  const suffix = getTemplateSuffix();
  if (!suffix) return text;

  const appendVisin = document.getElementById('appendVisinCheck')?.checked ?? true;
  if (!appendVisin) return text;

  if (text.endsWith(suffix) || text.includes(suffix) || text.endsWith('පිණිස') || text.endsWith('පිණිස.')) {
    return text;
  }
  return `${text} ${suffix}`;
}

// Normalizes text so words can be wrapped cleanly at commas and spaces
function normalizeNameText(text) {
  if (!text) return '';
  return text
    .replace(/,([^\s])/g, ', $1') // Ensure space after comma
    .split('\n')
    .map(p => p.trim())
    .filter(Boolean)
    .join('\n');
}

// Wrap a single paragraph into 1, 2, 3, or more balanced lines that fit maxWidth
function wrapParagraphToWidth(ctx, paragraph, maxWidth) {
  const words = paragraph.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [paragraph];

  // 1 line
  if (ctx.measureText(paragraph).width <= maxWidth) {
    return [paragraph];
  }

  // 2 balanced lines
  let best2 = null;
  let minDiff2 = Infinity;
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(' ');
    const l2 = words.slice(i).join(' ');
    const w1 = ctx.measureText(l1).width;
    const w2 = ctx.measureText(l2).width;
    if (w1 <= maxWidth && w2 <= maxWidth) {
      const diff = Math.abs(w1 - w2);
      if (diff < minDiff2) {
        minDiff2 = diff;
        best2 = [l1, l2];
      }
    }
  }
  if (best2) return best2;

  // 3 balanced lines
  let best3 = null;
  let minDiff3 = Infinity;
  for (let i = 1; i < words.length - 1; i++) {
    for (let j = i + 1; j < words.length; j++) {
      const l1 = words.slice(0, i).join(' ');
      const l2 = words.slice(i, j).join(' ');
      const l3 = words.slice(j).join(' ');
      const w1 = ctx.measureText(l1).width;
      const w2 = ctx.measureText(l2).width;
      const w3 = ctx.measureText(l3).width;
      if (w1 <= maxWidth && w2 <= maxWidth && w3 <= maxWidth) {
        const diff = Math.max(w1, w2, w3) - Math.min(w1, w2, w3);
        if (diff < minDiff3) {
          minDiff3 = diff;
          best3 = [l1, l2, l3];
        }
      }
    }
  }
  if (best3) return best3;

  // 4 balanced lines if needed
  if (words.length >= 4) {
    let best4 = null;
    let minDiff4 = Infinity;
    for (let i = 1; i < words.length - 2; i++) {
      for (let j = i + 1; j < words.length - 1; j++) {
        for (let k = j + 1; k < words.length; k++) {
          const l1 = words.slice(0, i).join(' ');
          const l2 = words.slice(i, j).join(' ');
          const l3 = words.slice(j, k).join(' ');
          const l4 = words.slice(k).join(' ');
          const w1 = ctx.measureText(l1).width;
          const w2 = ctx.measureText(l2).width;
          const w3 = ctx.measureText(l3).width;
          const w4 = ctx.measureText(l4).width;
          if (w1 <= maxWidth && w2 <= maxWidth && w3 <= maxWidth && w4 <= maxWidth) {
            const diff = Math.max(w1, w2, w3, w4) - Math.min(w1, w2, w3, w4);
            if (diff < minDiff4) {
              minDiff4 = diff;
              best4 = [l1, l2, l3, l4];
            }
          }
        }
      }
    }
    if (best4) return best4;
  }

  // Fallback: greedy word wrap
  const lines = [];
  let current = '';
  for (const w of words) {
    const test = current ? current + ' ' + w : w;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Calculate bounds center & dimensions
function getNormalizedBounds(b) {
  if (b.x !== undefined && b.width !== undefined) {
    return {
      cx: b.x + b.width / 2,
      cy: b.y + b.height / 2,
      maxWidth: b.width,
      maxHeight: b.height
    };
  }
  return {
    cx: b.centerX || 0,
    cy: b.centerY || 0,
    maxWidth: b.maxWidth || 800,
    maxHeight: b.maxHeight || 200
  };
}

// Preload template image safely (no crossOrigin on data URLs to prevent Safari bugs)
function loadTemplateImage(template) {
  return new Promise((resolve, reject) => {
    if (loadedImages[template.id]) {
      return resolve(loadedImages[template.id]);
    }
    const img = new Image();
    // Only set crossOrigin for remote http/https URLs, never for data URLs
    if (template.image && !template.image.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      loadedImages[template.id] = img;
      resolve(img);
    };
    img.onerror = (e) => {
      console.warn('Image load error for template:', template.id, e);
      reject(e);
    };
    img.src = template.image;
  });
}

// Main Draw and Auto-fit function
async function renderCanvas() {
  await document.fonts.ready;
  const canvas = document.getElementById('certCanvas');
  if (!canvas || !currentTemplate) return;
  const ctx = canvas.getContext('2d');

  let img;
  const needsImageLoad = !loadedImages[currentTemplate.id];
  if (needsImageLoad) {
    setPreviewLoading(true, 'Loading preview...');
  }
  try {
    img = await loadTemplateImage(currentTemplate);
  } catch (e) {
    console.error('Failed to load image:', e);
    showToast('Template image could not be loaded');
    setPreviewLoading(false);
    return;
  }

  // Set canvas size to native image resolution
  if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
  }

  // Draw background template image
  ctx.drawImage(img, 0, 0);

  // Get inputs
  const rawName = document.getElementById('nameInput').value;
  const dateStr = document.getElementById('dateInput').value;
  const formattedName = formatName(rawName);
  const formattedDate = formatSinhalaDate(dateStr);

  const { cx, cy, maxWidth, maxHeight } = getNormalizedBounds(currentTemplate.bounds);
  const baseSize = currentTemplate.baseFontSize || 54;
  const minSize = 22;

  // Split into paragraphs (preserving explicit newlines), ensuring commas have space
  const normalizedName = normalizeNameText(formattedName);
  const paragraphs = normalizedName ? normalizedName.split('\n') : [];

  let chosenSize = minSize;
  let chosenDateSize = minSize;
  let chosenLines = [];

  // Iterate from baseSize down to minSize to find the largest fitting font
  for (let s = baseSize; s >= minSize; s--) {
    const dateSize = Math.min(s, Math.round(baseSize * 0.92));
    if (formattedDate) {
      ctx.font = `bold ${dateSize}px 'Noto Sans Sinhala', sans-serif`;
      if (ctx.measureText(formattedDate).width > maxWidth) {
        continue;
      }
    }

    ctx.font = `bold ${s}px 'Noto Sans Sinhala', sans-serif`;
    let candidateLines = [];
    let fitsWidth = true;

    for (const para of paragraphs) {
      const wrapped = wrapParagraphToWidth(ctx, para, maxWidth);
      for (const line of wrapped) {
        if (ctx.measureText(line).width > maxWidth) {
          fitsWidth = false;
          break;
        }
      }
      if (!fitsWidth) break;
      candidateLines.push(...wrapped);
    }

    if (!fitsWidth) continue;

    const numLines = candidateLines.length;
    const lh = s * 1.30;
    const dlh = formattedDate ? dateSize * 1.30 : 0;
    const gap = (formattedDate && numLines > 0) ? Math.max(16, Math.min(36, s * 0.45)) : 0;
    const totalH = (numLines * lh) + dlh + gap;

    if (totalH <= maxHeight) {
      chosenSize = s;
      chosenDateSize = dateSize;
      chosenLines = candidateLines;
      break;
    }
  }

  // Fallback if minSize was reached without early break
  if (chosenLines.length === 0 && paragraphs.length > 0) {
    ctx.font = `bold ${minSize}px 'Noto Sans Sinhala', sans-serif`;
    paragraphs.forEach(p => {
      chosenLines.push(...wrapParagraphToWidth(ctx, p, maxWidth));
    });
    chosenSize = minSize;
    chosenDateSize = minSize;
  }

  // Check layout order: 'date_first' vs 'name_first' (default)
  const isDateFirst = currentTemplate && (
    currentTemplate.order === 'date_first' || 
    currentTemplate.order === 'date-first' || 
    (Array.isArray(currentTemplate.order) && currentTemplate.order[0] === 'date')
  );

  const numLines = chosenLines.length;
  const lh = chosenSize * 1.30;
  const dlh = formattedDate ? chosenDateSize * 1.30 : 0;
  const gap = (formattedDate && numLines > 0) ? Math.max(16, Math.min(36, chosenSize * 0.45)) : 0;
  const totalH = (numLines * lh) + dlh + gap;
  const top = cy - (totalH / 2);

  // Draw Text according to template order
  ctx.fillStyle = currentTemplate.textColor || '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isDateFirst) {
    // 1. Draw Date line first (positioned above Name)
    if (formattedDate) {
      ctx.font = `bold ${chosenDateSize}px 'Noto Sans Sinhala', sans-serif`;
      const dateY = top + (dlh / 2);
      ctx.fillText(formattedDate, cx, dateY);
    }

    // 2. Draw Name lines below Date
    const nameStartY = top + (formattedDate ? dlh + gap : 0);
    ctx.font = `bold ${chosenSize}px 'Noto Sans Sinhala', sans-serif`;
    chosenLines.forEach((line, idx) => {
      const y = nameStartY + (idx * lh) + (lh / 2);
      ctx.fillText(line, cx, y);
    });
  } else {
    // 1. Draw Name lines FIRST (at top)
    const nameStartY = top;
    ctx.font = `bold ${chosenSize}px 'Noto Sans Sinhala', sans-serif`;
    chosenLines.forEach((line, idx) => {
      const y = nameStartY + (idx * lh) + (lh / 2);
      ctx.fillText(line, cx, y);
    });

    // 2. Draw Date line NEXT (below Name)
    if (formattedDate) {
      ctx.font = `bold ${chosenDateSize}px 'Noto Sans Sinhala', sans-serif`;
      const dateY = top + (numLines * lh) + gap + (dlh / 2);
      ctx.fillText(formattedDate, cx, dateY);
    }
  }

  setPreviewLoading(false);
}

// Download high-resolution PNG (Safe on both Mobile Safari & Desktop)
function downloadCertificate() {
  const canvas = document.getElementById('certCanvas');
  if (!canvas) return;

  showToast('Preparing download...');

  canvas.toBlob((blob) => {
    if (!blob) {
      showToast('Error generating certificate image');
      return;
    }

    const filename = `punyanumodana-${currentTemplate.id}-${Date.now()}.png`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      URL.revokeObjectURL(url);
      showToast('Download complete!');
    }, 1500);
  }, 'image/png');
}

// Mobile Web Share API
async function shareCertificate() {
  const canvas = document.getElementById('certCanvas');
  if (!canvas) return;

  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const filename = `punyanumodana-${currentTemplate.id}.png`;
    const file = new File([blob], filename, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Punyanumodana Certificate'
        });
        showToast('Shared successfully!');
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          downloadCertificate();
        }
        return;
      }
    }
    // Fallback to download if Web Share is not supported
    downloadCertificate();
  }, 'image/png');
}

// Select template
async function selectTemplate(templateId) {
  const found = templates.find(t => t.id === templateId);
  if (!found) return;
  currentTemplate = found;
  const switchToken = ++currentSwitchToken;

  // Update select input
  const select = document.getElementById('templateSelect');
  if (select) select.value = templateId;

  // Update chip active classes
  document.querySelectorAll('.template-chip').forEach(chip => {
    chip.classList.toggle('active', chip.getAttribute('data-template-id') === templateId);
  });

  updateSuffixUI();

  // Show loading indicators
  const needsImageLoad = !loadedImages[currentTemplate.id];
  if (needsImageLoad) {
    setPreviewLoading(true, 'Loading template...');
  }
  setDonorLoading(true);

  try {
    // Parallelize sheet data fetch and image preload
    await Promise.all([
      syncDonorFromSheet(),
      loadTemplateImage(currentTemplate)
    ]);
  } catch (err) {
    console.error('Error switching template:', err);
  } finally {
    if (switchToken === currentSwitchToken) {
      setDonorLoading(false);
    }
  }

  if (switchToken !== currentSwitchToken) return;

  await renderCanvas();
  setPreviewLoading(false);
}

// Populate template selector dropdown and chips dynamically
function initTemplatesUI() {
  updateSuffixUI();

  // Populate chips dynamically
  const chipsContainer = document.getElementById('templateChips');
  if (chipsContainer && templates.length > 0) {
    chipsContainer.innerHTML = '';
    const dotColors = ['#2563eb', '#7c3aed', '#ea580c', '#16a34a', '#0891b2'];
    templates.forEach((t, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'template-chip' + (currentTemplate && t.id === currentTemplate.id ? ' active' : '');
      btn.setAttribute('data-template-id', t.id);

      const dot = document.createElement('span');
      dot.className = 'chip-dot';
      dot.style.background = dotColors[idx % dotColors.length];

      const name = document.createElement('span');
      name.className = 'chip-name';
      name.textContent = t.name;

      btn.appendChild(dot);
      btn.appendChild(name);
      btn.onclick = () => selectTemplate(t.id);
      chipsContainer.appendChild(btn);
    });
  }

  const select = document.getElementById('templateSelect');
  if (select) {
    select.innerHTML = '';
    templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      if (currentTemplate && t.id === currentTemplate.id) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    select.onchange = (e) => selectTemplate(e.target.value);
  }
}

// Load templates configuration from JSON (fails explicitly if cannot be loaded)
async function loadTemplatesConfig() {
  const res = await fetch('templates.json');
  if (!res.ok) {
    throw new Error(`Failed to load templates.json (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('templates.json contains no templates');
  }

  templates = data;
  currentTemplate = templates[0];
  initTemplatesUI();
}

// Initialize application
window.addEventListener('DOMContentLoaded', async () => {
  // Set default date = Today (local YYYY-MM-DD)
  const dateInput = document.getElementById('dateInput');
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (dateInput) {
    dateInput.value = todayStr;
    dateInput.addEventListener('change', async () => {
      await syncDonorFromSheet();
      renderCanvas();
    });
    dateInput.addEventListener('input', async () => {
      if (dateInput.value && dateInput.value.length === 10) {
        await syncDonorFromSheet();
      }
      renderCanvas();
    });
  }

  const btnSetToday = document.getElementById('btnSetToday');
  if (btnSetToday && dateInput) {
    btnSetToday.addEventListener('click', async () => {
      dateInput.value = todayStr;
      await syncDonorFromSheet();
      renderCanvas();
    });
  }

  const btnSetTomorrow = document.getElementById('btnSetTomorrow');
  if (btnSetTomorrow && dateInput) {
    btnSetTomorrow.addEventListener('click', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
      dateInput.value = tomorrowStr;
      await syncDonorFromSheet();
      renderCanvas();
    });
  }

  const nameInput = document.getElementById('nameInput');
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      const listEl = document.getElementById('donorOptions');
      if (listEl) {
        const val = nameInput.value.trim();
        listEl.querySelectorAll('.donor-option-btn').forEach(b => {
          b.classList.toggle('active', b.textContent.trim() === val);
        });
      }
      renderCanvas();
    });
  }

  const appendVisinCheck = document.getElementById('appendVisinCheck');
  if (appendVisinCheck) {
    appendVisinCheck.addEventListener('change', renderCanvas);
  }

  // Download & Share buttons (desktop & mobile)
  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn) downloadBtn.addEventListener('click', downloadCertificate);

  const downloadBtnMobile = document.getElementById('downloadBtnMobile');
  if (downloadBtnMobile) downloadBtnMobile.addEventListener('click', downloadCertificate);

  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) shareBtn.addEventListener('click', shareCertificate);

  const shareBtnMobile = document.getElementById('shareBtnMobile');
  if (shareBtnMobile) shareBtnMobile.addEventListener('click', shareCertificate);

  // Load templates from JSON, sync donor, then draw (fails explicitly if cannot be loaded)
  try {
    setPreviewLoading(true, 'Loading template...');
    await loadTemplatesConfig();
    await Promise.all([
      syncDonorFromSheet(),
      loadTemplateImage(currentTemplate)
    ]);
    await renderCanvas();
  } catch (err) {
    console.error('Fatal error loading templates:', err);
    showToast('Failed to load templates from JSON');
    const wrapper = document.getElementById('canvasWrapper');
    if (wrapper) {
      wrapper.innerHTML = `<div style="color: #ef4444; padding: 2rem; text-align: center; font-weight: 600;">Failed to load templates from JSON: ${err.message}</div>`;
    }
  } finally {
    setPreviewLoading(false);
  }
});

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN_X = 48;
const PAGE_MARGIN_TOP = 56;
const PAGE_MARGIN_BOTTOM = 48;
const CONTENT_WIDTH = PAGE_WIDTH - (PAGE_MARGIN_X * 2);

function sanitizePdfText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u2018\u2019]/g, '\'')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/[^\x20-\x7E\n]/g, '')
    .replace(/\r/g, '');
}

function escapePdfString(value) {
  return sanitizePdfText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function maxCharsFor(fontSize, width = CONTENT_WIDTH, factor = 0.52) {
  return Math.max(18, Math.floor(width / (fontSize * factor)));
}

function cleanInlineMarkdown(text) {
  return sanitizePdfText(text)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .trim();
}

function wrapParagraph(text, maxChars, prefix = '', continuationPrefix = '') {
  const normalized = cleanInlineMarkdown(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const words = normalized.split(' ');
  const lines = [];
  let current = prefix;
  let currentPrefix = prefix;

  const pushCurrent = () => {
    if (current.trim()) lines.push(current);
  };

  for (let word of words) {
    while (word.length > maxChars) {
      const room = Math.max(1, maxChars - currentPrefix.length - (current.trim() === currentPrefix.trim() ? 0 : 1));

      if (current.trim() !== currentPrefix.trim()) {
        pushCurrent();
        current = continuationPrefix;
        currentPrefix = continuationPrefix;
      }

      const chunk = word.slice(0, room);
      word = word.slice(room);
      current = `${currentPrefix}${chunk}`;
      pushCurrent();
      current = continuationPrefix;
      currentPrefix = continuationPrefix;
    }

    const candidate = current.trim() === currentPrefix.trim()
      ? `${current}${word}`
      : `${current} ${word}`;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    pushCurrent();
    current = `${continuationPrefix}${word}`;
    currentPrefix = continuationPrefix;
  }

  pushCurrent();
  return lines;
}

function wrapCodeLine(line, maxChars) {
  const safeLine = sanitizePdfText(line).replace(/\t/g, '    ');
  if (!safeLine) return [' '];

  const chunks = [];
  for (let index = 0; index < safeLine.length; index += maxChars) {
    chunks.push(safeLine.slice(index, index + maxChars));
  }
  return chunks;
}

function addLine(pages, state, line) {
  if (state.y - line.lineHeight < PAGE_MARGIN_BOTTOM) {
    pages.push([]);
    state.pageIndex += 1;
    state.y = PAGE_HEIGHT - PAGE_MARGIN_TOP;
  }

  pages[state.pageIndex].push({
    ...line,
    y: state.y,
  });
  state.y -= line.lineHeight;
}

function addGap(state, size) {
  state.y -= size;
}

function buildPages({ title, subtitle, content }) {
  const pages = [[]];
  const state = {
    pageIndex: 0,
    y: PAGE_HEIGHT - PAGE_MARGIN_TOP,
  };
  const codeWidth = CONTENT_WIDTH - 18;
  const lines = sanitizePdfText(content || '').split('\n');
  let inCodeBlock = false;

  addLine(pages, state, {
    text: title,
    font: 'F2',
    fontSize: 22,
    x: PAGE_MARGIN_X,
    lineHeight: 28,
  });

  if (subtitle) {
    addLine(pages, state, {
      text: subtitle,
      font: 'F1',
      fontSize: 10,
      x: PAGE_MARGIN_X,
      lineHeight: 16,
    });
  }

  addGap(state, 8);

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      addGap(state, 6);
      continue;
    }

    if (inCodeBlock) {
      for (const line of wrapCodeLine(rawLine, maxCharsFor(9, codeWidth, 0.6))) {
        addLine(pages, state, {
          text: line,
          font: 'F3',
          fontSize: 9,
          x: PAGE_MARGIN_X + 12,
          lineHeight: 12,
        });
      }
      continue;
    }

    if (!trimmed) {
      addGap(state, 8);
      continue;
    }

    if (trimmed.startsWith('# ')) {
      addGap(state, 6);
      for (const line of wrapParagraph(trimmed.slice(2), maxCharsFor(18, CONTENT_WIDTH, 0.55))) {
        addLine(pages, state, {
          text: line,
          font: 'F2',
          fontSize: 18,
          x: PAGE_MARGIN_X,
          lineHeight: 24,
        });
      }
      addGap(state, 4);
      continue;
    }

    if (trimmed.startsWith('## ')) {
      addGap(state, 4);
      for (const line of wrapParagraph(trimmed.slice(3), maxCharsFor(15, CONTENT_WIDTH, 0.55))) {
        addLine(pages, state, {
          text: line,
          font: 'F2',
          fontSize: 15,
          x: PAGE_MARGIN_X,
          lineHeight: 20,
        });
      }
      addGap(state, 2);
      continue;
    }

    if (trimmed.startsWith('### ')) {
      for (const line of wrapParagraph(trimmed.slice(4), maxCharsFor(12, CONTENT_WIDTH, 0.55))) {
        addLine(pages, state, {
          text: line,
          font: 'F2',
          fontSize: 12,
          x: PAGE_MARGIN_X,
          lineHeight: 17,
        });
      }
      continue;
    }

    const numberedMatch = trimmed.match(/^(\d+\.)\s+(.*)$/);
    if (numberedMatch) {
      const prefix = `${numberedMatch[1]} `;
      const continuationPrefix = ' '.repeat(prefix.length);
      for (const line of wrapParagraph(
        numberedMatch[2],
        maxCharsFor(11, CONTENT_WIDTH - 12),
        prefix,
        continuationPrefix,
      )) {
        addLine(pages, state, {
          text: line,
          font: 'F1',
          fontSize: 11,
          x: PAGE_MARGIN_X + 6,
          lineHeight: 16,
        });
      }
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      for (const line of wrapParagraph(
        trimmed.replace(/^[-*]\s+/, ''),
        maxCharsFor(11, CONTENT_WIDTH - 12),
        '- ',
        '  ',
      )) {
        addLine(pages, state, {
          text: line,
          font: 'F1',
          fontSize: 11,
          x: PAGE_MARGIN_X + 6,
          lineHeight: 16,
        });
      }
      continue;
    }

    if (trimmed.startsWith('> ')) {
      for (const line of wrapParagraph(
        trimmed.slice(2),
        maxCharsFor(11, CONTENT_WIDTH - 18),
        '| ',
        '| ',
      )) {
        addLine(pages, state, {
          text: line,
          font: 'F1',
          fontSize: 11,
          x: PAGE_MARGIN_X + 10,
          lineHeight: 16,
        });
      }
      continue;
    }

    for (const line of wrapParagraph(trimmed, maxCharsFor(11))) {
      addLine(pages, state, {
        text: line,
        font: 'F1',
        fontSize: 11,
        x: PAGE_MARGIN_X,
        lineHeight: 16,
      });
    }
  }

  return pages;
}

function buildPdfDocument(pages) {
  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject('');
  const pagesId = addObject('');
  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const fontCodeId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');

  const pageObjectIds = [];

  pages.forEach((page, index) => {
    const commands = page.map((line) => [
      'BT',
      `/${line.font} ${line.fontSize} Tf`,
      `1 0 0 1 ${line.x} ${line.y} Tm`,
      `(${escapePdfString(line.text)}) Tj`,
      'ET',
    ].join('\n'));

    commands.push([
      'BT',
      '/F1 9 Tf',
      `1 0 0 1 ${PAGE_WIDTH - PAGE_MARGIN_X - 34} 24 Tm`,
      `(${index + 1}) Tj`,
      'ET',
    ].join('\n'));

    const content = commands.join('\n');
    const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] `
      + `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontCodeId} 0 R >> >> `
      + `/Contents ${contentId} 0 R >>`,
    );

    pageObjectIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

export function createReportPdfBlob({
  title,
  subtitle = '',
  content,
}) {
  const pages = buildPages({
    title: sanitizePdfText(title || 'Project Report'),
    subtitle: sanitizePdfText(subtitle),
    content,
  });

  return new Blob([buildPdfDocument(pages)], { type: 'application/pdf' });
}

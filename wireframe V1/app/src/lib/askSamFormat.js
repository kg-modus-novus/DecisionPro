/**
 * Ask Sam message formatting — catches common markdown/HTML leaks from LLMs.
 */

export function cleanRawMarkup(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '$1')
    .replace(/<\/?(?:strong|b|em|i|code|p|div|span|br|ul|ol|li|h[1-6]|table|thead|tbody|tr|th|td)[^>]*>/gi, (tag) => {
      const t = tag.toLowerCase();
      if (t.startsWith('<br')) return '\n';
      if (t.startsWith('</p') || t.startsWith('</div') || t.startsWith('</h') || t.startsWith('</li') || t.startsWith('</tr')) {
        return '\n';
      }
      if (t.startsWith('<td') || t.startsWith('<th')) return ' | ';
      return '';
    })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

export function splitTableCells(line) {
  const trimmed = String(line).trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

export function isTableSeparator(line) {
  const cells = splitTableCells(line);
  if (!cells.length) return false;
  return cells.every((c) => /^:?-{3,}:?$/.test(c));
}

export function isTableRow(line) {
  const t = String(line).trim();
  return t.includes('|') && !isTableSeparator(t) && /^\|?.+\|.+\|?$/.test(t);
}

export function parseMarkdownBlocks(text) {
  const cleaned = cleanRawMarkup(text);
  const lines = cleaned.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    // Pipe table: header + separator + rows
    if (isTableRow(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1].trim())) {
      const header = splitTableCells(trimmed);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        rows.push(splitTableCells(lines[i].trim()));
        i += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    // Loose table-like rows without separator (still format as table if 2+ consecutive)
    if (isTableRow(trimmed)) {
      const rows = [splitTableCells(trimmed)];
      let j = i + 1;
      while (j < lines.length && (isTableRow(lines[j].trim()) || isTableSeparator(lines[j].trim()))) {
        if (isTableRow(lines[j].trim())) rows.push(splitTableCells(lines[j].trim()));
        j += 1;
      }
      if (rows.length >= 2) {
        const [header, ...body] = rows;
        blocks.push({ type: 'table', header, rows: body });
        i = j;
        continue;
      }
    }

    // Bullet / numbered list
    const listMatch = trimmed.match(/^[-*•]\s+(.+)$/) || trimmed.match(/^\d+\.\s+(.+)$/);
    if (listMatch) {
      const items = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        const m = t.match(/^[-*•]\s+(.+)$/) || t.match(/^\d+\.\s+(.+)$/);
        if (!m) break;
        items.push(m[1]);
        i += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    // Heading (# or whole-line **bold**)
    const heading = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', text: heading[1] });
      i += 1;
      continue;
    }
    const boldOnly = trimmed.match(/^\*\*(.+)\*\*$/);
    if (boldOnly && !trimmed.includes('\n')) {
      blocks.push({ type: 'heading', text: boldOnly[1] });
      i += 1;
      continue;
    }

    // Paragraph (merge soft-continued non-special lines)
    const parts = [trimmed];
    i += 1;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t) break;
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) break;
      if (isTableRow(t) || isTableSeparator(t)) break;
      if (/^[-*•]\s+/.test(t) || /^\d+\.\s+/.test(t)) break;
      if (/^#{1,6}\s+/.test(t)) break;
      parts.push(t);
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: parts.join(' ') });
  }

  return blocks;
}

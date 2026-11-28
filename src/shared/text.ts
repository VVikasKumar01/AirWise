export function isSafeHttpUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function stripInlineMarkdown(segment: string): string {
  return segment
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,!?:;)]|$)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function cleanChatFormatting(raw: string): string {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const cleanedLines: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== '') {
        cleanedLines.push('');
      }
      continue;
    }

    // Remove markdown horizontal dividers (---, ***, ___)
    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      continue;
    }

    let line = trimmed.replace(/^#{1,6}\s+/, '');
    line = line.replace(/^[*•+]\s+/, '- ');
    line = stripInlineMarkdown(line);

    if (line) {
      cleanedLines.push(line);
    }
  }

  return cleanedLines.join('\n').trim();
}

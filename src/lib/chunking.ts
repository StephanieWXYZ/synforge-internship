export type TextChunk = {
  chunkIndex: number;
  content: string;
};

type ChunkOptions = {
  targetSize?: number;
  overlap?: number;
  minSize?: number;
};

export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const targetSize = options.targetSize ?? 1000;
  const overlap = options.overlap ?? 150;
  const minSize = options.minSize ?? 80;
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + targetSize, normalized.length);

    if (end < normalized.length) {
      const boundary = findBoundary(normalized, start, end);
      if (boundary > start + minSize) {
        end = boundary;
      }
    }

    const content = normalized.slice(start, end).trim();
    if (content.length >= minSize || normalized.length <= minSize) {
      chunks.push({ chunkIndex: chunks.length, content });
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(0, end - overlap);
    while (start < normalized.length && /\s/.test(normalized[start])) {
      start += 1;
    }
  }

  return chunks;
}

function findBoundary(text: string, start: number, end: number): number {
  const window = text.slice(start, end);
  const paragraph = window.lastIndexOf("\n\n");
  if (paragraph > 0) {
    return start + paragraph;
  }

  const sentence = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("? "),
    window.lastIndexOf("! "),
  );
  if (sentence > 0) {
    return start + sentence + 1;
  }

  const line = window.lastIndexOf("\n");
  if (line > 0) {
    return start + line;
  }

  const space = window.lastIndexOf(" ");
  return space > 0 ? start + space : end;
}

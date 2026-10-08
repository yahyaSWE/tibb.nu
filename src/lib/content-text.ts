export type TextBlock = { kind: "paragraph" | "heading"; text: string };
export type InlineText = { text: string; href?: string };

export function contentBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.join("\n").trim())
      blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = /^##[\t ]+(.+)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", text: heading[1].trim() });
    } else if (!line.trim()) flush();
    else paragraph.push(line);
  }
  flush();
  return blocks;
}

export function safeContentHref(value: string): string | undefined {
  if (!value || /[\u0000-\u0020\u007f\\]/.test(value)) return;
  if (/^\/(?!\/)/.test(value) || /^#[^#]+$/.test(value)) return value;
  if (!/^https?:\/\//i.test(value)) return;
  try {
    const url = new URL(value);
    if (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    )
      return url.href;
  } catch {
    return;
  }
}

export function contentInlines(text: string): InlineText[] {
  const parts: InlineText[] = [];
  const pattern = /\[([^\[\]\n]+)\]\(([^()\[\]\s]+)\)/g;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index;
    if (index > offset) parts.push({ text: text.slice(offset, index) });
    const href = safeContentHref(match[2]);
    parts.push(href ? { text: match[1], href } : { text: match[0] });
    offset = index + match[0].length;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset) });
  return parts;
}

export function courseIntroduction(description: string, maxWords = 32) {
  const firstParagraph = description.trim().split(/\r?\n\s*\r?\n/)[0] ?? "";
  const words = firstParagraph.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  const beginning = words.slice(0, maxWords).join(" ");
  // Prefer a complete sentence when one fits, and never cut inside a word.
  const sentences = [...beginning.matchAll(/[.!?](?=\s|$)/g)];
  const lastSentence = sentences.at(-1);
  if (lastSentence && lastSentence.index >= 55)
    return beginning.slice(0, lastSentence.index + 1);
  return `${beginning}…`;
}

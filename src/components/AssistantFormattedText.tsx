import { stripInlineMarkdown } from '../shared/text.ts';

interface AssistantFormattedTextProps {
  text: string;
}

/** Render plain assistant text and simple bullet lists without injecting HTML. */
export function AssistantFormattedText({ text }: AssistantFormattedTextProps) {
  const blocks: Array<{ type: 'p' | 'ul'; items: string[] }> = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || /^([-*_])\1{2,}$/.test(line)) continue;

    const cleanLine = line.replace(/^#{1,6}\s+/, '');
    const bulletMatch = cleanLine.match(/^[-*•+]\s+(.*)$/);
    if (bulletMatch) {
      const content = stripInlineMarkdown(bulletMatch[1]);
      if (!content) continue;
      const lastBlock = blocks.at(-1);
      if (lastBlock?.type === 'ul') {
        lastBlock.items.push(content);
      } else {
        blocks.push({ type: 'ul', items: [content] });
      }
      continue;
    }

    const content = stripInlineMarkdown(cleanLine);
    if (content) blocks.push({ type: 'p', items: [content] });
  }

  return (
    <div className="space-y-2 text-sm leading-relaxed text-[#1F2937]">
      {blocks.map((block, blockIndex) =>
        block.type === 'ul' ? (
          <ul key={blockIndex} className="list-disc pl-5 space-y-1">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={blockIndex}>{block.items[0]}</p>
        ),
      )}
    </div>
  );
}

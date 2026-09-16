import { Fragment, type ReactNode } from "react";

/**
 * The small slice of Markdown the assistant writes: headings, bullet and
 * numbered lists, bold, italic and inline code.
 *
 * Built as React elements rather than HTML, so nothing in an answer — which can
 * quote email subjects and Basecamp messages written by other people — is ever
 * interpreted as markup. That is the reason not to reach for innerHTML here,
 * not a lack of a library.
 */

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "list"; ordered: boolean; items: Array<{ text: string; depth: number }> }
  | { kind: "paragraph"; text: string }
  | { kind: "rule" };

const BULLET = /^(\s*)[-*•]\s+(.*)$/;
const NUMBERED = /^(\s*)\d+[.)]\s+(.*)$/;

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };

  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);

    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flushParagraph();
      blocks.push({ kind: "rule" });
      continue;
    }
    if (heading) {
      flushParagraph();
      blocks.push({ kind: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2] });
      continue;
    }
    if (bullet || numbered) {
      flushParagraph();
      const match = (bullet ?? numbered)!;
      const ordered = !bullet;
      // Two spaces of indent per level is what the model writes.
      const depth = Math.min(3, Math.floor(match[1].length / 2));
      const last = blocks[blocks.length - 1];
      if (last?.kind === "list" && (last.ordered === ordered || depth > 0)) {
        last.items.push({ text: match[2], depth });
      } else {
        blocks.push({ kind: "list", ordered, items: [{ text: match[2], depth }] });
      }
      continue;
    }
    // A wrapped continuation of a list item.
    const last = blocks[blocks.length - 1];
    if (!paragraph.length && last?.kind === "list" && /^\s{2,}\S/.test(raw)) {
      last.items[last.items.length - 1].text += ` ${line.trim()}`;
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  return blocks;
}

/** Bold, italic and code within a line. */
export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key++} className="font-semibold text-bip-text">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key++} className="rounded bg-bip-fill px-1 py-0.5 text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className="space-y-2.5 text-[13px] leading-relaxed text-bip-text">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "heading":
            return block.level === 1 ? (
              <h2 key={index} className="pt-1 text-base font-semibold">
                {renderInline(block.text)}
              </h2>
            ) : block.level === 2 ? (
              <h3 key={index} className="pt-2 text-sm font-semibold">
                {renderInline(block.text)}
              </h3>
            ) : (
              <h4 key={index} className="pt-1 text-[13px] font-semibold text-bip-muted">
                {renderInline(block.text)}
              </h4>
            );
          case "rule":
            return <hr key={index} className="border-bip-border" />;
          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return (
              <List key={index} className={`space-y-1 ${block.ordered ? "list-decimal" : "list-disc"} pl-5`}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} style={{ marginLeft: `${item.depth * 1.1}rem` }}>
                    {renderInline(item.text)}
                  </li>
                ))}
              </List>
            );
          }
          default:
            return (
              <p key={index}>
                <Fragment>{renderInline(block.text)}</Fragment>
              </p>
            );
        }
      })}
    </div>
  );
}

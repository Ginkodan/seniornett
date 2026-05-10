"use client";

import React from "react";

type ChatMarkdownProps = {
  text: string;
  className?: string;
};

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; text: string };

function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\((?:[^)\s]+)\)/g, "$1");
}

function renderItalic(text: string, prefix: string): React.ReactNode[] {
  const parts = text.split(/(\*[^*]+\*|_[^_]+_)/g);
  const nodes: React.ReactNode[] = [];
  parts.forEach((part, index) => {
    if (/^\*[^*]+\*$/.test(part) || /^_[^_]+_$/.test(part)) {
      nodes.push(
        <em key={`${prefix}-em-${index}`}>
          {part.slice(1, -1)}
        </em>
      );
      return;
    }

    if (part) {
      nodes.push(part);
    }
  });
  return nodes;
}

function renderStrong(text: string, prefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
  const nodes: React.ReactNode[] = [];
  parts.forEach((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) {
      nodes.push(
        <strong key={`${prefix}-strong-${index}`}>
          {renderItalic(part.slice(2, -2), `${prefix}-strong-${index}`)}
        </strong>
      );
      return;
    }

    nodes.push(...renderItalic(part, `${prefix}-strong-${index}`));
  });
  return nodes;
}

function renderFieldLine(text: string, prefix: string): React.ReactNode | null {
  const match = text.match(/^\*\*(.+?)\*\*:\s*(.+)$/);
  if (!match) {
    return null;
  }

  return (
    <div key={prefix} className="lotti-markdown-field">
      <strong className="lotti-markdown-field-label">{renderInline(match[1])}</strong>
      <span className="lotti-markdown-field-value">{renderInline(match[2])}</span>
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const stripped = stripMarkdownLinks(text);
  const parts = stripped.split(/(`[^`]+`)/g);
  const nodes: React.ReactNode[] = [];
  parts.forEach((part, index) => {
    if (!part) return;

    if (part.startsWith("`") && part.endsWith("`")) {
      nodes.push(
        <code key={`code-${index}`}>
          {part.slice(1, -1)}
        </code>
      );
      return;
    }

    nodes.push(...renderStrong(part, `strong-${index}`));
  });
  return nodes;
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isTableRow(line: string): boolean {
  return line.includes("|") && splitTableRow(line).length > 1;
}

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let codeLines: string[] = [];
  let inCode = false;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list && list.items.length > 0) {
      blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    }
    list = null;
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCode) {
        blocks.push({ type: "code", text: codeLines.join("\n") });
        codeLines = [];
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2].trim(),
      });
      continue;
    }

    const nextLine = lines[lineIndex + 1]?.trim() ?? "";
    if (isTableRow(trimmed) && isTableSeparator(nextLine)) {
      flushParagraph();
      flushList();

      const headers = splitTableRow(trimmed);
      const rows: string[][] = [];
      let rowIndex = lineIndex + 2;

      while (rowIndex < lines.length && isTableRow(lines[rowIndex].trim())) {
        const cells = splitTableRow(lines[rowIndex]);
        rows.push(headers.map((_header, cellIndex) => cells[cellIndex] ?? ""));
        rowIndex += 1;
      }

      blocks.push({ type: "table", headers, rows });
      lineIndex = rowIndex - 1;
      continue;
    }

    const unordered = trimmed.match(/^[-*+]\s+(.*)$/);
    const ordered = trimmed.match(/^\d+\.\s+(.*)$/);
    if (unordered || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }

      list.items.push((unordered?.[1] ?? ordered?.[1] ?? "").trim());
      continue;
    }

    paragraph.push(trimmed);
  }

  if (inCode) {
    blocks.push({ type: "code", text: codeLines.join("\n") });
  }

  flushParagraph();
  flushList();

  return blocks;
}

export function ChatMarkdown({ text, className }: ChatMarkdownProps) {
  const blocks = React.useMemo(() => parseBlocks(text), [text]);

  return (
    <div className={className ? `lotti-markdown ${className}` : "lotti-markdown"}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Tag = `h${Math.min(block.level, 3)}` as React.ElementType;
          return (
            <Tag key={`${block.type}-${index}`} className={`lotti-markdown-heading lotti-markdown-heading-${block.level}`}>
              {renderInline(block.text)}
            </Tag>
          );
        }

        if (block.type === "code") {
          return (
            <pre key={`${block.type}-${index}`} className="lotti-markdown-codeblock">
              <code>{block.text}</code>
            </pre>
          );
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag key={`${block.type}-${index}`} className="lotti-markdown-list">
              {block.items.map((item, itemIndex) => (
                <li key={`${block.type}-${index}-${itemIndex}`}>
                  {renderFieldLine(item, `${block.type}-${index}-${itemIndex}`) ?? renderInline(item)}
                </li>
              ))}
            </ListTag>
          );
        }

        if (block.type === "table") {
          return (
            <div key={`${block.type}-${index}`} className="lotti-markdown-table-wrap">
              <table className="lotti-markdown-table">
                <thead>
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th key={`${block.type}-${index}-head-${headerIndex}`}>{renderInline(header)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`${block.type}-${index}-row-${rowIndex}`}>
                      {block.headers.map((_header, cellIndex) => (
                        <td key={`${block.type}-${index}-row-${rowIndex}-${cellIndex}`}>
                          {renderInline(row[cellIndex] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <p key={`${block.type}-${index}`} className="lotti-markdown-paragraph">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

import React from 'react';

interface FormattedMessageProps {
  content: string;
  inverted?: boolean;
}

function renderInline(text: string, inverted: boolean): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong
          key={idx}
          className={`font-semibold ${inverted ? 'text-white' : 'text-zinc-950'}`}
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className={`rounded px-1.5 py-0.5 font-mono text-[12px] ${
            inverted
              ? 'bg-white/15 text-white'
              : 'bg-zinc-100 text-zinc-800 ring-1 ring-inset ring-zinc-200/80'
          }`}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const FormattedMessage: React.FC<FormattedMessageProps> = ({
  content,
  inverted = false,
}) => {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  const flushList = (keyPrefix: number) => {
    if (listItems.length === 0) return;
    const Tag = listOrdered ? 'ol' : 'ul';
    blocks.push(
      <Tag
        key={`list_${keyPrefix}`}
        className={`my-1.5 space-y-1 pl-5 ${
          listOrdered ? 'list-decimal' : 'list-disc'
        } ${inverted ? 'text-zinc-100' : 'text-zinc-700'}`}
      >
        {listItems.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {renderInline(item, inverted)}
          </li>
        ))}
      </Tag>
    );
    listItems = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      flushList(index);
      return;
    }

    if (line.startsWith('### ') || line.startsWith('## ')) {
      flushList(index);
      const text = line.replace(/^#{2,3}\s+/, '');
      blocks.push(
        <h4
          key={`h_${index}`}
          className={`mt-2.5 mb-1 font-display text-xs font-bold uppercase tracking-wider ${
            inverted ? 'text-indigo-100' : 'text-indigo-700'
          }`}
        >
          {renderInline(text, inverted)}
        </h4>
      );
      return;
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      if (listItems.length > 0 && listOrdered) flushList(index);
      listOrdered = false;
      listItems.push(bulletMatch[1]);
      return;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (listItems.length > 0 && !listOrdered) flushList(index);
      listOrdered = true;
      listItems.push(orderedMatch[1]);
      return;
    }

    flushList(index);
    blocks.push(
      <p key={`p_${index}`} className="leading-relaxed">
        {renderInline(line, inverted)}
      </p>
    );
  });

  flushList(lines.length);

  return <div className="space-y-1.5 text-[13.5px]">{blocks}</div>;
};

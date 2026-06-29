import { Fragment } from "react";

const SPLIT_RE = /(@[A-Za-z0-9_]{3,32})/g;
const IS_MENTION = /^@[A-Za-z0-9_]{3,32}$/;

// Renderiza texto resaltando las @menciones en rosa, conservando saltos de línea.
export function MentionText({ text }: { text: string }) {
  const parts = text.split(SPLIT_RE);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) =>
        IS_MENTION.test(part) ? (
          <span key={i} className="text-[var(--color-pink)] font-semibold">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </span>
  );
}

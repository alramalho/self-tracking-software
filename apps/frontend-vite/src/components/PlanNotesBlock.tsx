import React from "react";
import ReactMarkdown from "react-markdown";
import LinkifiedText, { InlineUrlLink } from "./LinkifiedText";

type PlanNotesBlockProps = {
  notes: string;
  className?: string;
};

function linkifyTextChildren(children: React.ReactNode) {
  return React.Children.map(children, (child) =>
    typeof child === "string" ? <LinkifiedText text={child} /> : child
  );
}

function getTextContent(children: React.ReactNode) {
  return React.Children.toArray(children)
    .map((child) => (typeof child === "string" ? child : ""))
    .join("");
}

function isUrlLabel(label: string, href?: string) {
  const trimmedLabel = label.trim();
  if (!trimmedLabel) return false;

  return (
    /^https?:\/\//i.test(trimmedLabel) ||
    /^www\./i.test(trimmedLabel) ||
    Boolean(
      href &&
        (trimmedLabel === href ||
          trimmedLabel === href.replace(/\/$/, ""))
    )
  );
}

export function PlanNotesBlock({ notes, className = "" }: PlanNotesBlockProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h3 className="mb-2 mt-3 text-base font-semibold leading-snug text-foreground first:mt-0">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h4 className="mb-2 mt-3 text-sm font-semibold leading-snug text-foreground first:mt-0">
              {children}
            </h4>
          ),
          h3: ({ children }) => (
            <h5 className="mb-1.5 mt-2 text-sm font-medium leading-snug text-foreground first:mt-0">
              {children}
            </h5>
          ),
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {linkifyTextChildren(children)}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-2 list-outside list-disc space-y-1 pl-5">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-outside list-decimal space-y-1 pl-5">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed marker:text-muted-foreground">
              {linkifyTextChildren(children)}
            </li>
          ),
          a: ({ href, children }) => {
            if (href && isUrlLabel(getTextContent(children), href)) {
              return <InlineUrlLink url={href} />;
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="break-words text-primary underline underline-offset-2 [overflow-wrap:anywhere]"
              >
                {children}
              </a>
            );
          },
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.95em]">
              {children}
            </code>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
        }}
      >
        {notes}
      </ReactMarkdown>
    </div>
  );
}

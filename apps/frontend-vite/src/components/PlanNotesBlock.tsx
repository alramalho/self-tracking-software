import ReactMarkdown from "react-markdown";
import LinkifiedText from "./LinkifiedText";

type PlanNotesBlockProps = {
  notes: string;
  className?: string;
};

export function PlanNotesBlock({ notes, className = "" }: PlanNotesBlockProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {children}
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
              {children}
            </li>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="break-words text-primary underline underline-offset-2 [overflow-wrap:anywhere]"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.95em]">
              {children}
            </code>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          text: ({ children }) => <LinkifiedText text={String(children)} />,
        }}
      >
        {notes}
      </ReactMarkdown>
    </div>
  );
}

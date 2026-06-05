import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface MessageBubbleProps {
  direction: "left" | "right";
  className?: string;
  timestamp?: Date | string | null;
  tailPosition?: "top" | "bottom";
  children: React.ReactNode;
}

export function MessageMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {children}
          </span>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em>{children}</em>,
        del: ({ children }) => <del className="line-through">{children}</del>,
        ul: ({ children }) => (
          <ul className="my-1 list-outside list-disc space-y-0 whitespace-normal pl-5 leading-snug">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-1 list-outside list-decimal space-y-0 whitespace-normal pl-5 leading-snug">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="pl-0 leading-snug marker:text-muted-foreground">
            {children}
          </li>
        ),
        code: ({ children }) => (
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm break-words [overflow-wrap:anywhere]">
            {children}
          </code>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="break-words text-primary underline [overflow-wrap:anywhere]"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

function formatMessageTime(timestamp: Date | string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({
  direction,
  className,
  timestamp,
  tailPosition = "bottom",
  children
}: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "w-fit min-w-0 max-w-full overflow-hidden rounded-3xl bg-muted p-3 px-4",
        direction === "left" && tailPosition === "top" && "rounded-tl-none",
        direction === "left" && tailPosition === "bottom" && "rounded-bl-none",
        direction === "right" && tailPosition === "top" && "rounded-tr-none",
        direction === "right" && tailPosition === "bottom" && "rounded-br-none",
        className
      )}
    >
      {children}
      {timestamp ? (
        <div className="mt-1 text-right text-[10px] leading-none text-muted-foreground/70">
          {formatMessageTime(timestamp)}
        </div>
      ) : null}
    </div>
  );
}

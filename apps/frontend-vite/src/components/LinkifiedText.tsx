import { extractDomain, splitTextWithUrls } from "@/lib/linkUtils";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import React from "react";

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

export const InlineUrlLink: React.FC<{ url: string; className?: string }> = ({
  url,
  className,
}) => {
  const domain = extractDomain(url);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5 align-middle text-xs font-medium text-foreground transition-colors hover:bg-muted",
        className
      )}
    >
      <img
        src={faviconUrl}
        alt=""
        className="w-3 h-3 rounded-sm"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <span className="underline underline-offset-2">{domain}</span>
      <ExternalLink className="w-3 h-3 text-muted-foreground" />
    </a>
  );
};

const LinkifiedText: React.FC<LinkifiedTextProps> = ({
  text,
  className = "",
}) => {
  const parts = splitTextWithUrls(text);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === "url") {
          return <InlineUrlLink key={index} url={part.content} />;
        }
        return <React.Fragment key={index}>{part.content}</React.Fragment>;
      })}
    </span>
  );
};

export default LinkifiedText;

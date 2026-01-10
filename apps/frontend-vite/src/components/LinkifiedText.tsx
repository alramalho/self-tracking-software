import { extractDomain, splitTextWithUrls } from "@/lib/linkUtils";
import { ExternalLink } from "lucide-react";
import React from "react";

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

const InlineLink: React.FC<{ url: string }> = ({ url }) => {
  const domain = extractDomain(url);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/50 hover:bg-muted text-foreground text-xs font-medium transition-colors align-middle"
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
          return <InlineLink key={index} url={part.content} />;
        }
        return <React.Fragment key={index}>{part.content}</React.Fragment>;
      })}
    </span>
  );
};

export default LinkifiedText;

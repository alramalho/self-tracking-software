import { extractDomain } from "@/lib/linkUtils";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { ArrowRight, Link2 } from "lucide-react";
import React, { useEffect, useState } from "react";

interface LinkPreviewData {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string;
}

interface LinkPreviewProps {
  url: string;
  className?: string;
}

const LinkPreview: React.FC<LinkPreviewProps> = ({ url, className = "" }) => {
  const [data, setData] = useState<LinkPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  useEffect(() => {
    let isMounted = true;

    const fetchPreview = async () => {
      try {
        setIsLoading(true);
        setHasError(false);

        const response = await fetch(
          `https://api.microlink.io?url=${encodeURIComponent(url)}`
        );
        const result = await response.json();

        if (!isMounted) return;

        if (result.status === "success" && result.data) {
          setData({
            title: result.data.title || null,
            description: result.data.description || null,
            image: result.data.image?.url || null,
            url: result.data.url || url,
          });
        } else {
          setHasError(true);
        }
      } catch {
        if (isMounted) {
          setHasError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchPreview();

    return () => {
      isMounted = false;
    };
  }, [url]);

  const domain = extractDomain(url);

  // Loading skeleton - horizontal layout
  if (isLoading) {
    return (
      <div
        className={`flex rounded-2xl overflow-hidden ${variants.card.glassBg} backdrop-blur-lg border border-white/20 animate-pulse ${className}`}
      >
        <div
          className="w-24 h-24 flex-shrink-0"
          style={{ backgroundColor: "rgba(128,128,128,0.15)" }}
        />
        <div className="flex-1 p-3 space-y-2">
          <div className="h-4 rounded w-3/4" style={{ backgroundColor: "rgba(128,128,128,0.15)" }} />
          <div className="h-3 rounded w-full" style={{ backgroundColor: "rgba(128,128,128,0.15)" }} />
          <div className="h-3 rounded w-1/3" style={{ backgroundColor: "rgba(128,128,128,0.15)" }} />
        </div>
      </div>
    );
  }

  // Error or no data - show minimal link preview
  if (hasError || !data) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`flex rounded-2xl overflow-hidden ${variants.card.glassBg} backdrop-blur-lg border border-white/20 hover:bg-white/5 transition-colors ${className} justify-center align-center`}
      >
        <div
          className="w-24 h-24 flex-shrink-0 flex items-center justify-center"
          style={{ backgroundColor: "rgba(128,128,128,0.1)" }}
        >
          <Link2 className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="flex-1 p-3 flex flex-col justify-center min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{domain}</p>
          <p className="text-xs text-muted-foreground truncate mt-1">{url}</p>
          <div className="flex items-center gap-1 mt-2 text-muted-foreground">
            <span className="text-xs">{domain}</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`flex gap-1 p-3.5 rounded-2xl overflow-hidden ${variants.card.glassBg} backdrop-blur-lg border border-white/20 hover:bg-white/5 transition-colors ${className}`}
    >
      {/* Square thumbnail on left */}
      <div
        className="w-29 h-20  my-auto flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: "rgba(128,128,128,0.1)" }}
      >
        {data.image ? (
          <img
            src={data.image}
            alt={data.title || "Link preview"}
            className="w-full h-full object-cover rounded-2xl"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).parentElement!.innerHTML =
                '<svg class="w-8 h-8 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
            }}
          />
        ) : (
          <Link2 className="w-8 h-8 text-muted-foreground" />
        )}
      </div>

      {/* Text content on right */}
      <div className="flex-1 px-3 flex flex-col justify-center min-w-0">
        {data.title && (
          <p className="text-sm font-semibold text-foreground line-clamp-1">
            {data.title}
          </p>
        )}
        {data.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {data.description}
          </p>
        )}
        <div className="flex items-center gap-1 mt-2 text-muted-foreground">
          <span className="text-xs">{domain}</span>
          <ArrowRight className="w-3 h-3" />
        </div>
      </div>
    </a>
  );
};

export default LinkPreview;

import { useThemeColors } from "@/hooks/useThemeColors";
import { cn } from "@/lib/utils";
import { getThemeVariants } from "@/utils/theme";
import { Calendar, Plus, Pencil, Trash2, Search, CheckCircle2, XCircle, Bell, ExternalLink } from "lucide-react";
import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

interface PlanAdaptationChange {
  operation: string;
  sessionId?: string;
  success: boolean;
  error?: string;
}

interface ReminderChange {
  operation: string;
  reminderId?: string;
  message?: string;
  success: boolean;
  error?: string;
}

interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

interface OGData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

interface CoachToolCallsCardProps {
  toolCalls: ToolCall[];
  plans?: Array<{
    id: string;
    goal: string;
    emoji?: string | null;
  }>;
  className?: string;
}

// Extract unique sources from web search tool calls
function extractSources(toolCalls: ToolCall[]): WebSearchResult[] {
  const sources: WebSearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const tc of toolCalls) {
    if (tc.tool === "webSearch" && tc.result?.results) {
      const results = tc.result.results as WebSearchResult[];
      for (const result of results) {
        if (result.url && !seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          sources.push(result);
        }
      }
    }
  }

  return sources;
}

// Get favicon URL for a domain
function getFaviconUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return "";
  }
}

// Source Preview Card Component
const SourceCard: React.FC<{ source: WebSearchResult; ogData?: OGData }> = ({ source, ogData }) => {
  const hostname = useMemo(() => {
    try {
      return new URL(source.url).hostname.replace("www.", "");
    } catch {
      return source.url;
    }
  }, [source.url]);

  const displayTitle = ogData?.title || source.title;
  const displayDescription = ogData?.description || source.snippet;
  const displayImage = ogData?.image;
  const faviconUrl = ogData?.favicon || getFaviconUrl(source.url);

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg border border-border/50 bg-background/50 hover:bg-muted/50 transition-colors overflow-hidden"
    >
      {/* Image preview if available */}
      {displayImage && (
        <div className="w-full h-24 overflow-hidden bg-muted">
          <img
            src={displayImage}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide image container on error
              (e.target as HTMLImageElement).parentElement!.style.display = "none";
            }}
          />
        </div>
      )}

      <div className="p-3">
        {/* Site info */}
        <div className="flex items-center gap-2 mb-1.5">
          <img
            src={faviconUrl}
            alt=""
            className="w-4 h-4 rounded-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="text-xs text-muted-foreground truncate">
            {hostname}
          </span>
          <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Title */}
        <h4 className="text-sm font-medium text-foreground line-clamp-2 mb-1">
          {displayTitle}
        </h4>

        {/* Description */}
        {displayDescription && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {displayDescription}
          </p>
        )}
      </div>
    </a>
  );
};

// Stacked Favicons Component
const StackedFavicons: React.FC<{ sources: WebSearchResult[]; maxShow?: number }> = ({
  sources,
  maxShow = 4
}) => {
  const displaySources = sources.slice(0, maxShow);
  const remaining = sources.length - maxShow;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {displaySources.map((source, idx) => (
          <div
            key={source.url}
            className="w-5 h-5 rounded-full border-2 border-background bg-muted overflow-hidden"
            style={{ zIndex: maxShow - idx }}
          >
            <img
              src={getFaviconUrl(source.url)}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                // Show fallback on error
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <span className="ml-1 text-xs text-muted-foreground">
          +{remaining}
        </span>
      )}
    </div>
  );
};

// Sources Pill Component
const SourcesPill: React.FC<{ sources: WebSearchResult[] }> = ({ sources }) => {
  const [open, setOpen] = useState(false);
  const urls = useMemo(() => sources.map(s => s.url), [sources]);

  // Fetch OpenGraph data for all sources
  const { data: ogDataMap } = useQuery({
    queryKey: ["og-data", urls],
    queryFn: async () => {
      if (urls.length === 0) return {};
      const response = await api.post<{ results: Record<string, OGData> }>("/utils/og/batch", { urls });
      return response.data.results;
    },
    enabled: open && urls.length > 0, // Only fetch when popover is open
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-muted/50 hover:bg-muted transition-colors text-xs text-muted-foreground"
        >
          <Search className="h-3 w-3" />
          <StackedFavicons sources={sources} />
          <span>{sources.length} source{sources.length !== 1 ? "s" : ""}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 max-h-[400px] overflow-hidden"
        align="start"
        side="top"
      >
        <div className="p-3 border-b border-border">
          <h3 className="text-sm font-medium">Sources</h3>
          <p className="text-xs text-muted-foreground">
            Research used for this response
          </p>
        </div>
        <div className="p-3 space-y-2 max-h-[320px] overflow-y-auto">
          {sources.map((source) => (
            <SourceCard
              key={source.url}
              source={source}
              ogData={ogDataMap?.[source.url]}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const CoachToolCallsCard: React.FC<CoachToolCallsCardProps> = ({
  toolCalls,
  plans = [],
  className,
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  // Filter for different tool call types
  const planAdaptations = toolCalls.filter(
    (tc) => tc.tool === "adaptPlanSessions"
  );
  const reminderOperations = toolCalls.filter(
    (tc) => tc.tool === "manageReminders"
  );
  const webSearches = toolCalls.filter((tc) => tc.tool === "webSearch");

  // Extract sources from web searches
  const sources = useMemo(() => extractSources(toolCalls), [toolCalls]);

  if (planAdaptations.length === 0 && reminderOperations.length === 0 && sources.length === 0) {
    return null;
  }

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case "add":
        return <Plus className="h-3.5 w-3.5" />;
      case "update":
        return <Pencil className="h-3.5 w-3.5" />;
      case "remove":
        return <Trash2 className="h-3.5 w-3.5" />;
      default:
        return <Calendar className="h-3.5 w-3.5" />;
    }
  };

  const getOperationLabel = (operation: string) => {
    switch (operation) {
      case "add":
        return "Added session";
      case "update":
        return "Updated session";
      case "remove":
        return "Removed session";
      default:
        return operation;
    }
  };

  const getReminderOperationIcon = (operation: string) => {
    switch (operation) {
      case "create":
        return <Plus className="h-3.5 w-3.5" />;
      case "update":
        return <Pencil className="h-3.5 w-3.5" />;
      case "delete":
        return <Trash2 className="h-3.5 w-3.5" />;
      default:
        return <Bell className="h-3.5 w-3.5" />;
    }
  };

  const getReminderOperationLabel = (operation: string) => {
    switch (operation) {
      case "create":
        return "Created reminder";
      case "update":
        return "Updated reminder";
      case "delete":
        return "Deleted reminder";
      default:
        return operation;
    }
  };

  return (
    <div className={cn("flex flex-col gap-2 mt-3", className)}>
      {/* Plan Adaptations */}
      {planAdaptations.map((tc, idx) => {
        const args = tc.args as { planId: string; operations: unknown[] } | undefined;
        const result = tc.result as {
          success: boolean;
          changes: PlanAdaptationChange[];
          error?: string;
        };

        if (!args?.planId || !result?.changes || result.changes.length === 0) return null;

        const plan = plans.find((p) => p.id === args.planId);

        return (
          <div
            key={`adaptation-${idx}`}
            className={cn(
              "rounded-xl p-3",
              variants.veryFadedBg,
              "border",
              variants.border
            )}
          >
            {/* Header with plan info */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{plan?.emoji || "📋"}</span>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  Plan Updated
                </span>
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {plan?.goal || "Your plan"}
                </span>
              </div>
            </div>

            {/* Changes list */}
            <div className="flex flex-col gap-1.5">
              {result.changes.map((change, changeIdx) => (
                <div
                  key={`change-${changeIdx}`}
                  className={cn(
                    "flex items-center gap-2 text-xs rounded-lg px-2 py-1.5",
                    change.success
                      ? "bg-green-500/10 text-green-700 dark:text-green-400"
                      : "bg-red-500/10 text-red-700 dark:text-red-400"
                  )}
                >
                  {change.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  )}
                  <span className="flex items-center gap-1.5">
                    {getOperationIcon(change.operation)}
                    {getOperationLabel(change.operation)}
                  </span>
                  {change.error && (
                    <span className="text-red-500 text-[10px]">
                      ({change.error})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Reminder Operations */}
      {reminderOperations.map((tc, idx) => {
        const result = tc.result as {
          success: boolean;
          changes: ReminderChange[];
          error?: string;
        } | undefined;

        if (!result?.changes || result.changes.length === 0) return null;

        return (
          <div
            key={`reminder-${idx}`}
            className={cn(
              "rounded-xl p-3",
              variants.veryFadedBg,
              "border",
              variants.border
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-5 w-5 text-foreground" />
              <span className="text-sm font-medium text-foreground">
                Reminders Updated
              </span>
            </div>

            {/* Changes list */}
            <div className="flex flex-col gap-1.5">
              {result.changes.map((change, changeIdx) => (
                <div
                  key={`reminder-change-${changeIdx}`}
                  className={cn(
                    "flex items-center gap-2 text-xs rounded-lg px-2 py-1.5",
                    change.success
                      ? "bg-green-500/10 text-green-700 dark:text-green-400"
                      : "bg-red-500/10 text-red-700 dark:text-red-400"
                  )}
                >
                  {change.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  )}
                  <span className="flex items-center gap-1.5">
                    {getReminderOperationIcon(change.operation)}
                    {getReminderOperationLabel(change.operation)}
                  </span>
                  {change.message && (
                    <span className="text-muted-foreground truncate max-w-[150px]">
                      "{change.message}"
                    </span>
                  )}
                  {change.error && (
                    <span className="text-red-500 text-[10px]">
                      ({change.error})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Web Search Sources */}
      {sources.length > 0 && (
        <SourcesPill sources={sources} />
      )}
    </div>
  );
};

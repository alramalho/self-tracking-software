import AppleLikePopover from "@/components/AppleLikePopover";
import { FindingRow } from "@/components/metrics/FindingRow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCurrentUser } from "@/contexts/users";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getCoachPersonalityConfig } from "@/lib/coachPersonality";
import {
  activityFindings,
  signalStrength,
  validRatings,
  type ActivityFinding,
} from "@/lib/metricFindings";
import { MINIMUM_ENTRIES } from "@/lib/metrics";
import {
  CAVEAT,
  activityDetail,
  countUp,
  headline,
  moreWaiting,
  signalLine,
  waitingForActivity,
} from "@/lib/metricWords";
import type { Activity, ActivityEntry, MetricEntry } from "@tsw/prisma";
import { ChevronDown, HelpCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface MetricInsightsCardProps {
  metric: {
    id: string;
    title: string;
    emoji: string;
  };
  activities?: Activity[];
  activityEntries?: ActivityEntry[];
  metricEntries?: MetricEntry[];
  // Made-up rows for the preview shown before someone tracks any metric.
  exampleFindings?: ActivityFinding[];
}

// What the detail popover is showing.
type FindingDetail =
  | { kind: "activity"; finding: ActivityFinding }
  | { kind: "help" };

// Too-early rows shown before the rest fold into one line. An account with
// many one-off activities would otherwise bury its findings under them.
const WAITING_SHOWN = 1;

const activityLabel = (finding: ActivityFinding) =>
  `${finding.activity.emoji || "📊"} ${finding.activity.title}`;

export function MetricInsightsCard({
  metric,
  activities = [],
  activityEntries = [],
  metricEntries = [],
  exampleFindings,
}: MetricInsightsCardProps) {
  const { currentUser } = useCurrentUser();
  const coach = getCoachPersonalityConfig(currentUser?.coachPersonality);
  const themeColors = useThemeColors();
  const [detail, setDetail] = useState<FindingDetail>({ kind: "help" });
  const [showDetail, setShowDetail] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // The bars grow when the card scrolls into view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    const currentRef = cardRef.current;
    if (currentRef) observer.observe(currentRef);
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, []);

  const entries = useMemo(
    () => metricEntries.filter((entry) => entry.metricId === metric.id),
    [metricEntries, metric.id]
  );
  const findings = useMemo(
    () =>
      exampleFindings ?? activityFindings(entries, activities, activityEntries),
    [exampleFindings, entries, activities, activityEntries]
  );
  const [allWaiting, setAllWaiting] = useState(false);
  // Findings arrive with the too-early rows last.
  const measured = findings.filter((row) => row.difference !== null).length;
  const folded = allWaiting
    ? 0
    : Math.max(0, findings.length - measured - WAITING_SHOWN);
  const shown = findings.slice(0, findings.length - folded);
  // Under seven rated check-ins the card only counts up.
  const checkIns = validRatings(entries).length;
  const counting = !exampleFindings && checkIns < MINIMUM_ENTRIES;

  const open = (next: FindingDetail) => {
    setDetail(next);
    setShowDetail(true);
  };
  const heading =
    detail.kind === "activity"
      ? activityLabel(detail.finding)
      : "How to read this";

  return (
    <Card ref={cardRef} className="p-5 rounded-2xl">
      <div className="space-y-4">
        {/* Anything that helps someone stay consistent comes from the coach. */}
        <div className="flex items-center gap-2">
          <img
            src={coach.avatar}
            alt=""
            className="w-9 h-9 flex-shrink-0 object-contain"
          />
          <span className="flex-1 font-semibold">{coach.name}</span>
          {exampleFindings ? (
            <span className="text-xs text-muted-foreground">Example</span>
          ) : (
            !counting && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="How to read this"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => open({ kind: "help" })}
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
            )
          )}
        </div>

        <h2 className="text-xl font-bold leading-snug">
          {counting ? countUp(checkIns) : headline(metric.title, findings)}
        </h2>

        {counting ? (
          <div className="h-2 rounded-full bg-muted">
            <div
              className={`h-2 rounded-full ${themeColors.bg}`}
              style={{ width: `${(checkIns / MINIMUM_ENTRIES) * 100}%` }}
            />
          </div>
        ) : (
          findings.length > 0 && (
            <div className="space-y-4">
              {shown.map((finding, index) => (
                <FindingRow
                  key={finding.activity.id}
                  label={activityLabel(finding)}
                  difference={finding.difference}
                  signal={signalStrength(
                    Math.min(finding.days, finding.otherDays)
                  )}
                  waiting={waitingForActivity(finding)}
                  onClick={() => open({ kind: "activity", finding })}
                  isVisible={isVisible}
                  animationDelay={index * 100}
                />
              ))}
              {folded > 0 && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-[13px] text-muted-foreground"
                  onClick={() => setAllWaiting(true)}
                >
                  {moreWaiting(folded)}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )
        )}
      </div>

      <AppleLikePopover
        open={showDetail}
        onClose={() => setShowDetail(false)}
        title={heading}
      >
        <div className="pt-8 pb-2 space-y-3">
          <h3 className="text-xl font-bold pr-9">{heading}</h3>
          {detail.kind === "activity" && (
            <>
              {activityDetail(metric.title, detail.finding).map((line) => (
                <p key={line}>{line}</p>
              ))}
              {detail.finding.difference !== null && (
                <p className="text-muted-foreground">
                  {signalLine(
                    Math.min(detail.finding.days, detail.finding.otherDays)
                  )}
                </p>
              )}
            </>
          )}
          {detail.kind === "help" && (
            <>
              <p>
                I compare how you rate your {metric.title.toLowerCase()} on the
                days you logged an activity with the days you didn&apos;t.
              </p>
              <p>
                The number is how much higher or lower it averages on those
                days. A longer bar is a bigger difference.
              </p>
              <p>
                The three small bars are how much there is to go on: one from 5
                days, two from 15, three from 30.
              </p>
            </>
          )}
          <p className="text-muted-foreground">{CAVEAT}</p>
        </div>
      </AppleLikePopover>
    </Card>
  );
}

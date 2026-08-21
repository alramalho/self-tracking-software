import { ActivityLink } from "@/components/ActivityLink";
import { MessageMarkdown } from "@/components/MessageBubble";
import { PlanLink } from "@/components/PlanLink";
import { useActivities } from "@/contexts/activities/useActivities";
import { usePlans } from "@/contexts/plans";

type MessageEntityMention = {
  raw: string;
  type: "plan" | "activity";
  id: string;
  label: string;
  index: number;
};

const entityMentionPattern = /\{\{(plan|activity):([^|{}\s]+)\|([^{}]+?)\}\}/g;

function getEntityMentions(content: string): MessageEntityMention[] {
  return Array.from(content.matchAll(entityMentionPattern)).map((match) => ({
    raw: match[0],
    type: match[1] as MessageEntityMention["type"],
    id: match[2],
    label: match[3].trim(),
    index: match.index,
  }));
}

export function MessageEntityMarkdown({ content }: { content: string }) {
  const { plans } = usePlans();
  const { activities } = useActivities();
  const mentions = getEntityMentions(content);

  if (mentions.length === 0) {
    return <MessageMarkdown>{content}</MessageMarkdown>;
  }

  const renderedContent: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const mention of mentions) {
    if (mention.index > lastIndex) {
      renderedContent.push(
        <MessageMarkdown key={`text-${lastIndex}`}>
          {content.slice(lastIndex, mention.index)}
        </MessageMarkdown>
      );
    }

    if (mention.type === "plan") {
      const plan = plans?.find((item) => item.id === mention.id);
      renderedContent.push(
        plan ? (
          <PlanLink
            key={`plan-${mention.index}`}
            planId={mention.id}
            displayText={mention.label}
            emoji={plan.emoji || undefined}
          />
        ) : (
          <span key={`missing-plan-${mention.index}`}>{mention.label}</span>
        )
      );
    } else {
      const activity = activities?.find((item) => item.id === mention.id);
      renderedContent.push(
        activity ? (
          <ActivityLink
            key={`activity-${mention.index}`}
            activityId={mention.id}
            displayText={mention.label}
            emoji={activity.emoji || undefined}
          />
        ) : (
          <span key={`missing-activity-${mention.index}`}>{mention.label}</span>
        )
      );
    }

    lastIndex = mention.index + mention.raw.length;
  }

  if (lastIndex < content.length) {
    renderedContent.push(
      <MessageMarkdown key={`text-${lastIndex}`}>
        {content.slice(lastIndex)}
      </MessageMarkdown>
    );
  }

  return <>{renderedContent}</>;
}

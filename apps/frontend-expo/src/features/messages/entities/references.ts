import type { Message } from "../types";
import type { Replacement } from "./types";

// Same precedence as the PWA: metric, DSL entities, then legacy plan metadata.
export function messageReferences(
  content: string,
  message?: Message,
): Replacement[] {
  const result: Replacement[] = [];
  const metric = message?.metricReplacement;
  if (metric?.textToReplace) {
    const start = content.indexOf(metric.textToReplace);
    if (start >= 0)
      result.push({
        start,
        end: start + metric.textToReplace.length,
        reference: {
          kind: "metric",
          id: metric.metric.id,
          label: metric.textToReplace,
          emoji: metric.metric.emoji,
        },
      });
  }
  const entities = [
    ...content.matchAll(/\{\{(plan|activity):([^|{}\s]+)\|([^{}]+?)\}\}/g),
  ];
  for (const match of entities)
    result.push({
      start: match.index!,
      end: match.index! + match[0].length,
      reference: {
        kind: match[1] as "plan" | "activity",
        id: match[2],
        label: match[3].trim(),
      },
    });
  if (!entities.length)
    for (const replacement of message?.planReplacements ?? []) {
      if (!replacement.textToReplace) continue;
      let start = content.indexOf(replacement.textToReplace);
      if (start < 0) continue;
      let end = start + replacement.textToReplace.length;
      const emoji = replacement.plan.emoji ?? "";
      const before = content.slice(Math.max(0, start - 10), start);
      for (const prefix of [
        `**"${emoji} `,
        `**"${emoji}`,
        '**"',
        "**",
        `"${emoji} `,
        `"${emoji}`,
        '"',
        `${emoji} `,
        emoji,
      ].filter(Boolean)) {
        if (before.endsWith(prefix)) {
          start -= prefix.length;
          break;
        }
      }
      for (const suffix of ['"**', "**", '"']) {
        if (content.slice(end).startsWith(suffix)) {
          end += suffix.length;
          break;
        }
      }
      result.push({
        start,
        end,
        reference: {
          kind: "plan",
          id: replacement.plan.id,
          label: replacement.textToReplace
            .replace(/^\*+|\*+$/g, "")
            .replace(/^"|"$/g, "")
            .trim(),
          emoji,
        },
      });
    }
  const accepted: Replacement[] = [];
  for (const replacement of result) {
    if (
      !accepted.some(
        (item) => replacement.start < item.end && replacement.end > item.start,
      )
    )
      accepted.push(replacement);
  }
  return accepted.sort((a, b) => a.start - b.start);
}

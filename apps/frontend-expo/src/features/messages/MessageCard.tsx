import { ProposalReview } from "./entities/ProposalReview";
import { PreviewButton, PreviewTouch } from "./entities/PreviewSheet";
import { Check, X } from "lucide-react-native";
import { format } from "date-fns";
import { IconButton } from "./IconButton";
import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, Pencil, ThumbsUp, ThumbsDown } from "lucide-react-native";
import {
  Button,
  Copy,
  Field,
  Panel,
  Sheet,
  Status,
  s,
  useColors,
} from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { api } from "@/data/api";
import { ProposalDetails, hasProposalChanges } from "./ProposalDetails";
import { CoachTools } from "./CoachTools";
import { Markdown } from "./Markdown";
import type { MessageProps } from "./types";

const reasons = [
  "Don't like the personality",
  "Don't like the style",
  "Hallucinated",
  "Unsafe or problematic",
  "Biased",
];
export function MessageCard({
  message: m,
  own,
  coach,
  onEdit,
  onPrompt,
  onReport,
}: MessageProps) {
  const c = useColors();
  const client = useQueryClient();
  const [review, setReview] = useState<string>();
  const [actions, setActions] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [comments, setComments] = useState("");
  const [changes, setChanges] = useState<number | null>(null);
  const [goal, setGoal] = useState("");
  const [frequency, setFrequency] = useState("");
  const [notes, setNotes] = useState("");
  const action = useMutation({
    mutationFn: async ({ path, body }: { path: string; body?: unknown }) =>
      api.post(path, body),
    onSuccess: async () => {
      await client.invalidateQueries();
      setReview(undefined);
      setFeedback(false);
      setChanges(null);
    },
  });
  const proposalAction = (kind: string, index: number, accept: boolean) =>
    action.mutate({
      path: `/ai/messages/${m.id}/${accept ? "accept" : "reject"}-${kind}`,
      body: { proposalIndex: index },
    });
  const buttons = (kind: string, index: number, status?: string | null) =>
    status ? (
      <Copy muted>{status.replaceAll("_", " ")}</Copy>
    ) : (
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <PreviewButton
            label="Reject"
            secondary
            disabled={action.isPending}
            onPress={() => proposalAction(kind, index, false)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <PreviewButton
            label={
              kind === "activity-log-proposal"
                ? "Accept Log"
                : kind === "proposal"
                  ? "Accept Changes"
                  : "Accept"
            }
            disabled={action.isPending}
            onPress={() => proposalAction(kind, index, true)}
          />
        </View>
      </View>
    );
  const quickActions = (kind: string, index: number) => (
    <View style={{ flexDirection: "row", gap: 2 }}>
      <PreviewTouch
        accessibilityRole="button"
        accessibilityLabel="Reject proposal"
        disabled={action.isPending}
        onPress={() => proposalAction(kind, index, false)}
        style={{ padding: 8 }}
      >
        <X color="#ef4444" size={16} />
      </PreviewTouch>
      <PreviewTouch
        accessibilityRole="button"
        accessibilityLabel="Accept proposal"
        disabled={action.isPending}
        onPress={() => proposalAction(kind, index, true)}
        style={{ padding: 8 }}
      >
        <Check color="#22c55e" size={16} />
      </PreviewTouch>
    </View>
  );
  return (
    <View
      style={{
        alignSelf: own ? "flex-end" : "flex-start",
        maxWidth: "100%",
        minWidth: 80,
        gap: 6,
      }}
    >
      <Pressable
        accessible={false}
        onPress={() => setActions((v) => !v)}
        onLongPress={onReport}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 24,
          borderBottomRightRadius: own ? 0 : 24,
          borderBottomLeftRadius: own ? 24 : 0,
          backgroundColor: own
            ? c.dark
              ? "#383838"
              : "#d8d8da"
            : c.dark
              ? "#232323"
              : "#f3f4f5",
        }}
      >
        {!own && m.senderName && <Copy muted>{m.senderName}</Copy>}
        <Markdown message={coach && !own ? m : undefined}>
          {typeof m.content === "string" ? m.content : ""}
        </Markdown>
        {m.imageAttachments?.map((attachment, index) => (
          <Pressable
            key={attachment.id ?? index}
            accessibilityRole="button"
            accessibilityLabel={`Open attachment ${index + 1}`}
            onPress={() =>
              router.push({
                pathname: "/photo",
                params: { uri: attachment.url, title: "Message photo" },
              })
            }
          >
            <Image
              source={{ uri: attachment.url }}
              style={{
                width: 220,
                height: 180,
                borderRadius: 16,
                marginTop: 8,
              }}
              resizeMode="cover"
            />
          </Pressable>
        ))}
        {m.userAction && (
          <>
            <Copy>{m.userAction.title}</Copy>
            {m.userAction.diffs.map((diff, index) => (
              <Copy key={index}>
                {diff.label}: {diff.oldValue} → {diff.newValue}
              </Copy>
            ))}
            {!!m.userAction.note && <Copy>{m.userAction.note}</Copy>}
          </>
        )}
        <Text
          style={{
            color: c.muted,
            fontSize: 10,
            textAlign: "right",
            marginTop: 6,
          }}
        >
          {new Date(m.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </Pressable>
      {actions && onReport && (
        <IconButton label="Report message" onPress={onReport}>
          <Flag color={c.muted} size={18} />
        </IconButton>
      )}
      {actions && coach && (
        <View style={s.row}>
          {own ? (
            <IconButton label="Edit message" onPress={() => onEdit(m)}>
              <Pencil color={c.muted} size={18} />
            </IconButton>
          ) : (
            <>
              <IconButton
                label="Good response"
                disabled={action.isPending || !!m.feedback}
                onPress={() =>
                  action.mutate({
                    path: `/ai/coach/messages/${m.id}/feedback`,
                    body: { feedbackType: "POSITIVE", feedbackReasons: [] },
                  })
                }
              >
                <ThumbsUp color={c.muted} size={18} />
              </IconButton>
              <IconButton
                label="Bad response"
                disabled={action.isPending || !!m.feedback}
                onPress={() => setFeedback(true)}
              >
                <ThumbsDown color={c.muted} size={18} />
              </IconButton>
            </>
          )}
        </View>
      )}
      {m.retryable && (
        <Button
          secondary
          busy={action.isPending}
          onPress={() =>
            action.mutate({ path: `/ai/coach/messages/${m.id}/retry` })
          }
        >
          Retry coach response
        </Button>
      )}
      {m.nudge &&
        (m.nudge.outcome ? (
          <Copy muted>
            {m.nudge.outcome === "remind" && m.nudge.remindAt
              ? `Reminder set for ${format(new Date(m.nudge.remindAt), "EEEE 'at' HH:mm")}.`
              : "Plan archived."}
          </Copy>
        ) : (
          <View style={{ gap: 8 }}>
            <Button
              busy={action.isPending}
              onPress={() =>
                action.mutate({ path: `/follow-through/nudges/${m.id}`, body: { action: "remind" } })
              }
            >
              Remind me tomorrow
            </Button>
            <Button
              secondary
              disabled={action.isPending}
              onPress={() =>
                action.mutate({ path: `/follow-through/nudges/${m.id}`, body: { action: "archive" } })
              }
            >
              Let it go (archive plan)
            </Button>
          </View>
        ))}
      {m.planProposals?.map((p, index) =>
        hasProposalChanges(p) ? (
          <ProposalReview
            key={`plan-${index}`}
            label={p.planGoal}
            emoji={p.planEmoji}
            title="Review Changes"
            status={p.status}
            open={review === `plan-${index}`}
            onOpen={() => setReview(`plan-${index}`)}
            onClose={() => setReview(undefined)}
            description={p.description}
            onViewAccepted={() => router.push(`/plan/${p.planId}`)}
            summary={<ProposalDetails proposal={p} compact />}
          >
            <Copy>
              {p.planEmoji} {p.planGoal}
            </Copy>
            <Markdown>{p.description}</Markdown>
            <ProposalDetails proposal={p} />
            {buttons("proposal", index, p.status)}
            <Status error={action.error} />
          </ProposalReview>
        ) : null,
      )}
      {m.planCreationProposals?.map((p, index) => (
        <ProposalReview
          key={`create-${index}`}
          label={p.goal}
          emoji={p.emoji}
          title="Review Plan"
          status={p.status}
          open={review === `create-${index}`}
          onOpen={() => setReview(`create-${index}`)}
          onClose={() => setReview(undefined)}
          description={p.description}
          quickActions={quickActions("plan-creation-proposal", index)}
          summary={
            <Text style={{ color: c.muted, fontSize: 12 }}>
              {p.outlineType === "SPECIFIC" ? "specific" : "times/week"}
              {p.timesPerWeek ? ` · ${p.timesPerWeek}x/week` : ""}
              {p.activities.map((a) => ` · ${a.emoji} ${a.title}`).join("")}
            </Text>
          }
        >
          <Copy>
            {p.emoji} {p.goal}
          </Copy>
          <Markdown>{p.description}</Markdown>
          {!!p.goalReason && <Copy muted>{p.goalReason}</Copy>}
          {!!p.timesPerWeek && <Copy>{p.timesPerWeek} times per week</Copy>}
          {p.activities.map((a, i) => (
            <Copy key={i}>
              {a.emoji} {a.title} · {a.measure}
            </Copy>
          ))}
          {p.sessions?.map((session, i) => (
            <Copy key={i}>
              {session.date.slice(0, 10)} · {session.activityTitle}
              {session.quantity ? ` · ${session.quantity}` : ""}
              {session.descriptiveGuide ? `\n${session.descriptiveGuide}` : ""}
            </Copy>
          ))}
          {p.milestones?.map((milestone, i) => (
            <Copy key={i}>
              {milestone.description}
              {milestone.date ? ` · ${milestone.date.slice(0, 10)}` : ""}
            </Copy>
          ))}
          {buttons("plan-creation-proposal", index, p.status)}
          {!p.status && (
            <Button
              secondary
              onPress={() => {
                setReview(undefined);
                setChanges(index);
                setGoal(p.goal);
                setFrequency(String(p.timesPerWeek ?? ""));
                setNotes("");
              }}
            >
              Propose changes
            </Button>
          )}
          {p.planId && (
            <Button
              secondary
              onPress={() => {
                setReview(undefined);
                router.push(`/plan/${p.planId}`);
              }}
            >
              View plan
            </Button>
          )}
          <Status error={action.error} />
        </ProposalReview>
      ))}
      {m.activityLogProposals?.map((p, index) => (
        <ProposalReview
          key={`log-${index}`}
          label={`${p.activityName} — ${p.quantity} ${p.activityMeasure} on ${format(new Date(p.date), "MMM d")}`}
          emoji={p.activityEmoji}
          title="Review Log"
          status={p.status}
          open={review === `log-${index}`}
          onOpen={() => setReview(`log-${index}`)}
          onClose={() => setReview(undefined)}
        >
          <Copy>
            {p.activityEmoji} Log {p.activityName}
          </Copy>
          <Copy>
            {p.quantity} {p.activityMeasure} · {p.date.slice(0, 10)} {p.time}
          </Copy>
          {!!p.description && <Copy>{p.description}</Copy>}
          {!!p.privateNotes && (
            <Copy muted>Private notes: {p.privateNotes}</Copy>
          )}
          {!!p.difficulty && <Copy>{p.difficulty.replaceAll("_", " ")}</Copy>}
          {buttons("activity-log-proposal", index, p.status)}
          <Status error={action.error} />
        </ProposalReview>
      ))}
      {m.activityEditProposals?.map((p, index) => (
        <ProposalReview
          key={`edit-${index}`}
          label={`Edit ${p.activityName}`}
          emoji={p.activityEmoji}
          title="Review Activity Changes"
          status={p.status}
          open={review === `edit-${index}`}
          onOpen={() => setReview(`edit-${index}`)}
          onClose={() => setReview(undefined)}
        >
          <Copy>
            {p.activityEmoji} Edit {p.activityName}
          </Copy>
          <Markdown>{p.description}</Markdown>
          {(["title", "emoji", "measure", "colorHex", "kind"] as const)
            .filter((key) => p.original[key] !== p.requested[key])
            .map((key) => (
              <Copy key={key}>
                {key}: {p.original[key] ?? "None"} →{" "}
                {p.requested[key] ?? "None"}
              </Copy>
            ))}
          {p.measureConversion && (
            <Copy>
              Convert entries: {p.measureConversion.operator} by{" "}
              {p.measureConversion.factor}
            </Copy>
          )}
          {buttons("activity-edit-proposal", index, p.status)}
          <Status error={action.error} />
        </ProposalReview>
      ))}
      {m.userContextEventProposals?.map((p, index) => (
        <Panel key={`context-${index}`}>
          <Copy>{p.title}</Copy>
          {!!p.description && <Copy>{p.description}</Copy>}
          {!!p.occurredAt && (
            <Copy muted>
              {p.occurredAt.slice(0, 10)}
              {p.endedAt ? ` – ${p.endedAt.slice(0, 10)}` : ""}
            </Copy>
          )}
          {buttons("user-context-event-proposal", index, p.status)}
        </Panel>
      ))}
      {m.coachAttentionItems?.map((item) => (
        <Panel key={item.dedupeKey}>
          <Copy>{item.title}</Copy>
          <Copy muted>{item.message}</Copy>
          {item.facts.map((fact, i) => (
            <Copy key={i}>
              {fact.label}: {fact.value}
            </Copy>
          ))}
          <Button secondary onPress={() => onPrompt(item.primaryAction.prompt)}>
            Update plan
          </Button>
        </Panel>
      ))}
      {m.userRecommendations?.map((person) => (
        <Button
          key={person.userId}
          secondary
          onPress={() => router.push(`/profile/${person.username}`)}
        >{`${person.name} · ${person.matchReasons.join(", ")}`}</Button>
      ))}
      {!!m.toolCalls?.length && (
        <Button
          secondary
          onPress={() => setActions((v) => !v)}
        >{`${m.toolCalls.length} coach actions`}</Button>
      )}
      {actions && m.toolCalls && <CoachTools tools={m.toolCalls} />}
      <Status error={action.error} />
      <Sheet
        visible={feedback}
        title="Provide feedback"
        onClose={() => setFeedback(false)}
      >
        {reasons.map((reason) => (
          <Button
            key={reason}
            secondary
            onPress={() =>
              setSelected((values) =>
                values.includes(reason)
                  ? values.filter((v) => v !== reason)
                  : [...values, reason],
              )
            }
          >{`${selected.includes(reason) ? "✓ " : ""}${reason}`}</Button>
        ))}
        <Field
          label="Additional feedback"
          value={comments}
          onChangeText={setComments}
        />
        <Status error={action.error} />
        <Button
          busy={action.isPending}
          onPress={() =>
            action.mutate({
              path: `/ai/coach/messages/${m.id}/feedback`,
              body: {
                feedbackType: "NEGATIVE",
                feedbackReasons: selected,
                additionalComments: comments || null,
              },
            })
          }
        >
          Submit feedback
        </Button>
      </Sheet>
      <Sheet
        visible={changes !== null}
        title="Propose changes"
        onClose={() => setChanges(null)}
      >
        <Field label="Plan goal" value={goal} onChangeText={setGoal} />
        <Field
          label="Times per week"
          keyboardType="number-pad"
          value={frequency}
          onChangeText={setFrequency}
        />
        <Field
          label="Notes for coach"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
        <Status error={action.error} />
        <Button
          busy={action.isPending}
          disabled={!goal.trim()}
          onPress={() => {
            if (changes === null) return;
            action.mutate({
              path: `/ai/messages/${m.id}/propose-plan-creation-changes`,
              body: {
                proposalIndex: changes,
                requestedProposal: {
                  ...m.planCreationProposals![changes],
                  goal: goal.trim(),
                  timesPerWeek: frequency ? Number(frequency) : null,
                },
                note: notes || null,
              },
            });
          }}
        >
          Send changes
        </Button>
      </Sheet>
    </View>
  );
}

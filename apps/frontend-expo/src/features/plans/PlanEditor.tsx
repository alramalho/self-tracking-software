import { goBack } from "@/core/navigation";
import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  Button,
  Copy,
  Field,
  Heading,
  Screen,
  Status,
  s,
} from "@/components/ui";
import { useAction, useActivities } from "@/data/queries";
import { api } from "@/data/api";
import { dayKey, parseLocalDate } from "@/core/dates";
import type { PlanSession } from "@/core/types";
import { ActivityEditor } from "../activities/ActivityEditor";
import { DateField } from "@/components/DateField";
import { MilestoneFields } from "./MilestoneFields";
import { PlanBackground } from "./PlanBackground";
import type { DraftMilestone, PlanEditorProps } from "./types";
export function PlanEditor({ plan }: PlanEditorProps) {
  const activities = useActivities();
  const [goal, setGoal] = useState(plan?.goal ?? "");
  const [reason, setReason] = useState(plan?.goalReason ?? "");
  const [emoji, setEmoji] = useState(plan?.emoji ?? "");
  const [duration, setDuration] = useState(plan?.durationType ?? "LIFESTYLE");
  const [outline, setOutline] = useState(plan?.outlineType ?? "TIMES_PER_WEEK");
  const [times, setTimes] = useState(String(plan?.timesPerWeek ?? 3));
  const [visibility, setVisibility] = useState(plan?.visibility ?? "PUBLIC");
  const [finish, setFinish] = useState(
    plan?.finishingDate ? dayKey(plan.finishingDate) : "",
  );
  const [selected, setSelected] = useState(
    plan?.activities.map((a) => a.id) ?? [],
  );
  const [sessions, setSessions] = useState<PlanSession[]>(
    (plan?.sessions ?? []).map((session) => ({
      ...session,
      date: dayKey(session.date),
    })),
  );
  const [milestones, setMilestones] = useState<DraftMilestone[]>(
    (plan?.milestones ?? []).map((m) => ({ ...m, date: dayKey(m.date) })),
  );
  const [milestonesChanged, setMilestonesChanged] = useState(false);
  const [adding, setAdding] = useState(false);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(
    plan?.backgroundImageUrl ?? null,
  );
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [step, setStep] = useState(plan ? 5 : 0);
  const action = useAction(async () => {
    if (!goal.trim()) throw new Error("Enter your goal.");
    if (!selected.length) throw new Error("Choose at least one activity.");
    if (
      outline === "TIMES_PER_WEEK" &&
      (!Number.isInteger(Number(times)) || Number(times) <= 0)
    )
      throw new Error("Choose a whole-number weekly goal greater than zero.");
    if (outline === "SPECIFIC" && !sessions.length)
      throw new Error("Add at least one scheduled activity.");
    if (
      outline === "SPECIFIC" &&
      sessions.some(
        (session) =>
          !Number.isInteger(session.quantity) || (session.quantity ?? 0) <= 0,
      )
    )
      throw new Error(
        "Every scheduled activity needs a whole-number quantity greater than zero.",
      );
    if (milestones.some((m) => !m.description.trim()))
      throw new Error("Give each milestone a title.");
    return api.post("/plans/upsert", {
      ...(plan ? { id: plan.id } : {}),
      goal: goal.trim(),
      goalReason: reason,
      emoji,
      durationType: duration,
      outlineType: outline,
      timesPerWeek: Number(times),
      visibility,
      backgroundImageUrl,
      finishingDate: finish ? parseLocalDate(finish).toISOString() : null,
      activities: activities.data?.filter((a) => selected.includes(a.id)),
      sessions: (outline === "SPECIFIC" ? sessions : []).map((session) => ({
        ...session,
        date: parseLocalDate(String(session.date)).toISOString(),
      })),
      // The existing endpoint replaces milestone rows, so preserve their IDs/progress on unrelated edits.
      ...(!plan || milestonesChanged
        ? {
            milestones: milestones.map((m) => ({
              description: m.description.trim(),
              date: parseLocalDate(m.date).toISOString(),
              ...(m.criteria
                ? {
                    criteria:
                      typeof m.criteria === "string"
                        ? m.criteria
                        : JSON.stringify(m.criteria),
                  }
                : {}),
            })),
          }
        : {}),
    });
  });
  const sections = [
    <View key="duration" style={{ gap: 14 }}>
      <Heading>How long do you want to do this?</Heading>
      {["HABIT", "LIFESTYLE", "CUSTOM"].map((value) => (
        <Button
          key={value}
          secondary={duration !== value}
          onPress={() => setDuration(value)}
        >
          {value[0] + value.slice(1).toLowerCase()}
        </Button>
      ))}
      {finish ? (
        <>
          <DateField
            label="Target date"
            value={finish}
            onChange={setFinish}
            includeTime={false}
          />
          <Button secondary onPress={() => setFinish("")}>
            Remove target date
          </Button>
        </>
      ) : (
        <Button secondary onPress={() => setFinish(dayKey(new Date()))}>
          Set a target date (optional)
        </Button>
      )}
    </View>,
    <View key="goal" style={{ gap: 14 }}>
      <Field
        label="Great, now what exactly do you want to do?"
        value={goal}
        onChangeText={setGoal}
      />
      <Field
        label="Why is this important to you?"
        multiline
        value={reason}
        onChangeText={setReason}
      />
    </View>,
    <Field
      key="emoji"
      label="Choose an emoji"
      placeholder="Enter an emoji"
      value={emoji}
      onChangeText={setEmoji}
    />,
    <View key="activities" style={{ gap: 14 }}>
      <Heading>Activities</Heading>
      {activities.data?.map((activity) => (
        <Button
          key={activity.id}
          secondary={!selected.includes(activity.id)}
          onPress={() => {
            if (selected.includes(activity.id))
              setSessions((rows) =>
                rows.filter((row) => row.activityId !== activity.id),
              );
            setSelected((ids) =>
              ids.includes(activity.id)
                ? ids.filter((id) => id !== activity.id)
                : [...ids, activity.id],
            );
          }}
        >{`${activity.emoji} ${activity.title}`}</Button>
      ))}
      <Button secondary onPress={() => setAdding(true)}>
        Add New
      </Button>
    </View>,
    <View key="schedule" style={{ gap: 14 }}>
      <Heading>Outline</Heading>
      <View style={s.row}>
        <Button
          secondary={outline !== "TIMES_PER_WEEK"}
          onPress={() => setOutline("TIMES_PER_WEEK")}
        >
          Weekly Count Goal
        </Button>
        <Button
          secondary={outline !== "SPECIFIC"}
          onPress={() => setOutline("SPECIFIC")}
        >
          Specific Schedule
        </Button>
      </View>
      {outline === "TIMES_PER_WEEK" ? (
        <Field
          label="Times per week"
          keyboardType="number-pad"
          value={times}
          onChangeText={setTimes}
        />
      ) : (
        <>
          {sessions.map((session, i) => (
            <View key={session.id} style={{ gap: 8 }}>
              <Copy>
                {
                  activities.data?.find((a) => a.id === session.activityId)
                    ?.title
                }
              </Copy>
              <DateField
                label={`Session ${i + 1} date`}
                includeTime={false}
                value={String(session.date)}
                onChange={(date) =>
                  setSessions((rows) =>
                    rows.map((row, j) => (j === i ? { ...row, date } : row)),
                  )
                }
              />
              <Field
                label={`Session ${i + 1} quantity`}
                keyboardType="decimal-pad"
                value={String(session.quantity ?? 1)}
                onChangeText={(q) =>
                  setSessions((rows) =>
                    rows.map((row, j) =>
                      j === i ? { ...row, quantity: Number(q) } : row,
                    ),
                  )
                }
              />
              <Field
                label={`Session ${i + 1} guide`}
                multiline
                value={session.descriptiveGuide ?? ""}
                onChangeText={(guide) =>
                  setSessions((rows) =>
                    rows.map((row, j) =>
                      j === i ? { ...row, descriptiveGuide: guide } : row,
                    ),
                  )
                }
              />
              <Button
                secondary
                onPress={() =>
                  setSessions((rows) => rows.filter((_, j) => j !== i))
                }
              >
                Remove Session
              </Button>
            </View>
          ))}
          {activities.data
            ?.filter((a) => selected.includes(a.id))
            .map((a) => (
              <Button
                secondary
                key={a.id}
                onPress={() =>
                  setSessions((rows) => [
                    ...rows,
                    {
                      id: randomUUID(),
                      activityId: a.id,
                      date: dayKey(new Date()),
                      quantity: 1,
                    },
                  ])
                }
              >{`Schedule ${a.title}`}</Button>
            ))}
        </>
      )}
      <MilestoneFields
        milestones={milestones}
        onChange={(rows) => {
          setMilestones(rows);
          setMilestonesChanged(true);
        }}
      />
      <Heading>Visibility</Heading>
      {(["PUBLIC", "FRIENDS", "PRIVATE"] as const).map((value) => (
        <Button
          key={value}
          secondary={visibility !== value}
          onPress={() => setVisibility(value)}
        >
          {value === "PUBLIC"
            ? "Public"
            : value === "FRIENDS"
              ? "Friends"
              : "Private"}
        </Button>
      ))}
    </View>,
  ];
  return (
    <Screen title={plan ? "Edit Plan" : "Create New Plan"}>
      <Button secondary onPress={() => goBack()}>
        Back
      </Button>
      {step < 5 ? sections[step] : sections}
      {step >= 5 && (
        <PlanBackground
          value={backgroundImageUrl}
          onChange={setBackgroundImageUrl}
          onBusyChange={setUploadingBackground}
        />
      )}
      <Status error={action.error} />
      <View style={s.row}>
        {step > 0 && !plan && (
          <Button secondary onPress={() => setStep(step - 1)}>
            Previous
          </Button>
        )}
        {step < 5 ? (
          <Button
            disabled={
              (step === 1 && !goal.trim()) || (step === 3 && !selected.length)
            }
            onPress={() => setStep(step + 1)}
          >
            Next
          </Button>
        ) : (
          <Button
            busy={action.isPending}
            disabled={uploadingBackground}
            onPress={() =>
              action.mutate(undefined, {
                onSuccess: () => router.dismissTo("/(tabs)/plans"),
              })
            }
          >
            {plan ? "Confirm Update" : "Create Plan"}
          </Button>
        )}
      </View>
      {adding && <ActivityEditor onClose={() => setAdding(false)} />}
    </Screen>
  );
}

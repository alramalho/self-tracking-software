import { goBack } from "@/core/navigation";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  Calendar,
  CalendarCheck,
  Check,
  ChevronLeft,
  Dumbbell,
  Earth,
  Eye,
  Flag,
  Goal,
  ImageIcon,
  Lock,
  Plus,
  Route,
  Smile,
  Users,
  X,
} from "lucide-react-native";
import {
  Button,
  Copy,
  Field,
  Heading,
  IconButton,
  Screen,
  Status,
  s,
} from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/theme";
import { useAction, useActivities } from "@/data/queries";
import { api } from "@/data/api";
import { dateLabel, dayKey, parseLocalDate } from "@/core/dates";
import type { PlanSession } from "@/core/types";
import { ActivityEditor } from "../activities/ActivityEditor";
import { DateField } from "@/components/DateField";
import { MilestoneFields } from "./MilestoneFields";
import { PlanBackground } from "./PlanBackground";
import { PlanEditorOverview } from "./PlanEditorOverview";
import type {
  DraftMilestone,
  PlanEditorChoiceProps,
  PlanEditorProps,
  PlanEditorSection,
} from "./types";

function ChoiceRow({
  label,
  description,
  icon: Icon,
  selected,
  onPress,
}: PlanEditorChoiceProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: selected ? c.selectedBorder : c.border,
        backgroundColor: selected ? c.selectedBg : c.card,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {Icon ? (
        <Icon
          size={23}
          color={selected ? c.accent : c.muted}
          strokeWidth={1.8}
        />
      ) : null}
      <View style={{ flex: 1, gap: description ? 4 : 0 }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
          {label}
        </Text>
        {description ? (
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>
            {description}
          </Text>
        ) : null}
      </View>
      {selected ? <Check size={20} color={c.accent} strokeWidth={2.3} /> : null}
    </Pressable>
  );
}

function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 46,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: c.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Plus size={18} color={c.muted} strokeWidth={2} />
      <Text style={{ color: c.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

function SectionFooter({ onDone }: { onDone: () => void }) {
  return <Button onPress={onDone}>Done</Button>;
}

export function PlanEditor({ plan }: PlanEditorProps) {
  const c = useColors();
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
  const [editSection, setEditSection] = useState<PlanEditorSection>(
    "overview",
  );
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

  if (plan) {
    const visibilityLabels = {
      PUBLIC: "Public",
      FRIENDS: "Friends only",
      PRIVATE: "Private",
    } as const;
    const sectionTitles: Record<PlanEditorSection, string> = {
      overview: "Edit Plan",
      goal: "Goal",
      emoji: "Emoji",
      frequency: "Frequency",
      structure: "Plan Type",
      visibility: "Visibility",
      duration: "Duration",
      activities: "Activities",
      milestones: "Milestones",
      background: "Cover Image",
    };
    const editItems = [
      {
        label: "Goal",
        value: goal || "Not set",
        icon: Goal,
        onPress: () => setEditSection("goal"),
      },
      {
        label: "Emoji",
        value: emoji || "Not set",
        icon: Smile,
        onPress: () => setEditSection("emoji"),
      },
      {
        label: "Frequency",
        value: times ? `${times}x per week` : "Not set",
        icon: CalendarCheck,
        onPress: () => setEditSection("frequency"),
      },
      {
        label: "Plan Type",
        value:
          outline === "SPECIFIC" ? "Scheduled sessions" : "Flexible target",
        icon: Route,
        onPress: () => setEditSection("structure"),
      },
      {
        label: "Visibility",
        value: visibilityLabels[visibility],
        icon: Eye,
        onPress: () => setEditSection("visibility"),
      },
      {
        label: "Duration",
        value: finish ? dateLabel(finish) : "No end date",
        icon: Calendar,
        onPress: () => setEditSection("duration"),
      },
      {
        label: "Activities",
        value: selected.length
          ? `${selected.length} selected`
          : "None",
        icon: Dumbbell,
        onPress: () => setEditSection("activities"),
      },
      {
        label: "Milestones",
        value: milestones.length
          ? `${milestones.length} milestones`
          : "None",
        icon: Flag,
        onPress: () => setEditSection("milestones"),
      },
      {
        label: "Cover Image",
        value: backgroundImageUrl ? "Image set" : "No image",
        icon: ImageIcon,
        onPress: () => setEditSection("background"),
      },
    ];

    const finishEdit = () => setEditSection("overview");
    const renderEditSection = () => {
      switch (editSection) {
        case "goal":
          return (
            <View style={{ gap: 14 }}>
              <Heading>What do you want to achieve?</Heading>
              <Copy muted>Describe the goal you want to track.</Copy>
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
              <SectionFooter onDone={finishEdit} />
            </View>
          );
        case "emoji":
          return (
            <View style={{ gap: 14 }}>
              <Heading>Choose an emoji</Heading>
              <Copy muted>Pick an emoji that represents your plan.</Copy>
              <Field
                label="Plan emoji"
                placeholder="Pick an emoji"
                value={emoji}
                onChangeText={setEmoji}
              />
              <SectionFooter onDone={finishEdit} />
            </View>
          );
        case "frequency":
          return (
            <View style={{ gap: 14 }}>
              <Heading>How often?</Heading>
              <Copy muted>
                How many times per week would you like to work on this?
              </Copy>
              <Field
                label="Times per week"
                keyboardType="number-pad"
                value={times}
                onChangeText={setTimes}
              />
              <SectionFooter onDone={finishEdit} />
            </View>
          );
        case "structure":
          return (
            <View style={{ gap: 14 }}>
              <Heading>How would you like to approach this?</Heading>
              <Copy muted>
                Choose a flexible weekly target or specific scheduled sessions.
              </Copy>
              <ChoiceRow
                icon={CalendarCheck}
                label="Flexible target"
                description="Work toward a weekly number without fixed dates."
                selected={outline === "TIMES_PER_WEEK"}
                onPress={() => setOutline("TIMES_PER_WEEK")}
              />
              <ChoiceRow
                icon={Route}
                label="Scheduled sessions"
                description="Plan individual activities on specific dates."
                selected={outline === "SPECIFIC"}
                onPress={() => setOutline("SPECIFIC")}
              />
              {outline === "SPECIFIC" ? (
                <View style={{ gap: 12, paddingTop: 4 }}>
                  <Heading>Scheduled sessions</Heading>
                  {sessions.map((session, i) => (
                    <View
                      key={session.id}
                      style={{
                        gap: 10,
                        padding: 14,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: c.border,
                        backgroundColor: c.card,
                      }}
                    >
                      <Copy>
                        {activities.data?.find(
                          (activity) => activity.id === session.activityId,
                        )?.title ?? "Scheduled activity"}
                      </Copy>
                      <DateField
                        label={`Session ${i + 1} date`}
                        includeTime={false}
                        value={String(session.date)}
                        onChange={(date) =>
                          setSessions((rows) =>
                            rows.map((row, j) =>
                              j === i ? { ...row, date } : row,
                            ),
                          )
                        }
                      />
                      <Field
                        label={`Session ${i + 1} quantity`}
                        keyboardType="decimal-pad"
                        value={String(session.quantity ?? 1)}
                        onChangeText={(quantity) =>
                          setSessions((rows) =>
                            rows.map((row, j) =>
                              j === i
                                ? { ...row, quantity: Number(quantity) }
                                : row,
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
                              j === i
                                ? { ...row, descriptiveGuide: guide }
                                : row,
                            ),
                          )
                        }
                      />
                      <Button
                        secondary
                        onPress={() =>
                          setSessions((rows) =>
                            rows.filter((_, j) => j !== i),
                          )
                        }
                      >
                        Remove Session
                      </Button>
                    </View>
                  ))}
                  {activities.data
                    ?.filter((activity) => selected.includes(activity.id))
                    .map((activity) => (
                      <AddRow
                        key={activity.id}
                        label={`Schedule ${activity.title}`}
                        onPress={() =>
                          setSessions((rows) => [
                            ...rows,
                            {
                              id: randomUUID(),
                              activityId: activity.id,
                              date: dayKey(new Date()),
                              quantity: 1,
                            },
                          ])
                        }
                      />
                    ))}
                </View>
              ) : null}
              <SectionFooter onDone={finishEdit} />
            </View>
          );
        case "visibility":
          return (
            <View style={{ gap: 14 }}>
              <Heading>Who can see this plan?</Heading>
              <Copy muted>Control who can view your plan and progress.</Copy>
              <ChoiceRow
                icon={Earth}
                label="Public"
                description="Everyone can see this plan, including activity entries."
                selected={visibility === "PUBLIC"}
                onPress={() => setVisibility("PUBLIC")}
              />
              <ChoiceRow
                icon={Users}
                label="Friends only"
                description="Only your connections can see this plan and entries."
                selected={visibility === "FRIENDS"}
                onPress={() => setVisibility("FRIENDS")}
              />
              <ChoiceRow
                icon={Lock}
                label="Private"
                description="Only you can see this plan."
                selected={visibility === "PRIVATE"}
                onPress={() => setVisibility("PRIVATE")}
              />
              <SectionFooter onDone={finishEdit} />
            </View>
          );
        case "duration":
          return (
            <View style={{ gap: 14 }}>
              <Heading>Set a target date</Heading>
              <Copy muted>
                When do you want to achieve this goal? (optional)
              </Copy>
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
                  Set a target date
                </Button>
              )}
              <SectionFooter onDone={finishEdit} />
            </View>
          );
        case "activities":
          return (
            <View style={{ gap: 14 }}>
              <Heading>Choose your activities</Heading>
              <Copy muted>Select the activities you’ll track for this plan.</Copy>
              <View style={{ gap: 8 }}>
                {activities.data?.map((activity) => (
                  <ChoiceRow
                    key={activity.id}
                    label={`${activity.emoji} ${activity.title}`}
                    selected={selected.includes(activity.id)}
                    onPress={() => {
                      if (selected.includes(activity.id)) {
                        setSessions((rows) =>
                          rows.filter((row) => row.activityId !== activity.id),
                        );
                      }
                      setSelected((ids) =>
                        ids.includes(activity.id)
                          ? ids.filter((id) => id !== activity.id)
                          : [...ids, activity.id],
                      );
                    }}
                  />
                ))}
              </View>
              <AddRow label="Add new activity" onPress={() => setAdding(true)} />
              <SectionFooter onDone={finishEdit} />
            </View>
          );
        case "milestones":
          return (
            <View style={{ gap: 14 }}>
              <MilestoneFields
                milestones={milestones}
                onChange={(rows) => {
                  setMilestones(rows);
                  setMilestonesChanged(true);
                }}
              />
              <SectionFooter onDone={finishEdit} />
            </View>
          );
        case "background":
          return (
            <View style={{ gap: 14 }}>
              <PlanBackground
                value={backgroundImageUrl}
                onChange={setBackgroundImageUrl}
                onBusyChange={setUploadingBackground}
              />
              <SectionFooter onDone={finishEdit} />
            </View>
          );
        case "overview":
          return null;
      }
    };

    return (
      <Screen
        key={editSection}
        title={editSection === "overview" ? undefined : sectionTitles[editSection]}
        leading={
          <IconButton
            label="Back"
            icon={ChevronLeft}
            onPress={() =>
              editSection === "overview"
                ? goBack()
                : setEditSection("overview")
            }
          />
        }
        actions={
          <IconButton label="Close" icon={X} onPress={() => goBack()} />
        }
      >
        {editSection === "overview" ? (
          <PlanEditorOverview
            emoji={emoji}
            items={editItems}
            canSave={!!goal.trim() && !uploadingBackground}
            saving={action.isPending}
            onSave={() =>
              action.mutate(undefined, {
                onSuccess: () => router.dismissTo("/(tabs)/plans"),
              })
            }
          />
        ) : (
          renderEditSection()
        )}
        <Status error={action.error} />
        {adding && <ActivityEditor onClose={() => setAdding(false)} />}
      </Screen>
    );
  }

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

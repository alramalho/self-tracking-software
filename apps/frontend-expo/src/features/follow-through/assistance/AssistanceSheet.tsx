import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Text } from "@/components/typography/Text";
import { Button, Copy, Field, Status, useColors } from "@/components/ui";
import { LoggingDrawer } from "@/features/activities/logging/LoggingDrawer";
import { useAction } from "@/data/queries";
import { api } from "@/data/api";
import { isFlexiblePlan } from "../model";
import { Choice, DaysInput, TimeInput, days, validTime } from "./Inputs";
import type { AssistanceSheetProps, Control, Step } from "./types";
export function AssistanceSheet({
  control: initial,
  plan,
  support,
  canCoach,
  onClose,
  onSaved,
}: AssistanceSheetProps) {
  const c = useColors();
  const [control, setControl] = useState<Control>(initial),
    [step, setStep] = useState<Step>("choice");
  const [draft, setDraft] = useState(() => ({
    ...support,
    weekdays: [...support.weekdays],
    preferences: { ...support.preferences },
  }));
  const prefs = draft.preferences;
  const save = useAction(async () => {
    await api.put(`/follow-through/plans/${plan.id}`, draft);
  });
  const flexible = isFlexiblePlan(plan, draft),
    prescribed = plan.outlineType === "SPECIFIC";
  const close = () => {
    if (!save.isPending) onClose();
  };
  const persist = () => save.mutate(undefined, { onSuccess: onSaved });
  const reviewOn = prefs.coaching && prefs.weeklyReview;
  let title = "",
    description = "",
    icon = "",
    body,
    footer;
  const next = (s: Step) => {
    save.reset();
    setStep(s);
  };
  const updatePrefs = (patch: Partial<typeof prefs>) =>
    setDraft({ ...draft, preferences: { ...prefs, ...patch } });
  if (control === "schedule") {
    icon = "📅";
    if (prescribed) {
      title = "Your planned dates";
      description =
        "This plan already has individual sessions. Change their dates in the plan calendar.";
      body = (
        <Copy muted>
          Session reminders follow those dates. No extra weekly schedule is
          needed.
        </Copy>
      );
      footer = <Button onPress={close}>Done</Button>;
    } else if (step === "choice") {
      title = "When works for you?";
      description = `${plan.timesPerWeek ? `${plan.timesPerWeek} times a week. ` : ""}Choose days only if that helps.`;
      body = (
        <>
          <Choice
            icon="🌿"
            title="Anytime"
            detail="Log whenever you do it."
            selected={draft.mode === "WEEKLY"}
            onPress={() =>
              setDraft({
                ...draft,
                mode: "WEEKLY",
                weekdays: [],
                time: null,
                preferences: { ...prefs, reminder: false, checkIn: false },
              })
            }
          />
          <Choice
            icon="📅"
            title="Choose days"
            detail="Add a time afterwards, if you want."
            selected={draft.mode !== "WEEKLY"}
            onPress={() => {
              setDraft({ ...draft, mode: draft.time ? "TIMED" : "DAYS" });
              next("days");
            }}
          />
        </>
      );
      footer =
        draft.mode === "WEEKLY" ? (
          <>
            <Copy muted>
              {support.mode !== "WEEKLY"
                ? "Future recurring sessions will be removed. Your activity logs stay. Session reminders will be off."
                : "No scheduled sessions or session reminders."}
            </Copy>
            <Button busy={save.isPending} onPress={persist}>
              Save schedule
            </Button>
          </>
        ) : (
          <Button onPress={() => next("days")}>Continue</Button>
        );
    } else if (step === "days") {
      title = "Which days?";
      description =
        "These days will appear in This week. This does not turn on reminders.";
      body = (
        <DaysInput
          value={draft.weekdays}
          maximum={plan.timesPerWeek || 7}
          onChange={(weekdays) => setDraft({ ...draft, weekdays })}
        />
      );
      footer = (
        <Button
          disabled={!draft.weekdays.length}
          onPress={() => next("optional-time")}
        >
          Continue
        </Button>
      );
    } else if (step === "optional-time") {
      title = "Set a time?";
      description = `${draft.weekdays.map((d) => days[d]).join(", ")}. You can keep the time flexible.`;
      body = (
        <>
          <Choice
            icon="🌤️"
            title="Choose on the day"
            selected={draft.mode === "DAYS"}
            onPress={() => setDraft({ ...draft, mode: "DAYS", time: null })}
          />
          <Choice
            icon="🕒"
            title="Set a time"
            selected={draft.mode === "TIMED"}
            onPress={() => {
              setDraft({
                ...draft,
                mode: "TIMED",
                time: draft.time || "18:00",
              });
              next("time");
            }}
          />
        </>
      );
      footer = (
        <Button
          busy={save.isPending}
          onPress={draft.mode === "TIMED" ? () => next("time") : persist}
        >
          {draft.mode === "TIMED" ? "Continue" : "Save schedule"}
        </Button>
      );
    } else {
      title = "What time?";
      description = `${draft.weekdays.map((d) => days[d]).join(", ")} · ${draft.timezone}. Reminders keep their current setting.`;
      body = (
        <TimeInput
          value={draft.time || "18:00"}
          onChange={(time) => setDraft({ ...draft, time })}
        />
      );
      footer = (
        <Button
          busy={save.isPending}
          disabled={!validTime(draft.time || "")}
          onPress={persist}
        >
          Save schedule
        </Button>
      );
    }
  } else if (control === "reminders") {
    icon = "🔔";
    title = "A reminder before you start?";
    if (flexible) {
      description =
        "Your week is flexible, so there is no session time to remind you about.";
      body = (
        <Choice
          icon="📅"
          title="Choose days first"
          detail="Your weekly goal stays the same."
          onPress={() => {
            setControl("schedule");
            next("choice");
          }}
        />
      );
      footer = (
        <Button secondary onPress={close}>
          Keep reminders off
        </Button>
      );
    } else if (step === "time") {
      title = "What time should we remind you?";
      description = `One reminder on each planned day · ${draft.timezone}.`;
      body = (
        <TimeInput
          value={prefs.dayReminderTime}
          onChange={(dayReminderTime) => updatePrefs({ dayReminderTime })}
        />
      );
      footer = (
        <Button
          disabled={!validTime(prefs.dayReminderTime)}
          busy={save.isPending}
          onPress={persist}
        >
          Save reminder
        </Button>
      );
    } else {
      description =
        draft.mode === "TIMED"
          ? "One notification before each timed session."
          : "One notification on each planned day.";
      body = (
        <>
          <Choice
            icon="🔕"
            title="Off"
            selected={!prefs.reminder}
            onPress={() => updatePrefs({ reminder: false })}
          />
          {draft.mode === "TIMED" ? (
            [0, 10, 30, 60].map((minutes) => (
              <Choice
                key={minutes}
                icon="🔔"
                title={minutes ? `${minutes} minutes before` : "At the start"}
                selected={prefs.reminder && prefs.reminderMinutes === minutes}
                onPress={() =>
                  updatePrefs({ reminder: true, reminderMinutes: minutes })
                }
              />
            ))
          ) : (
            <Choice
              icon="🕒"
              title="Choose a reminder time"
              selected={prefs.reminder}
              detail={prefs.reminder ? prefs.dayReminderTime : undefined}
              onPress={() => {
                updatePrefs({ reminder: true });
                next("time");
              }}
            />
          )}
          <Copy muted>
            Delivery also needs notifications enabled on your phone.
          </Copy>
          <Button
            secondary
            onPress={() => {
              close();
              router.push("/settings");
            }}
          >
            Notification settings
          </Button>
        </>
      );
      footer = (
        <Button
          busy={save.isPending}
          onPress={
            prefs.reminder && draft.mode !== "TIMED"
              ? () => next("time")
              : persist
          }
        >
          {prefs.reminder && draft.mode !== "TIMED"
            ? "Continue"
            : "Save reminder"}
        </Button>
      );
    }
  } else if (control === "review") {
    icon = "🤖";
    title = "Review your week?";
    if (step === "choice") {
      description =
        "One brief coach check about your logged week, at a time you choose.";
      body = (
        <>
          <Choice
            icon="🌿"
            title="Off"
            selected={!reviewOn}
            onPress={() =>
              updatePrefs({
                weeklyReview: false,
                coaching: prefs.coaching && prefs.checkIn,
              })
            }
          />
          <Choice
            icon="🤖"
            title="One weekly review"
            selected={reviewOn}
            disabled={!canCoach}
            detail={
              !canCoach
                ? "Requires an active coaching trial or subscription."
                : "Based on what you actually logged."
            }
            onPress={() => {
              updatePrefs({
                coaching: true,
                weeklyReview: true,
                checkIn: support.preferences.coaching && prefs.checkIn,
              });
              next("days");
            }}
          />
        </>
      );
      footer = (
        <Button
          busy={save.isPending}
          onPress={reviewOn ? () => next("days") : persist}
        >
          {reviewOn ? "Continue" : "Save review preference"}
        </Button>
      );
    } else if (step === "days") {
      title = "Which day for your review?";
      description = flexible
        ? "The coach reviews the previous complete week, Sunday through Saturday."
        : "The coach reviews recent session progress and the week ahead.";
      body = (
        <DaysInput
          single
          value={[prefs.reviewDay]}
          onChange={([reviewDay]) => updatePrefs({ reviewDay })}
        />
      );
      footer = <Button onPress={() => next("time")}>Continue</Button>;
    } else {
      title = "What time suits you?";
      description = `${days[prefs.reviewDay]} · ${draft.timezone}. One weekly check; no daily chasing. Unanswered checks eventually pause.`;
      body = (
        <TimeInput
          value={prefs.reviewTime}
          onChange={(reviewTime) => updatePrefs({ reviewTime })}
        />
      );
      footer = (
        <Button
          busy={save.isPending}
          disabled={!validTime(prefs.reviewTime)}
          onPress={persist}
        >
          Save weekly review
        </Button>
      );
    }
  } else if (control === "check-in") {
    icon = "💬";
    title = "Check after a session?";
    description = flexible
      ? "Your plan is flexible. There are no session check-ins."
      : draft.mode === "TIMED"
        ? "One coach check 15 minutes after a planned session ends, if nothing is logged."
        : "One coach check the next morning, if nothing is logged.";
    if (step === "time") {
      title = "What time the next morning?";
      body = (
        <TimeInput
          value={prefs.checkInTime}
          onChange={(checkInTime) => updatePrefs({ checkInTime })}
        />
      );
      footer = (
        <Button
          disabled={!validTime(prefs.checkInTime)}
          busy={save.isPending}
          onPress={persist}
        >
          Save check-in
        </Button>
      );
    } else {
      body = (
        <>
          <Choice
            icon="🌿"
            title="Off"
            selected={!prefs.coaching || !prefs.checkIn}
            onPress={() =>
              updatePrefs({
                checkIn: false,
                coaching: prefs.coaching && prefs.weeklyReview,
              })
            }
          />
          {!flexible && (
            <Choice
              icon="💬"
              title="One check after a session"
              selected={prefs.coaching && prefs.checkIn}
              disabled={!canCoach}
              detail={
                !canCoach
                  ? "Requires a coaching trial or subscription."
                  : "After unanswered checks, the coach pauses."
              }
              onPress={() =>
                updatePrefs({
                  coaching: true,
                  checkIn: true,
                  weeklyReview:
                    support.preferences.coaching && prefs.weeklyReview,
                })
              }
            />
          )}
        </>
      );
      footer = (
        <Button
          busy={save.isPending}
          onPress={
            prefs.coaching &&
            prefs.checkIn &&
            draft.mode !== "TIMED" &&
            !flexible
              ? () => next("time")
              : persist
          }
        >
          {prefs.coaching &&
          prefs.checkIn &&
          draft.mode !== "TIMED" &&
          !flexible
            ? "Continue"
            : "Save check-in"}
        </Button>
      );
    }
  } else {
    icon = "⏱️";
    title = "Your session tools";
    description =
      "Choose what opens when you start. Nothing is logged automatically.";
    body = (
      <>
        {(["LOG", "TIMER", "RESOURCE"] as const).map((format) => (
          <Choice
            key={format}
            icon={format === "LOG" ? "✅" : format === "TIMER" ? "⏱️" : "🔗"}
            title={
              format === "LOG"
                ? "Just log"
                : format === "TIMER"
                  ? "Use a timer"
                  : "Open a resource"
            }
            selected={draft.format === format}
            onPress={() => setDraft({ ...draft, format })}
          />
        ))}
        {draft.format === "RESOURCE" && (
          <>
            <Field
              label="Resource name"
              value={draft.resourceName || ""}
              onChangeText={(resourceName) =>
                setDraft({ ...draft, resourceName })
              }
            />
            <Field
              label="Resource link"
              value={draft.resourceUrl || ""}
              onChangeText={(resourceUrl) =>
                setDraft({ ...draft, resourceUrl: resourceUrl || null })
              }
              autoCapitalize="none"
              keyboardType="url"
            />
            <Copy muted>This opens another app or website.</Copy>
          </>
        )}
        <Field
          label="Session length in minutes"
          value={String(draft.durationMinutes)}
          keyboardType="number-pad"
          onChangeText={(value) =>
            setDraft({ ...draft, durationMinutes: Number(value) })
          }
        />
      </>
    );
    footer = (
      <Button
        busy={save.isPending}
        disabled={
          !Number.isInteger(draft.durationMinutes) ||
          draft.durationMinutes < 1 ||
          draft.durationMinutes > 1440 ||
          (draft.format === "RESOURCE" &&
            !/^https:\/\//.test(draft.resourceUrl || ""))
        }
        onPress={persist}
      >
        Save session tools
      </Button>
    );
  }
  return (
    <LoggingDrawer
      testID="plan-assistance-sheet"
      dismissLabel="Dismiss plan assistance"
      onClose={close}
      keyboardToolbar
    >
      <View style={{ gap: 12, alignItems: "center", paddingTop: 12 }}>
        <Text style={{ fontSize: 52, lineHeight: 64 }}>{icon}</Text>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 24,
            fontWeight: "700",
            color: c.text,
            textAlign: "center",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 16,
            lineHeight: 23,
            color: c.muted,
            textAlign: "center",
          }}
        >
          {description}
        </Text>
      </View>
      <View style={{ gap: 10 }}>{body}</View>
      <Status error={save.error} />
      {footer}
      {step !== "choice" && (
        <Button
          secondary
          disabled={save.isPending}
          onPress={() =>
            next(
              step === "time"
                ? control === "schedule"
                  ? "optional-time"
                  : control === "review"
                    ? "days"
                    : "choice"
                : step === "optional-time"
                  ? "days"
                  : "choice",
            )
          }
        >
          Back
        </Button>
      )}
    </LoggingDrawer>
  );
}

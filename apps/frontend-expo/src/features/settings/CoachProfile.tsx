import { useEffect, useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Button, Copy, Field, Status } from "@/components/ui";
import { api } from "@/data/api";
import { useAction } from "@/data/queries";
import type { CoachDetails, CoachProfile as Profile } from "./types";
export function CoachProfile() {
  const query = useQuery({
    queryKey: ["my-coach-profile"],
    queryFn: async () => {
      try {
        return (await api.get<Profile>("/coaches/my-profile")).data;
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) return null;
        throw error;
      }
    },
  });
  const [details, setDetails] = useState<CoachDetails>({
    title: "",
    bio: "",
    focusDescription: "",
    idealPlans: [{ emoji: "🎯", title: "" }],
  });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (query.data) setDetails(query.data.details);
  }, [query.data]);
  const save = useAction(async () => {
    await api.post("/coaches/create-profile", {
      ...details,
      idealPlans: details.idealPlans.filter((p) => p.title.trim()),
    });
    setSaved(true);
  });
  return (
    <>
      <Copy muted>
        Your profile for helping other people. Your personal AI coach is managed
        from your plans.
      </Copy>
      <Status loading={query.isLoading} error={query.error ?? save.error} />
      <Field
        label="Coach title"
        value={details.title}
        onChangeText={(title) => {
          setSaved(false);
          setDetails({ ...details, title });
        }}
      />
      <Field
        label="Bio"
        multiline
        value={details.bio}
        onChangeText={(bio) => {
          setSaved(false);
          setDetails({ ...details, bio });
        }}
      />
      <Field
        label="What do you specialize in?"
        multiline
        value={details.focusDescription}
        onChangeText={(focusDescription) => {
          setSaved(false);
          setDetails({ ...details, focusDescription });
        }}
      />
      {details.idealPlans.map((plan, i) => (
        <View key={i} style={{ gap: 8 }}>
          <Field
            label="Icon"
            value={plan.emoji}
            onChangeText={(emoji) =>
              setDetails({
                ...details,
                idealPlans: details.idealPlans.map((p, n) =>
                  n === i ? { ...p, emoji } : p,
                ),
              })
            }
          />
          <Field
            label="Ideal plan"
            value={plan.title}
            onChangeText={(title) =>
              setDetails({
                ...details,
                idealPlans: details.idealPlans.map((p, n) =>
                  n === i ? { ...p, title } : p,
                ),
              })
            }
          />
          {details.idealPlans.length > 1 && (
            <Button
              secondary
              onPress={() =>
                setDetails({
                  ...details,
                  idealPlans: details.idealPlans.filter((_, n) => i !== n),
                })
              }
            >
              Remove plan type
            </Button>
          )}
        </View>
      ))}
      <Button
        secondary
        onPress={() =>
          setDetails({
            ...details,
            idealPlans: [...details.idealPlans, { emoji: "🎯", title: "" }],
          })
        }
      >
        Add plan type
      </Button>
      <Button
        busy={save.isPending}
        disabled={
          query.isLoading ||
          !!query.error ||
          !details.title.trim() ||
          !details.bio.trim() ||
          !details.focusDescription.trim() ||
          !details.idealPlans.some((p) => p.title.trim())
        }
        onPress={() => save.mutate()}
      >
        {saved ? "Saved" : "Save coach profile"}
      </Button>
    </>
  );
}

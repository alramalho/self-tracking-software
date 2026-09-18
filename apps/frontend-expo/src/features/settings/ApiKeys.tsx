import { useState } from "react";
import { Linking, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { api } from "@/data/api";
import { useAction } from "@/data/queries";
import { Status, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import {
  EditorButton,
  EditorInput,
} from "@/features/activities/editor/controls";
import { SettingsCard } from "./SettingsCard";
import type { ApiKeySummary, CreatedApiKey } from "./types";
export function ApiKeys() {
  const c = useColors();
  const [label, setLabel] = useState(""),
    [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [confirm, setConfirm] = useState<string>(),
    [copied, setCopied] = useState<string>(),
    [error, setError] = useState<unknown>();
  const keys = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () =>
      (await api.get<{ keys: ApiKeySummary[] }>("/api-keys")).data.keys,
  });
  const create = useAction(async () => {
    const key = (
      await api.post<CreatedApiKey>("/api-keys", {
        label: label.trim() || "claude-code",
      })
    ).data;
    setCreated(key);
    setLabel("");
    setCopied(undefined);
  });
  const revoke = useAction(async (id: string) => {
    await api.delete(`/api-keys/${id}`);
    if (created?.id === id) setCreated(null);
    setConfirm(undefined);
  });
  const backend = (api.defaults.baseURL || "").replace(/\/$/, ""),
    mcp = `${backend}/mcp`;
  const command = created
    ? `claude mcp add --scope user --transport http tracking-so ${mcp} --header "Authorization: Bearer ${created.key}"`
    : "";
  const setup = created
    ? `Set up tracking.so for me, step by step. Confirm each result before continuing.\n\n1. Register the streamable HTTP MCP server at ${mcp}, using Authorization: Bearer ${created.key}. For Claude Code, run: ${command}\n2. If your client supports skills, install the usage skill from ${backend}/skill.md.\n3. Verify the connection with get_user_state and summarize my account.\n4. If I have no plans, ask about my goal, activities, weekly frequency or dates, and finishing date, then create my first plan. Ask whether I have a curriculum to attach with replace_curriculum.`
    : "";
  const copy = (value: string, name: string) =>
    void Clipboard.setStringAsync(value)
      .then(() => setCopied(name))
      .catch(setError);
  const textStyle = { color: c.muted, fontSize: 14, lineHeight: 21 };
  const titleStyle = {
    color: c.text,
    fontSize: 14,
    fontWeight: "500" as const,
  };
  return (
    <View style={{ gap: 24 }}>
      <Text style={textStyle}>
        Connect another AI to keep your curriculum, schedule and weekly status
        in sync. Your coach here stays focused on accountability.
      </Text>
      <EditorButton
        label="Full connection guide"
        secondary
        onPress={() =>
          void Linking.openURL(
            "https://tracking.so/docs/bring-your-own-curriculum",
          ).catch(setError)
        }
      />
      <View style={{ gap: 12 }}>
        <Text style={titleStyle}>1. Create an API key</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <EditorInput
              label="Key label"
              placeholder="Label (e.g. claude-code)"
              value={label}
              onChangeText={setLabel}
              editable={!create.isPending}
            />
          </View>
          <EditorButton
            label="Create"
            busy={create.isPending}
            onPress={() => create.mutate()}
          />
        </View>
        {created && (
          <View
            style={{
              gap: 12,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#f59e0b66",
              backgroundColor: "#f59e0b1a",
            }}
          >
            <Text style={textStyle}>
              Copy this key now. It will not be shown again.
            </Text>
            <Text
              selectable
              style={{ ...textStyle, fontFamily: "monospace", fontSize: 12 }}
            >
              {created.key}
            </Text>
            <EditorButton
              label={copied === "key" ? "Copied API key" : "Copy API key"}
              secondary
              onPress={() => copy(created.key, "key")}
            />
          </View>
        )}
      </View>
      <View style={{ gap: 12 }}>
        <Text style={titleStyle}>
          2. Paste the setup prompt into your agent
        </Text>
        {created ? (
          <>
            <Text style={textStyle}>
              Your agent registers the connection and verifies your account.
              Read the steps before sending it.
            </Text>
            <Text
              selectable
              style={{
                ...textStyle,
                backgroundColor: c.soft,
                padding: 12,
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              {setup}
            </Text>
            <EditorButton
              label={
                copied === "setup" ? "Copied setup prompt" : "Copy setup prompt"
              }
              secondary
              onPress={() => copy(setup, "setup")}
            />
            <EditorButton
              label={
                copied === "command" ? "Copied MCP command" : "Copy MCP command"
              }
              secondary
              onPress={() => copy(command, "command")}
            />
          </>
        ) : (
          <Text style={textStyle}>
            Create a key above and a ready-to-paste setup prompt appears here.
            Other MCP clients connect to {mcp} with the key as a Bearer token.
          </Text>
        )}
      </View>
      <View style={{ gap: 12 }}>
        <Text style={titleStyle}>3. Use it</Text>
        <Text style={textStyle}>
          Your agent can check plans, create schedules, log your work and keep
          your curriculum synced. On a plan, choose “Weeks planned by your
          connected AI” to hand it week planning.
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={titleStyle}>Your API keys</Text>
        {!keys.isPending && !keys.error && !keys.data?.length && (
          <Text style={textStyle}>No API keys yet.</Text>
        )}
        {keys.data?.map((key) => (
          <View key={key.id} style={{ gap: 8 }}>
            <SettingsCard
              title={key.label || "Unlabeled key"}
              description={`Created ${new Date(key.createdAt).toLocaleDateString()} · ${key.lastUsedAt ? `last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : "never used"}`}
            />
            <EditorButton
              label={confirm === key.id ? "Confirm revoke" : "Revoke key"}
              secondary
              destructive
              busy={revoke.isPending}
              onPress={() =>
                confirm === key.id ? revoke.mutate(key.id) : setConfirm(key.id)
              }
            />
            {confirm === key.id && (
              <EditorButton
                label="Cancel"
                secondary
                disabled={revoke.isPending}
                onPress={() => setConfirm(undefined)}
              />
            )}
          </View>
        ))}
      </View>
      <Status
        loading={keys.isPending}
        error={error || keys.error || create.error || revoke.error}
      />
    </View>
  );
}

import { useApiWithAuth } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";

interface ApiKeySummary {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

interface CreatedApiKey extends ApiKeySummary {
  key: string;
}

const DOCS_URL =
  "https://tracking.so/docs/bring-your-own-curriculum";

function CopyableSnippet({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(label ? `${label} copied` : "Copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted/70 p-3">
      <code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs text-foreground">
        {text}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
        aria-label={`Copy ${label || "snippet"}`}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  );
}

export function IntegrationsSettings() {
  const api = useApiWithAuth();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [confirmingRevokeId, setConfirmingRevokeId] = useState<string | null>(
    null,
  );

  const backendUrl = (api.defaults.baseURL || "").replace(/\/$/, "");
  const mcpUrl = `${backendUrl}/mcp`;

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const response = await api.get<{ keys: ApiKeySummary[] }>("/api-keys");
      return response.data.keys;
    },
  });

  const createKey = useMutation({
    mutationFn: async () => {
      const response = await api.post<CreatedApiKey>("/api-keys", {
        label: label.trim() || "claude-code",
      });
      return response.data;
    },
    onSuccess: (key) => {
      setCreatedKey(key);
      setLabel("");
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Could not create API key");
    },
  });

  const revokeKey = useMutation({
    mutationFn: (keyId: string) => api.delete(`/api-keys/${keyId}`),
    onSuccess: (_, keyId) => {
      if (createdKey?.id === keyId) setCreatedKey(null);
      setConfirmingRevokeId(null);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key revoked");
    },
    onError: () => toast.error("Could not revoke API key"),
  });

  const mcpCommand = createdKey
    ? `claude mcp add --scope user --transport http tracking-so ${mcpUrl} --header "Authorization: Bearer ${createdKey.key}"`
    : null;

  const setupPrompt = createdKey
    ? `Set up tracking.so for me, step by step. Confirm each step's result before the next.

1. Register the tracking.so MCP server.
   - Claude Code: run \`claude mcp add --scope user --transport http tracking-so ${mcpUrl} --header "Authorization: Bearer ${createdKey.key}"\`
   - Other MCP clients: it is a streamable HTTP server at ${mcpUrl}, authenticated with the header \`Authorization: Bearer ${createdKey.key}\`.
2. Install the tracking.so usage skill (skip on clients without skills): run \`mkdir -p ~/.claude/skills/tracking-so && curl -fsSL ${backendUrl}/skill.md -o ~/.claude/skills/tracking-so/SKILL.md\`, then confirm the file starts with YAML frontmatter.
3. Verify the connection: call the tracking-so \`get_user_state\` tool and give me a one-line summary of my account.
4. If I have no plans yet, interview me briefly (goal, an emoji, frequency target or dated sessions, finishing date, which loggable activities) and create my first plan with \`create_plan\`. Then ask whether I have a self-built curriculum (markdown folder) to attach with \`replace_curriculum\`.`
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Connect your AI tools</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Personal API keys let tools like Claude Code talk to your tracking.so
          account over MCP: manage your plans and attach your own markdown
          curriculum that your coach reads when planning your weeks.{" "}
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Full guide
          </a>
        </p>
      </div>

      {/* Step 1: create a key */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">
          1. Create an API key
        </p>
        <div className="flex items-center gap-2">
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Label (e.g. claude-code)"
            className="flex-1"
          />
          <Button
            onClick={() => createKey.mutate()}
            disabled={createKey.isPending}
          >
            {createKey.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span className="ml-1">Create</span>
          </Button>
        </div>

        {createdKey && (
          <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs font-medium text-amber-600">
              Copy this key now. It will not be shown again.
            </p>
            <CopyableSnippet text={createdKey.key} label="API key" />
          </div>
        )}
      </div>

      {/* Step 2: hand the setup to your agent */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">
          2. Paste the setup prompt into your agent
        </p>
        {setupPrompt && mcpCommand ? (
          <>
            <p className="text-sm text-muted-foreground">
              Your agent (Claude Code, Codex, Cursor) does the rest: registers
              the MCP server, installs the usage skill, verifies the
              connection, and onboards you if you have no plans yet. You can
              read every step before sending it.
            </p>
            <CopyableSnippet text={setupPrompt} label="Setup prompt" />
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer">
                Prefer manual setup? Just the MCP command
              </summary>
              <div className="mt-2">
                <CopyableSnippet text={mcpCommand} label="MCP command" />
              </div>
            </details>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Create a key above and a ready-to-paste setup prompt appears here.
            Other MCP clients connect to{" "}
            <code className="font-mono text-xs">{mcpUrl}</code> with the key as
            a Bearer token.
          </p>
        )}
      </div>

      {/* Step 3: what you get */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">
          3. Use it
        </p>
        <p className="text-sm text-muted-foreground">
          From then on your agent can check your plans, create new ones, and
          push your self-built curriculum, and your coach plans your weeks from
          those files. Try: {'"'}push my curriculum folder to my tracking.so
          plan{'"'}.
        </p>
      </div>

      {/* Existing keys */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Your API keys</p>
        {isLoading ? (
          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading keys
          </div>
        ) : keys.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            No API keys yet.
          </p>
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <KeyRound size={18} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {key.label || "Unlabeled key"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {format(new Date(key.createdAt), "MMM d, yyyy")}
                    {key.lastUsedAt
                      ? ` · last used ${format(new Date(key.lastUsedAt), "MMM d")}`
                      : " · never used"}
                  </p>
                </div>
              </div>
              {confirmingRevokeId === key.id ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={revokeKey.isPending}
                  onClick={() => revokeKey.mutate(key.id)}
                >
                  Revoke?
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-red-600"
                  onClick={() => setConfirmingRevokeId(key.id)}
                  aria-label="Revoke API key"
                >
                  <Trash2 size={18} />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/contexts/users";
import {
  isReactionEmoji,
  MAX_REACTION_EMOJIS,
  normalizeReactionEmojiInput,
  normalizeReactionEmojis,
  REACTION_EMOJI_CATEGORIES,
} from "@tsw/prisma/reactions";
import { Plus, Smile, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

interface ReactionEmojiDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ReactionEmojiDrawer({
  open,
  onOpenChange,
}: ReactionEmojiDrawerProps) {
  const { currentUser, updateUser, isUpdatingUser } = useCurrentUser();
  const savedEmojis = normalizeReactionEmojis(currentUser?.reactionEmojis);
  const [emojis, setEmojis] = useState(savedEmojis);
  const [newEmoji, setNewEmoji] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open) {
      setEmojis(normalizeReactionEmojis(currentUser?.reactionEmojis));
      setNewEmoji("");
      setPickerOpen(false);
      setError(undefined);
    }
  }, [open, currentUser?.reactionEmojis]);

  const addEmoji = () => {
    const emoji = newEmoji.trim();
    if (!isReactionEmoji(emoji)) {
      setError("Choose or enter one emoji at a time.");
      return;
    }
    if (emojis.includes(emoji)) {
      setError("That emoji is already in your reaction tray.");
      return;
    }
    if (emojis.length >= MAX_REACTION_EMOJIS) {
      setError(`You can choose up to ${MAX_REACTION_EMOJIS} reactions.`);
      return;
    }
    setEmojis((current) => [...current, emoji]);
    setNewEmoji("");
    setPickerOpen(false);
    setError(undefined);
  };

  const save = async () => {
    try {
      await updateUser({
        updates: { reactionEmojis: emojis },
        muteNotifications: true,
      });
      onOpenChange(false);
      toast.success("Reaction emojis updated");
    } catch {
      // The shared user context shows the request error.
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-4 pb-4">
        <DrawerHeader className="px-0 text-left">
          <DrawerTitle>Customize reactions</DrawerTitle>
          <DrawerDescription>
            Pick the emojis that appear when you react to a friend&apos;s post.
            Pick one below or type or paste one emoji from your device keyboard.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-wrap gap-2 px-1">
          {emojis.map((emoji) => (
            <div
              key={emoji}
              className="flex items-center gap-1 rounded-2xl border bg-muted/40 px-2 py-1"
            >
              <span className="text-2xl leading-9">{emoji}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${emoji}`}
                disabled={emojis.length === 1}
                onClick={() => setEmojis((current) => current.filter((item) => item !== emoji))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-2">
          <Input
            value={newEmoji}
            onChange={(event) =>
              setNewEmoji(normalizeReactionEmojiInput(event.target.value))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addEmoji();
              }
            }}
            placeholder="Choose one emoji"
            aria-label="Add a reaction emoji"
            maxLength={32}
            disabled={emojis.length >= MAX_REACTION_EMOJIS}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            aria-label="Open emoji picker"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((open) => !open)}
            disabled={emojis.length >= MAX_REACTION_EMOJIS}
          >
            <Smile className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0"
            onClick={addEmoji}
            disabled={!newEmoji.trim() || emojis.length >= MAX_REACTION_EMOJIS}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add
          </Button>
        </div>
        {pickerOpen && (
          <div
            role="group"
            aria-label="Emoji picker"
            className="mt-2 max-h-[38vh] space-y-2 overflow-y-auto rounded-xl border bg-muted/30 p-2"
          >
            {REACTION_EMOJI_CATEGORIES.map((category) => (
              <div key={category.name}>
                <p className="px-1 text-sm font-medium text-muted-foreground">{category.name}</p>
                <div className="flex flex-wrap gap-1">
                  {category.emojis.map((emoji) => (
                    <Button
                      key={emoji}
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-xl"
                      aria-label={`Choose ${emoji}`}
                      onClick={() => {
                        setNewEmoji(emoji);
                        setPickerOpen(false);
                        setError(undefined);
                      }}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <p className="px-1 text-sm text-destructive">{error}</p>}

        <DrawerFooter className="px-0 pt-4">
          <Button onClick={() => void save()} loading={isUpdatingUser}>
            Save reactions
          </Button>
          <Button
            variant="ghost"
            disabled={isUpdatingUser}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

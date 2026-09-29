import AppleLikePopover from "@/components/AppleLikePopover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toApiErrorMessage } from "@/utils/errorMessage";
import { useEffect, useState } from "react";
import type { RenameCircleDialogProps } from "../types";

export function RenameCircleDialog({ open, currentName, onClose, onSave }: RenameCircleDialogProps) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setName(currentName);
    setError(undefined);
  }, [open, currentName]);

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await onSave(name.trim());
      onClose();
    } catch (failure) {
      setError(toApiErrorMessage(failure, "Couldn't rename"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppleLikePopover open={open} onClose={onClose} title="Rename circle">
      <form
        className="flex flex-col gap-3 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) void save();
        }}
      >
        <h2 className="text-lg font-bold text-foreground">Rename circle</h2>
        <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          Name
          <Input value={name} maxLength={60} autoFocus onChange={(event) => setName(event.target.value)} />
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="h-12 w-full" loading={saving} disabled={!name.trim() || saving}>
          Save
        </Button>
      </form>
    </AppleLikePopover>
  );
}

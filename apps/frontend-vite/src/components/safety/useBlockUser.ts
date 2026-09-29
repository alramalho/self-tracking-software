import { useApiWithAuth } from "@/api";
import { toApiErrorMessage } from "@/utils/errorMessage";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { BlockablePerson } from "./types";

export const personLabel = (person: Omit<BlockablePerson, "id">) =>
  person.username ? `@${person.username}` : person.name || "this person";

// Blocking asks first, then hides that person everywhere (all queries refetch).
export function useBlockUser() {
  const api = useApiWithAuth();
  const queryClient = useQueryClient();
  const block = useMutation({
    mutationFn: async (id: string) => api.post(`/moderation/blocks/${id}`),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (person: BlockablePerson, onBlocked?: () => void) => {
    const confirmed = window.confirm(
      `Block ${personLabel(person)}?\n\nYou won't see each other's activity, comments or messages, and they won't be told.`
    );
    if (!confirmed) return;
    block.mutate(person.id, {
      onSuccess: () => {
        toast.success(`Blocked ${personLabel(person)}`);
        onBlocked?.();
      },
      onError: (error) => toast.error(toApiErrorMessage(error, "Couldn't block")),
    });
  };
}

import { Sheet } from "@/components/ui";
import { ReactionEmojiEditor } from "./ReactionEmojiEditor";

interface ReactionEmojiSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function ReactionEmojiSheet({
  visible,
  onClose,
}: ReactionEmojiSheetProps) {
  return (
    <Sheet visible={visible} title="Customize reactions" onClose={onClose}>
      <ReactionEmojiEditor onClose={onClose} />
    </Sheet>
  );
}

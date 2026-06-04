import type { ImageAttachment } from "@/contexts/messages";
import { cn } from "@/lib/utils";

type MessageImageAttachmentsProps = {
  images?: ImageAttachment[] | null;
  onOpen?: (image: { src: string; alt: string }) => void;
};

export function MessageImageAttachments({
  images,
  onOpen,
}: MessageImageAttachmentsProps) {
  if (!images?.length) return null;

  return (
    <div className={cn("grid gap-2", images.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
      {images.map((image, index) => {
        const alt = image.filename || `Attachment ${index + 1}`;
        return (
          <button
            type="button"
            key={image.id || `${image.url}-${index}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpen?.({ src: image.url, alt });
            }}
            className="block overflow-hidden rounded-xl border border-border/60 bg-background/40 text-left"
            aria-label={`Open ${alt}`}
          >
            <img
              src={image.url}
              alt={alt}
              className={cn(
                "h-auto w-full object-cover",
                images.length === 1 ? "max-h-72" : "aspect-square"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

import { cn } from "@/lib/utils";
import type { ImageAttachment } from "@/contexts/messages";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

const MAX_CHAT_IMAGES = 4;
const MAX_CHAT_IMAGE_DATA_URL_LENGTH = 1_600_000;
const MAX_CHAT_IMAGE_DIMENSION = 1800;

type PendingImageAttachment = Required<Pick<ImageAttachment, "id" | "url" | "mediaType">> &
  Pick<ImageAttachment, "filename">;

type SendPayload = {
  message: string;
  imageAttachments: ImageAttachment[];
};

type ChatMessageComposerProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSend: (payload: SendPayload) => Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  isSending?: boolean;
  allowImages?: boolean;
  imagesDisabled?: boolean;
  ariaLabel?: string;
  className?: string;
  resetAttachmentsKey?: unknown;
};

function getImageDataUrlLength(dataUrl: string) {
  return dataUrl.length;
}

async function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

async function normalizeChatImage(file: File): Promise<PendingImageAttachment> {
  let sourceFile = file;
  if (file.type === "image/heic" || file.type === "image/heif") {
    const heic2any = (await import("heic2any")).default;
    const blob = (await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    })) as Blob;
    sourceFile = new File(
      [blob],
      file.name.replace(/\.(heic|heif)$/i, ".jpg"),
      { type: "image/jpeg" }
    );
  }

  const dataUrl = await readImageAsDataUrl(sourceFile);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });

  let width = img.width;
  let height = img.height;
  const scale = Math.min(1, MAX_CHAT_IMAGE_DIMENSION / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not process image");
  }
  context.drawImage(img, 0, 0, width, height);

  let quality = 0.88;
  let compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
  while (
    getImageDataUrlLength(compressedDataUrl) > MAX_CHAT_IMAGE_DATA_URL_LENGTH &&
    quality > 0.55
  ) {
    quality -= 0.08;
    compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  if (getImageDataUrlLength(compressedDataUrl) > MAX_CHAT_IMAGE_DATA_URL_LENGTH) {
    throw new Error("Image is too large");
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    url: compressedDataUrl,
    mediaType: "image/jpeg",
    filename: sourceFile.name || "image.jpg",
  };
}

export function ChatMessageComposer({
  value,
  onValueChange,
  onSend,
  placeholder = "Type a message...",
  disabled = false,
  isSending = false,
  allowImages = true,
  imagesDisabled = false,
  ariaLabel = "Message",
  className,
  resetAttachmentsKey,
}: ChatMessageComposerProps) {
  const [pendingImages, setPendingImages] = useState<PendingImageAttachment[]>([]);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeInput = useCallback((textarea: HTMLTextAreaElement) => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    textarea.scrollTop = textarea.scrollHeight;
  }, []);

  useEffect(() => {
    if (!textareaRef.current) return;
    resizeInput(textareaRef.current);
  }, [resizeInput, value]);

  useEffect(() => {
    setPendingImages([]);
  }, [resetAttachmentsKey]);

  const addImageFiles = useCallback(
    async (files: File[]) => {
      if (!allowImages) return;

      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      if (pendingImages.length + imageFiles.length > MAX_CHAT_IMAGES) {
        toast.error(`Attach up to ${MAX_CHAT_IMAGES} images`);
        return;
      }

      setIsProcessingImages(true);
      const toastId = toast.loading(
        imageFiles.length === 1 ? "Processing image..." : "Processing images..."
      );

      try {
        const processedImages: PendingImageAttachment[] = [];
        for (const file of imageFiles) {
          processedImages.push(await normalizeChatImage(file));
        }
        setPendingImages((current) => [...current, ...processedImages]);
      } catch (error) {
        console.error("Failed to process image:", error);
        toast.error(
          error instanceof Error && error.message === "Image is too large"
            ? "Image is too large"
            : "Failed to process image"
        );
      } finally {
        toast.dismiss(toastId);
        setIsProcessingImages(false);
      }
    },
    [allowImages, pendingImages.length]
  );

  const removePendingImage = useCallback((imageId: string) => {
    setPendingImages((current) =>
      current.filter((image) => image.id !== imageId)
    );
  }, []);

  const canSend =
    (!!value.trim() || pendingImages.length > 0) &&
    !disabled &&
    !isSending &&
    !isProcessingImages;
  const imageControlsDisabled =
    disabled || imagesDisabled || isSending || isProcessingImages;

  const handleSend = async () => {
    if (!canSend) return;

    const message = value.trim();
    const imageAttachments = pendingImages.map((image) => ({
      id: image.id,
      url: image.url,
      mediaType: image.mediaType,
      filename: image.filename,
    }));
    const sentImages = pendingImages;

    onValueChange("");
    setPendingImages([]);

    try {
      await onSend({ message, imageAttachments });
    } catch (error) {
      onValueChange(message);
      setPendingImages(sentImages);
    }
  };

  return (
    <div className={cn("bg-muted/80 rounded-3xl px-3 py-3 border border-border backdrop-blur-md", className)}>
      {pendingImages.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 px-1">
          {pendingImages.map((image) => (
            <div
              key={image.id}
              className="relative h-16 w-16 overflow-hidden rounded-xl border border-border bg-background"
            >
              <img
                src={image.url}
                alt={image.filename || "Attachment preview"}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePendingImage(image.id)}
                className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5 text-foreground shadow-sm transition-colors hover:bg-background"
                aria-label="Remove image"
                title="Remove image"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {allowImages && (
          <>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={imageControlsDisabled}
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                void addImageFiles(files);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={imageControlsDisabled}
              className={cn(
                "rounded-full p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                imageControlsDisabled &&
                  "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground"
              )}
              aria-label="Attach image"
              title="Attach image"
            >
              {isProcessingImages ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ImagePlus size={18} />
              )}
            </button>
          </>
        )}

        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onPaste={(event) => {
              const files = Array.from(event.clipboardData.files || []);
              const imageFiles = files.filter((file) => file.type.startsWith("image/"));
              if (imageFiles.length > 0 && allowImages && !imagesDisabled) {
                event.preventDefault();
                void addImageFiles(imageFiles);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder={placeholder}
            rows={1}
            wrap="soft"
            spellCheck
            aria-label={ariaLabel}
            enterKeyHint="send"
            className="w-full max-h-[7.5rem] resize-none overflow-y-auto break-words border-none bg-transparent text-base text-foreground outline-none [overflow-wrap:anywhere] placeholder:text-muted-foreground"
            disabled={disabled}
            onInput={(event) => {
              resizeInput(event.target as HTMLTextAreaElement);
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          className={cn(
            "p-2.5 rounded-full transition-colors flex-shrink-0",
            canSend
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "bg-muted-foreground/20 text-muted-foreground cursor-not-allowed"
          )}
          aria-label="Send message"
          title="Send message"
        >
          {isSending || isProcessingImages ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
    </div>
  );
}

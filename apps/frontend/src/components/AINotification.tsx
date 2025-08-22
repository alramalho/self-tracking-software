import React from "react";
import {
  ArrowRight,
  Key,
  Lock,
  LockKeyhole,
  Reply,
  ScanFace,
  X,
} from "lucide-react";
import { Remark } from "react-remark";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "./ui/badge";
import { formatTimeAgo } from "@/lib/utils";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { getMessagePreview } from "@/lib/utils";

interface AINotificationProps {
  messages: string[];
  createdAt: string;
  onDismiss?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  preview?: boolean;
  hasNotification?: boolean;
  replyMessage?: string;
}

const AINotification: React.FC<AINotificationProps> = ({
  messages,
  createdAt,
  onDismiss,
  onClick,
  hasNotification,
  replyMessage,
  preview = false,
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  const waveVariants = {
    initial: { rotate: 0 },
    wave: {
      rotate: [0, 25, -15, 25, -15, 0],
      transition: {
        delay: 1,
        duration: 1.5,
        times: [0, 0.2, 0.4, 0.6, 0.8, 1],
        ease: "easeInOut",
      },
    },
  };

  const displayMessages = messages.map((message) =>
    preview ? getMessagePreview(message) : message
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`relative bg-opacity-50 p-2 backdrop-blur-sm rounded-2xl flex items-start cursor-pointer`}
      onClick={onClick}
    >
      <div className="relative self-end flex-shrink-0 mr-2">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="rounded-full"
        >
          <ScanFace className={`w-12 h-12 ${variants.text}`} />
          <motion.span
            className="absolute top-[9px] left-[-10px]"
            initial="initial"
            animate="wave"
            variants={waveVariants}
            style={{ transformOrigin: "90% 90%" }}
          >
            👋
          </motion.span>
        </motion.div>
      </div>
      <motion.div
        className="flex-grow"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        {displayMessages.map((message, index) => (
          <div key={index} className="relative p-2 markdown mt-2 text-sm text-gray-700 border border-gray-200 rounded-t-lg rounded-tr-lg rounded-br-lg bg-white">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: hasNotification ? 1 : 0 }}
              transition={{ duration: 0.3, delay: 1.2 }}
              className="absolute -top-2 -left-2 z-10"
            >
              {index === 0 && (
                <Badge
                  variant="destructive"
                  className="h-5 w-5 flex text-md items-center justify-center p-0"
                >
                  1
                </Badge>
              )}
            </motion.div>
            <Remark>{message}</Remark>
          </div>
        ))}

        <div className="flex flex-row justify-between">
          <div className="text-xs text-gray-500 mt-1">
            {formatTimeAgo(createdAt)}
          </div>
          {onClick && (
            <div
              className={`flex flex-row items-center gap-1 p-1 px-2 mt-2 rounded-full ${variants.button.glass} cursor-pointer`}
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              {preview ? (
                <>
                  <Key size={15} />
                  <span className="text-sm">Unlock</span>
                </>
              ) : (
                <>
                  <Reply size={15} />
                  <span className="text-sm">{replyMessage ?? "Reply"}</span>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
      {onDismiss && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 1.2 }}
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(e);
          }}
          className="absolute top-1 right-1 p-[3px] rounded-full bg-gray-500"
          aria-label="Dismiss"
        >
          <X size={15} className="text-white" />
        </motion.button>
      )}
    </motion.div>
  );
};

export default AINotification;

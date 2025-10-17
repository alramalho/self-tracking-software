import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCurrentUser } from "@/contexts/users";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { useNavigate } from "@tanstack/react-router";
import { type Comment } from "@tsw/prisma";
import { differenceInCalendarDays, format, isToday, isYesterday } from 'date-fns';
import { ChevronDown, ChevronUp, Send, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

interface CommentSectionProps {
  activityEntryId: string;
  comments: (Comment & { user: { username: string; picture: string } })[];
  onAddComment: (text: string) => Promise<void>;
  onRemoveComment: (commentId: string) => Promise<void>;
  hasImage?: boolean;
  fullWidth?: boolean;
  showAllComments?: boolean;
  onToggleShowAll?: (shown: boolean) => void;
  isAddingComment?: boolean;
  isRemovingComment?: boolean;
  className?: string;
}

const getFormattedDate = (date: Date) => {
  const parsedDate = date;
  const now = new Date();

  if (isToday(parsedDate)) {
    return `today at ${format(parsedDate, "HH:mm")}`;
  }

  if (isYesterday(parsedDate)) {
    return `yesterday at ${format(parsedDate, "HH:mm")}`;
  }

  const diffInCalendarDays = differenceInCalendarDays(now, parsedDate);

  if (diffInCalendarDays <= 7) {
    return `${format(parsedDate, "EEEE")} at ${format(parsedDate, "HH:mm")}`;
  }

  return format(parsedDate, "MMM d HH:mm");
};

export const CommentSection: React.FC<CommentSectionProps> = ({
  activityEntryId,
  comments,
  onAddComment,
  onRemoveComment,
  hasImage = false,
  fullWidth = false,
  showAllComments: externalShowAllState,
  onToggleShowAll,
  isAddingComment = false,
  isRemovingComment = false,
  className = "",
}) => {
  const [newComment, setNewComment] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const { currentUser } = useCurrentUser();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Use external control if provided
  useEffect(() => {
    if (externalShowAllState !== undefined) {
      setShowAllComments(externalShowAllState);
    }
  }, [externalShowAllState]);

  const handleSubmitComment = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!newComment.trim()) return;

    try {
      await onAddComment(newComment.trim());
      setNewComment("");

      // Automatically expand comments when posting
      if (!showAllComments && !externalShowAllState) {
        setShowAllComments(true);
        if (onToggleShowAll) onToggleShowAll(true);
      }
    } catch (error) {
      console.error("Error submitting comment:", error);
      toast.error("Failed to post comment");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await onRemoveComment(commentId);
      toast.success("Comment deleted");
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  const handleToggleShowAll = () => {
    const newState = !showAllComments;
    setShowAllComments(newState);
    if (onToggleShowAll) onToggleShowAll(newState);
  };

  const getVisibleComments = () => {
    if (showAllComments || comments.length <= 2) {
      return comments;
    }
    return comments.slice(-2); // Show only the last 2 comments
  };

  const navigateToProfile = (username: string) => {
    navigate({ to: `/profile/${username}` });
  };

  const commentBg = hasImage ? variants.card.glassBg : "";
  const visibleComments = getVisibleComments();
  const hasHiddenComments = comments.length > 2 && !showAllComments;

  if (comments.length === 0 && !currentUser) {
    return null;
  }

  return (
    <div className={`${fullWidth ? "w-full" : ""} bg-muted/30 backdrop-blur-md  ${className}`}>
      {/* Comments section */}
      {comments.length > 0 && (
        <div className="space-y-2 mb-2">
          {hasHiddenComments && (
            <button
              onClick={handleToggleShowAll}
              className={`w-full text-center py-2 ${commentBg} rounded-lg text-sm text-muted-foreground flex items-center justify-center gap-1 border border-white/20 dark:border-gray-700/20 shadow-sm`}
            >
              Show all {comments.length} comments{" "}
              <ChevronDown className="h-4 w-4" />
            </button>
          )}

          {showAllComments && comments.length > 2 && (
            <button
              onClick={handleToggleShowAll}
              className={`w-full text-center py-2 ${commentBg} rounded-lg text-sm text-muted-foreground flex items-center justify-center gap-1 border border-white/20 dark:border-gray-700/20 shadow-sm`}
            >
              Hide comments <ChevronUp className="h-4 w-4" />
            </button>
          )}

          {visibleComments.map((comment) => (
            <div
              key={comment.id}
              className={`${commentBg} px-3 py-2 rounded-lg border border-white/20 dark:border-gray-700/20 shadow-sm backdrop-blur-lg`}
            >
              <div className="flex items-start gap-2">
                <Avatar
                  className="w-6 h-6 mt-1 cursor-pointer"
                  onClick={() => navigateToProfile(comment.user.username)}
                >
                  <AvatarImage
                    src={comment.user?.picture || undefined}
                    alt={comment.user?.username}
                  />
                  <AvatarFallback>
                    {comment.user?.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className="font-medium text-sm hover:underline cursor-pointer text-foreground"
                      onClick={() => navigateToProfile(comment.user?.username)}
                    >
                      @{comment.user?.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {getFormattedDate(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm break-words whitespace-pre-wrap text-foreground">
                    {comment.text}
                  </p>
                </div>

                {currentUser?.id === comment.userId && (
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comment input */}
      {currentUser && (
        <form onSubmit={handleSubmitComment} className="flex gap-2 w-full">
          <div
            className={`flex items-center gap-2 p-2 w-full ${commentBg} rounded-lg border border-white/20 dark:border-gray-700/20 shadow-sm backdrop-blur-lg`}
          >
            <Avatar className="w-6 h-6">
              <AvatarImage src={currentUser?.picture || undefined} />
              <AvatarFallback>{currentUser?.name?.[0] || "U"}</AvatarFallback>
            </Avatar>

            <input
              type="text"
              ref={inputRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-transparent outline-none text-[16px] z-10 text-foreground placeholder:text-muted-foreground"
              disabled={isAddingComment}
            />

            <button
              type="submit"
              disabled={!newComment.trim() || isAddingComment}
              className={`text-muted-foreground ${
                newComment.trim() ? "hover:text-blue-500" : ""
              } disabled:opacity-50`}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default CommentSection;

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCurrentUser } from "@/contexts/users";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { useNavigate } from "@tanstack/react-router";
import { type Comment } from "@tsw/prisma";
import { differenceInCalendarDays, format, isToday, isYesterday } from 'date-fns';
import { ChevronDown, ChevronUp, CornerDownRight, Send, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";

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

interface UserSearchResult {
  userId: string;
  username: string;
  name: string;
  picture: string;
}

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

  // User search states for @mentions
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUserIndex, setSelectedUserIndex] = useState(0);
  const [mentionSearchQuery, setMentionSearchQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Use external control if provided
  useEffect(() => {
    if (externalShowAllState !== undefined) {
      setShowAllComments(externalShowAllState);
    }
  }, [externalShowAllState]);

  // Search users for @mentions
  const searchUsersForMention = useCallback(async (query: string) => {
    try {
      // Allow empty query to show all friends when just "@" is typed
      const searchQuery = query.trim();
      const endpoint = searchQuery
        ? `/users/search-users/${searchQuery}`
        : `/users/search-users`;
      const response = await api.get(endpoint);
      setUserSearchResults(response.data || []);
      setShowUserSearch(response.data.length > 0);
      setSelectedUserIndex(0);
    } catch (error) {
      console.error("Error searching users:", error);
      setUserSearchResults([]);
      setShowUserSearch(false);
    }
  }, []);

  // Handle comment input change and detect @ mentions
  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    setNewComment(value);

    // Find the last @ before cursor position
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      // Check if there's a space after the @
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      const hasSpaceAfterAt = textAfterAt.includes(" ");

      if (!hasSpaceAfterAt) {
        // Extract search query
        const searchQuery = textAfterAt;
        setMentionSearchQuery(searchQuery);
        setMentionStartPos(lastAtIndex);

        // Debounce search
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = setTimeout(() => {
          searchUsersForMention(searchQuery);
        }, 300);
      } else {
        setShowUserSearch(false);
      }
    } else {
      setShowUserSearch(false);
    }
  };

  // Insert selected user mention
  const insertMention = useCallback(
    (username: string) => {
      if (mentionStartPos === null) return;

      const beforeMention = newComment.substring(0, mentionStartPos);
      const afterMention = newComment.substring(
        mentionStartPos + 1 + mentionSearchQuery.length
      );
      const newText = `${beforeMention}@${username} ${afterMention}`;

      setNewComment(newText);
      setShowUserSearch(false);
      setMentionSearchQuery("");
      setMentionStartPos(null);

      // Focus back on input
      if (inputRef.current) {
        inputRef.current.focus();
      }
    },
    [mentionStartPos, mentionSearchQuery, newComment]
  );

  // Handle keyboard navigation in user search dropdown
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showUserSearch) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedUserIndex((prev) =>
        prev < userSearchResults.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedUserIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && userSearchResults.length > 0) {
      e.preventDefault();
      insertMention(userSearchResults[selectedUserIndex].username);
    } else if (e.key === "Escape") {
      setShowUserSearch(false);
    }
  };

  // Reply to a comment
  const handleReply = useCallback((username: string) => {
    setNewComment(`@${username} `);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

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

  const commentBg = hasImage ? variants.card.glassBg : "bg-muted/30";
  const visibleComments = getVisibleComments();
  const hasHiddenComments = comments.length > 2 && !showAllComments;

  if (comments.length === 0 && !currentUser) {
    return null;
  }

  return (
    <div className={`${fullWidth ? "w-full" : ""} ${className}`}>
      {/* Comments section */}
      {comments.length > 0 && (
        <div className="space-y-2 mb-2">
          {hasHiddenComments && (
            <button
              onClick={handleToggleShowAll}
              className={`w-full text-center py-2 ${commentBg} rounded-lg text-sm text-muted-foreground flex items-center justify-center gap-1 border border-white/20 dark:border-gray-700/20 shadow-sm backdrop-blur-lg`}
            >
              Show all {comments.length} comments{" "}
              <ChevronDown className="h-4 w-4" />
            </button>
          )}

          {showAllComments && comments.length > 2 && (
            <button
              onClick={handleToggleShowAll}
              className={`w-full text-center py-2 ${commentBg} rounded-lg text-sm text-muted-foreground flex items-center justify-center gap-1 border border-white/20 dark:border-gray-700/20 shadow-sm backdrop-blur-lg`}
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
                  {currentUser && currentUser.id !== comment.userId && (
                    <button
                      onClick={() => handleReply(comment.user.username)}
                      className="text-xs text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1"
                    >
                      <CornerDownRight className="h-3 w-3" />
                      Reply
                    </button>
                  )}
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
        <div className="relative">
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
                onChange={handleCommentChange}
                onKeyDown={handleInputKeyDown}
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

          {/* User search dropdown for @mentions */}
          {showUserSearch && userSearchResults.length > 0 && (
            <div
              ref={dropdownRef}
              className={`absolute bottom-full mb-2 left-0 right-0 ${commentBg} rounded-lg border border-white/20 dark:border-gray-700/20 shadow-lg backdrop-blur-lg max-h-48 overflow-y-auto z-50`}
            >
              {userSearchResults.map((user, index) => (
                <button
                  key={user.userId}
                  type="button"
                  onClick={() => insertMention(user.username)}
                  className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-white/20 dark:hover:bg-gray-700/20 transition-colors ${
                    index === selectedUserIndex
                      ? "bg-white/20 dark:bg-gray-700/20"
                      : ""
                  }`}
                >
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={user.picture || undefined} />
                    <AvatarFallback>
                      {user.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium text-foreground">
                      @{user.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {user.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentSection;

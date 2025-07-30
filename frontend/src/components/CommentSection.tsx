import React, { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserPlan, Comment } from "@/contexts/UserPlanContext";
import { useApiWithAuth } from "@/api";
import toast from "react-hot-toast";
import { parseISO, format, isToday, isYesterday, differenceInCalendarDays } from 'date-fns';
import { getThemeVariants } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { Send, X, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";

interface CommentSectionProps {
  activityEntryId: string;
  comments: Comment[];  // Comments now come from parent
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>; // Setter from parent
  hasImage?: boolean;
  fullWidth?: boolean;
  showAllComments?: boolean; // External control for expanded state
  onToggleShowAll?: (shown: boolean) => void; // Callback when toggling
}

const getFormattedDate = (date: string) => {
  const parsedDate = parseISO(date);
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
  setComments,
  hasImage = false,
  fullWidth = false,
  showAllComments: externalShowAllState,
  onToggleShowAll,
}) => {
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const { useCurrentUserDataQuery } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const api = useApiWithAuth();
  const { effectiveTheme } = useTheme();
  const variants = getThemeVariants(effectiveTheme);
  const router = useRouter();
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
    
    setIsSubmitting(true);
    
    try {
      const response = await api.post(`/activity-entries/${activityEntryId}/comments`, {
        text: newComment.trim()
      });
      
      // Add the new comment to the list
      setComments(currentComments => [...currentComments, response.data]);
      setNewComment("");
      
      // Automatically expand comments when posting
      if (!showAllComments && !externalShowAllState) {
        setShowAllComments(true);
        if (onToggleShowAll) onToggleShowAll(true);
      }
    } catch (error) {
      console.error("Error submitting comment:", error);
      toast.error("Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await api.delete(`/activity-entries/${activityEntryId}/comments/${commentId}`);
      
      // Remove the comment from the list
      setComments(currentComments => 
        currentComments.filter(comment => comment.id !== commentId)
      );
      
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
    router.push(`/profile/${username}`);
  };

  const commentBg = hasImage ? variants.card.glassBg : "bg-gray-50";
  const visibleComments = getVisibleComments();
  const hasHiddenComments = comments.length > 2 && !showAllComments;

  if (comments.length === 0 && !userData) {
    return null;
  }

  return (
    <div className={`${fullWidth ? 'w-full' : ''}`}>
      {/* Comments section */}
      {comments.length > 0 && (
        <div className="space-y-2 mb-2">
          {hasHiddenComments && (
            <button 
              onClick={handleToggleShowAll}
              className={`w-full text-center py-2 ${commentBg} rounded-lg text-sm text-gray-500 flex items-center justify-center gap-1 border border-white/20 shadow-sm`}
            >
              Show all {comments.length} comments <ChevronDown className="h-4 w-4" />
            </button>
          )}
          
          {showAllComments && comments.length > 2 && (
            <button 
              onClick={handleToggleShowAll}
              className={`w-full text-center py-2 ${commentBg} rounded-lg text-sm text-gray-500 flex items-center justify-center gap-1 border border-white/20 shadow-sm`}
            >
              Hide comments <ChevronUp className="h-4 w-4" />
            </button>
          )}

          {visibleComments.map((comment) => (
            <div 
              key={comment.id} 
              className={`${commentBg} px-3 py-2 rounded-lg border border-white/20 shadow-sm backdrop-blur-lg`}
            >
              <div className="flex items-start gap-2">
                <Avatar 
                  className="w-6 h-6 mt-1 cursor-pointer"
                  onClick={() => navigateToProfile(comment.username)}
                >
                  <AvatarImage src={comment.picture} alt={comment.username} />
                  <AvatarFallback>{comment.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span 
                      className="font-medium text-sm hover:underline cursor-pointer"
                      onClick={() => navigateToProfile(comment.username)}
                    >
                      @{comment.username}
                    </span>
                    <span className="text-xs text-gray-400">
                      {getFormattedDate(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm break-words whitespace-pre-wrap">{comment.text}</p>
                </div>
                
                {userData?.user?.id === comment.userId && (
                  <button 
                    onClick={() => handleDeleteComment(comment.id)}
                    className="text-gray-400 hover:text-gray-600"
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
      {userData && (
        <form onSubmit={handleSubmitComment} className="flex gap-2 w-full">
          <div className={`flex items-center gap-2 p-2 w-full ${commentBg} rounded-lg border border-white/20 shadow-sm backdrop-blur-lg`}>
            <Avatar className="w-6 h-6">
              <AvatarImage src={userData.user?.picture} />
              <AvatarFallback>{userData.user?.name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            
            <input
              type="text"
              ref={inputRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-transparent outline-none text-[16px]"
              disabled={isSubmitting}
            />
            
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className={`text-gray-400 ${newComment.trim() ? 'hover:text-blue-500' : ''} disabled:opacity-50`}
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
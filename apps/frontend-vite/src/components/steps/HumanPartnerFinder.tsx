/* eslint-disable react-refresh/only-export-components */
"use client";

import AppleLikePopover from "@/components/AppleLikePopover";
import { CollapsibleSelfUserCard } from "@/components/CollapsibleSelfUserCard";
import { RecommendedUsers } from "@/components/RecommendedUsers";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { withFadeUpAnimation } from "@/contexts/onboarding/lib";
import { useOnboarding } from "@/contexts/onboarding/useOnboarding";
import { usePlans } from "@/contexts/plans";
import { useCurrentUser } from "@/contexts/users";
import { useShareOrCopy } from "@/hooks/useShareOrCopy";
import { AnimatePresence, motion } from "framer-motion";
import {
  PersonStanding,
  Search,
  Send
} from "lucide-react";
import React, { useState } from "react";

const OptionCard = ({
  isSelected,
  onClick,
  icon,
  title,
  description,
}: {
  isSelected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) => {
  return (
    <div
      onClick={onClick}
      className={`w-full p-5 rounded-xl border-2 transition-all duration-200 text-left ${
        isSelected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
            isSelected ? "bg-blue-100" : "bg-gray-100"
          }`}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h3
            className={`text-md font-semibold ${
              isSelected ? "text-blue-900" : "text-gray-900"
            }`}
          >
            {title}
          </h3>
          <p
            className={`text-xs mt-1 ${
              isSelected ? "text-blue-700" : "text-gray-600"
            }`}
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};

// const FriendRequestCard = ({
//   request,
//   user,
//   type,
//   onAccept,
//   onReject,
// }: {
//   request: FriendRequest;
//   user: User | null;
//   type: "sent" | "received";
//   onAccept?: () => void;
//   onReject?: () => void;
// }) => {
//   return (
//     <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
//       <Avatar className="w-10 h-10">
//         <AvatarImage src={user?.picture} alt={user?.name} />
//         <AvatarFallback>{user?.name?.[0] || "U"}</AvatarFallback>
//       </Avatar>

//       <div className="flex-1 min-w-0">
//         <p className="text-sm font-medium text-gray-900 truncate">
//           {user?.name || "Unknown User"}
//         </p>
//         <p className="text-xs text-gray-500 truncate">
//           @{user?.username || "unknown"}
//         </p>

//         {request.message && (
//           <p className="text-xs text-gray-400 truncate mt-2">&quot;{request.message}&quot;</p>
//         )}
//       </div>

//       {type === "sent" && (
//         <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
//           Sent
//         </div>
//       )}

//       {type === "received" && (
//         <div className="flex gap-2">
//           <Button
//             size="sm"
//             variant="outline"
//             className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
//             onClick={onAccept}
//           >
//             <Check className="h-4 w-4" />
//           </Button>
//           <Button
//             size="sm"
//             variant="outline"
//             className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
//             onClick={onReject}
//           >
//             <X className="h-4 w-4" />
//           </Button>
//         </div>
//       )}
//     </div>
//   );
// };

const HumanPartnerFinder = () => {
  const { completeStep, planId } = useOnboarding();
  const { shareOrCopyReferralLink } = useShareOrCopy();
  const [apSearchPopupOpen, setApSearchPopupOpen] = useState(false);
  const [hasShared, setHasShared] = useState(false);
  const [hasOpenedCommunitySearch, setHasOpenedCommunitySearch] = useState(false);
  const [ isContinuing, setIsContinuing]  = useState(false);
  const { isLoadingCurrentUser } = useCurrentUser();
  const { isLoadingPlans } = usePlans();

  const handleContinueToApp = () => {
    setIsContinuing(true)
    completeStep("human-partner-finder", {}, {
      complete: true,
    });
  };

  return (
    <>
      <div className="w-full max-w-lg space-y-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <PersonStanding className="w-20 h-20 text-blue-600" />
            <h2 className="text-2xl mt-2 font-bold tracking-tight text-gray-900">
              Let&apos;s find you a human partner
            </h2>
          </div>
          <p className="text-md text-gray-600">
            How would you like to connect with others?
          </p>
        </div>

        <OptionCard
          isSelected={true}
          onClick={async () => {
            await shareOrCopyReferralLink();
            setHasShared(true);
          }}
          icon={<Send className="w-6 h-6" />}
          title="Invite a friend"
          description="Send your personal link to your friends, family and colleagues"
        />
        <OptionCard
          isSelected={false}
          onClick={() => {
            setApSearchPopupOpen(true);
          }}
          icon={<Search className="w-6 h-6" />}
          title="Find one in our community"
          description="Browse through the pool of people of similar age & goals."
        />

          
        {/* Continue to app button - shows after user has shared or opened community search */}
        <AnimatePresence>
          {(hasShared || hasOpenedCommunitySearch) && (
            <motion.div 
              className="mt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <Button 
                className="w-full bg-black hover:bg-gray-800 text-white py-3 px-6 rounded-lg font-medium"
                onClick={() => handleContinueToApp()}
                loading={isContinuing}
              >
                Continue to app
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AppleLikePopover
        open={apSearchPopupOpen}
        onClose={() => {
          setApSearchPopupOpen(false);
          setHasOpenedCommunitySearch(true);
        }}
      >
        {isLoadingCurrentUser || isLoadingPlans ? (
          <div className="space-y-6 mt-4">
            <div>
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="grid grid-cols-1 justify-items-center">
                <Skeleton className="h-48 w-full max-w-sm rounded-lg" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-48 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            <CollapsibleSelfUserCard />
            <RecommendedUsers selectedPlanId={planId} />
          </div>
        )}
      </AppleLikePopover>
    </>
  );
};

export default withFadeUpAnimation(HumanPartnerFinder);
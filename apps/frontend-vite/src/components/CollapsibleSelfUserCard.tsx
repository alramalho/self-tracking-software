import { useCurrentUser } from "@/contexts/users";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import React, { useState } from "react";

export const CollapsibleSelfUserCard: React.FC = () => {
  const { currentUser } = useCurrentUser();
  const [isProfileExpanded, setIsProfileExpanded] = useState(true);

  if (!currentUser) {
    return null;
  }

  return (
    <div>
      <button
        onClick={() => setIsProfileExpanded(!isProfileExpanded)}
        className="flex items-center gap-2 w-full text-left mb-4 hover:opacity-70 transition-opacity"
      >
        <h2 className="text-lg font-semibold">Your profile</h2>
        {isProfileExpanded ? (
          <ChevronUp size={20} />
        ) : (
          <ChevronDown size={20} />
        )}
      </button>

      <AnimatePresence>
        {isProfileExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="pt-2"
          >
            <div className="grid grid-cols-1 justify-items-center">
              <div className="max-w-sm w-full p-6 bg-white/50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl">
                    {currentUser.picture ? (
                      <img
                        src={currentUser.picture}
                        alt={currentUser.username}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      currentUser.name?.[0] || "U"
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{currentUser.name}</h3>
                    <p className="text-gray-600">@{currentUser.username}</p>
                  </div>
                </div>
                {/* TODO: Add plan info, activities, streaks when UserCard is fully migrated */}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
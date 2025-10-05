import { useCurrentUser } from "@/contexts/users";
import React from "react";

export const CollapsibleSelfUserCard: React.FC = () => {
  const { currentUser } = useCurrentUser();

  if (!currentUser) {
    return null;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Your profile</h2>
      <div className="grid grid-cols-1 justify-items-center">
        <div className="max-w-sm w-full p-6 bg-white/50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl">
              {currentUser.picture ? (
                <img
                  src={currentUser.picture}
                  alt={currentUser.username || ""}
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
        </div>
      </div>

      {/* Divider */}
      <div className="my-8 border-t border-gray-300"></div>
    </div>
  );
};
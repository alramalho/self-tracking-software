"use client";

import { Plus, Pencil } from "lucide-react";
import * as React from "react";
import {  useUserPlan } from "@/contexts/UserPlanContext";
import { getThemeVariants } from "@/utils/theme";
import { useThemeColors } from "@/hooks/useThemeColors";
import RecurrentCheckinPopover from "./RecurrentCheckinPopover";
import { capitalize } from "lodash";

const CheckinButton = ({
  title,
  onClick,
}: {
  title: string;
  onClick: () => void;
}) => {
  return (
    <button
      className={`bg-gray-50 gap-2 rounded-lg text-left flex flex-col w-full items-start p-4 justify-center border-2 border-dashed border-gray-300 text-gray-500`}
      onClick={onClick}
    >
      <span className="text-lg text-gray-400">{title}</span>
      <Plus className="h-8 w-8 mb-2 text-gray-400" />
    </button>
  );
};

const Card = ({
  emoji,
  title,
  content,
  onClick,
}: {
  emoji: string;
  title: string;
  content: React.ReactNode;
  onClick: () => void;
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  return (
    <button
      className={`relative gap-2 rounded-lg text-left flex flex-col w-full items-start p-4 justify-center border-2 ${variants.card.selected.border} ${variants.card.selected.bg} text-gray-500`}
      onClick={onClick}
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-lg text-gray-700">{title}</span>
      {content}
      <Pencil className={`h-4 w-4 ${variants.text} top-3 right-3 absolute`} />
    </button>
  );
};

export default function AISettings() {
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const user = userData?.user;
  const [isRecurrentCheckinOpen, setIsRecurrentCheckinOpen] =
    React.useState(false);
  const [isLongTermCheckinOpen, setIsLongTermCheckinOpen] =
    React.useState(false);

  const formatList = (items: string[]) => {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  };

  return (
    <div className="flex flex-col gap-4 mb-12">
      <h1 className="text-2xl font-bold my-4">AI Settings</h1>
      <div className="flex flex-col flex-nowrap gap-4">
        {user?.daily_checkin_settings != undefined ? (
          <Card
            emoji="☀️"
            title="Recurrent Checkin"
            content={
              <>
                <ul className="list-disc list-inside">
                  <li>{formatList(user.daily_checkin_settings.days)}</li>
                  <li>In the {capitalize(user.daily_checkin_settings.time)}</li>
                </ul>
              </>
            }
            onClick={() => setIsRecurrentCheckinOpen(true)}
          />
        ) : (
          <CheckinButton
            title="Recurrent Checkin"
            onClick={() => setIsRecurrentCheckinOpen(true)}
          />
        )}

        <RecurrentCheckinPopover
          open={isRecurrentCheckinOpen}
          onClose={() => setIsRecurrentCheckinOpen(false)}
        />
      </div>
    </div>
  );
}

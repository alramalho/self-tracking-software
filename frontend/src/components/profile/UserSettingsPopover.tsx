import React from "react";
import { UserProfile } from "@clerk/nextjs";
import { Settings, Brain } from "lucide-react";
import AppleLikePopover from "@/components/AppleLikePopover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import AISettings from "@/components/AISettings";

interface UserSettingsPopoverProps {
  open: boolean;
  onClose: () => void;
  userHasAccessToAi: boolean;
}

const UserSettingsPopover: React.FC<UserSettingsPopoverProps> = ({
  open,
  onClose,
  userHasAccessToAi,
}) => {
  return (
    <AppleLikePopover open={open} onClose={onClose}>
      <div className="max-h-[80vh] overflow-y-auto mt-12 mb-12">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">User & AI Settings</h1>
        </div>
        <Accordion type="single" collapsible>
          <AccordionItem value="user-settings" className="border-none">
            <AccordionTrigger className="py-2 hover:no-underline">
              <div className="flex items-center gap-2">
                <Settings size={20} />
                <span>User Settings</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <UserProfile routing={"hash"} />
            </AccordionContent>
          </AccordionItem>

          {userHasAccessToAi && (
            <AccordionItem value="ai-settings" className="border-none">
              <AccordionTrigger className="py-2 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Brain size={20} />
                  <span>AI Settings</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <AISettings />
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>
    </AppleLikePopover>
  );
};

export default UserSettingsPopover; 
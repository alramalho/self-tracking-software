import React from "react";
import { Brain, PlusSquare, Bell, TrendingUpDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const FAQ: React.FC = () => {
  return (
    <div className="pt-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">FAQ</h2>
      </div>
      <Accordion type="single" collapsible className="w-full px-4 py-2">
        <AccordionItem value="ai-coach">
          <AccordionTrigger className="text-xl font-semibold">
            What can the AI coach do?
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-sm text-gray-600 mb-4">
              The AI coach is a personal assistant that helps you stay on track
              with your goals and habits, it does so by:
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Bell className="w-12 h-12 text-blue-300 shrink-0" />
                <div>
                  <h3 className="font-medium">Proactive Reachout</h3>
                  <p className="text-sm text-gray-600">
                    Fully customizable, context-aware notification system that
                    knows about your plan and progress.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Brain className="w-12 h-12 text-blue-300 shrink-0" />
                <div>
                  <h3 className="font-medium">Emotion Analysis</h3>
                  <p className="text-sm text-gray-600">
                    Understands and tracks your emotional patterns through
                    conversations
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <TrendingUpDown className="w-12 h-12 text-blue-300 shrink-0" />
                <div>
                  <h3 className="font-medium">Insight Correlation</h3>
                  <p className="text-sm text-gray-600">
                    Automatic Mood, Energy, and Productivity tracking with
                    correlation with logged activities.
                  </p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

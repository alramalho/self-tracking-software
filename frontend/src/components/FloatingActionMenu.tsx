"use client";

import React, { useState } from "react";
import { HelpCircle, MessageSquarePlus, Bug, X, ChevronUp } from "lucide-react";
import { useUserPlan } from "@/contexts/UserPlanContext";
import FeedbackForm from "./FeedbackForm";
import { toast } from "react-hot-toast";
import { useApiWithAuth } from "@/api";

const FloatingActionMenu = ({ className }: { className?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showBugForm, setShowBugForm] = useState(false);
  const [showHelpForm, setShowHelpForm] = useState(false);
  const [showFeatureForm, setShowFeatureForm] = useState(false);
  const { useCurrentUserDataQuery } = useUserPlan();
  const currentUserDataQuery = useCurrentUserDataQuery();
  const { data: userData } = currentUserDataQuery;
  const email = userData?.user?.email || "";
  const api = useApiWithAuth();

  const reportBug = async (text: string, email: string) => {
    await toast.promise(
      api.post("/report-feedback", {
        email,
        text,
        type: "bug_report",
      }),
      {
        loading: "Sending bug report...",
        success: "Bug report sent successfully!",
        error: "Failed to send bug report",
      }
    );
  };

  const getHelp = async (text: string, email: string) => {
    await toast.promise(
      api.post("/report-feedback", {
        email,
        text,
        type: "help_request",
      }),
      {
        loading: "Sending help request...",
        success: "Help request sent successfully!",
        error: "Failed to send help request",
      }
    );
  };

  const suggestFeature = async (text: string, email: string) => {
    await toast.promise(
      api.post("/report-feedback", {
        email,
        text,
        type: "feature_request",
      }),
      {
        loading: "Sending feature request...",
        success: "Feature request sent successfully!",
        error: "Failed to send feature request",
      }
    );
  };

  const buttonContainerClasses = "flex items-center gap-3 group"
  const buttonClasses =
    "w-12 h-12 bg-white rounded-full flex items-center justify-center " +
    "text-gray-600 shadow-md hover:shadow-lg border border-gray-200 " +
    "transition-all duration-200 hover:scale-105";
  const labelClasses =
    "bg-white py-1 px-3 rounded-full text-sm text-gray-600 " +
    "shadow-md border border-gray-200 absolute right-16 whitespace-nowrap";
  const mainButtonClasses =
    "p-2 bg-white/20 backdrop-blur-sm rounded-lg rounded-br-none rounded-bl-none flex items-center justify-center " +
    "text-gray-600 shadow-md border border-red-200 " +
    "transition-all duration-200 whitespace-nowrap";

  return (
    <>
      <div className={`fixed bottom-[9rem] right-0 ${className} z-[40] flex`}>
        <div className="relative flex w-0">
          <div
            className={`absolute right-full bottom-[-3.5rem] mb-0 mr-[3rem] transition-all duration-200
            ${
              isOpen
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-4 pointer-events-none"
            }`}
          >
            <div className="flex flex-col gap-3 items-end">
              <div className={buttonContainerClasses}>
                <span className={labelClasses}>Get Help</span>
                <button
                  className={buttonClasses}
                  onClick={() => setShowHelpForm(true)}
                >
                  <HelpCircle
                    size={24}
                    className="text-gray-600 hover:text-gray-800"
                  />
                </button>
              </div>

              <div className={buttonContainerClasses}>
                <span className={labelClasses}>Report Bug</span>
                <button
                  className={buttonClasses}
                  onClick={() => setShowBugForm(true)}
                >
                  <Bug size={24} className="text-gray-600 hover:text-gray-800" />
                </button>
              </div>

              <div className={buttonContainerClasses}>
                <span className={labelClasses}>Suggest Feature</span>
                <button
                  className={buttonClasses}
                  onClick={() => setShowFeatureForm(true)}
                >
                  <MessageSquarePlus
                    size={24}
                    className="text-gray-600 hover:text-gray-800"
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="transform-gpu origin-bottom-left -rotate-90 translate-y-[calc(100%+1rem)]">
            <button
              className={mainButtonClasses}
              onClick={() => setIsOpen(!isOpen)}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Feedback</span>
                <ChevronUp
                  size={16}
                  className={`transform transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </button>
          </div>
        </div>
      </div>

      {showBugForm && (
        <FeedbackForm
          title="🐞 Report a Bug"
          email={email}
          placeholder="Please describe the bug you encountered..."
          onSubmit={reportBug}
          onClose={() => setShowBugForm(false)}
        />
      )}

      {showHelpForm && (
        <FeedbackForm
          title="💬 Get Help"
          email={email}
          placeholder="What do you need help with?"
          onSubmit={getHelp}
          onClose={() => setShowHelpForm(false)}
        />
      )}

      {showFeatureForm && (
        <FeedbackForm
          title="✨ Suggest Feature"
          email={email}
          placeholder="What feature would you like to see? Please describe how it would help you."
          onSubmit={suggestFeature}
          onClose={() => setShowFeatureForm(false)}
        />
      )}
    </>
  );
};

export default FloatingActionMenu;

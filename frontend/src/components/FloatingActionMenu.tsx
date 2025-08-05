"use client";

import React, { useState } from "react";
import { HelpCircle, MessageSquarePlus, Bug, X, ChevronUp } from "lucide-react";
import { useUserPlan } from "@/contexts/UserGlobalContext";
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
  const email = userData?.email || "";
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

  const buttonContainerClasses = "flex items-center gap-3 group";
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
      <div className={`fixed bottom-[9.5rem] right-0 ${className} z-[59] flex`}>
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
                <span className={labelClasses}>Join the Community</span>
                <button
                  className={buttonClasses}
                  onClick={() =>
                    window.open("https://discord.gg/xMVb7YmQMQ", "_blank")
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    fill="currentColor"
                    className="bi bi-discord"
                    viewBox="0 0 16 16"
                  >
                    <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612" />
                  </svg>  
                </button>
              </div>
              <div className={buttonContainerClasses}>
                <span className={labelClasses}>Have a question?</span>
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
                  <Bug
                    size={24}
                    className="text-gray-600 hover:text-gray-800"
                  />
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
                <span className="text-sm font-medium">🙏 Feedback</span>
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
          title="💬 Have a question?"
          email={email}
          placeholder="What do you want to know?"
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

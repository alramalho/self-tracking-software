"use client";

import React, { useState } from "react";
import { HelpCircle, MessageSquarePlus, Bug, X } from "lucide-react";
import { useUserPlan } from "@/contexts/UserPlanContext";
import FeedbackForm from "./FeedbackForm";
import { toast } from "react-hot-toast";
import { useApiWithAuth } from "@/api";

const FloatingActionMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showBugForm, setShowBugForm] = useState(false);
  const [showHelpForm, setShowHelpForm] = useState(false);
  const [showFeatureForm, setShowFeatureForm] = useState(false);
  const { useUserDataQuery } = useUserPlan();
  const { data: userData } = useUserDataQuery("me");
  const email = userData?.user?.email || "";
  const api = useApiWithAuth();

  const reportBug = async (text: string) => {
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

  const getHelp = async (text: string) => {
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

  const suggestFeature = async (text: string) => {
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
    "w-14 h-14 bg-white rounded-full flex items-center justify-center " +
    "text-gray-600 shadow-md hover:shadow-lg border border-gray-200 " +
    "transition-all duration-200 hover:scale-105";

  return (
    <>
      <div className={`fixed bottom-20 right-4 z-[20]`}>
        <div
          className={`flex flex-col-reverse gap-3 items-end transition-all duration-200 mb-3
            ${
              isOpen
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4 pointer-events-none"
            }`}
        >
          <div className={`${!isOpen && "hidden"}`}>
            <div>
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

        <div>
          {isOpen && <span className={labelClasses}>Close Menu</span>}
          <button
            className={`${mainButtonClasses} ${
              isOpen ? "bg-gray-50" : "bg-white"
            } pointer-events-auto`}
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? (
              <X size={24} className="text-gray-600 hover:text-gray-800" />
            ) : (
              <MessageSquarePlus
                size={24}
                className="text-gray-600 hover:text-gray-800"
              />
            )}
          </button>
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

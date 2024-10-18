"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import ActivitySelector from "@/components/ActivitySelector";
import ActivityPhotoUploader from "@/components/ActivityPhotoUploader";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { useApiWithAuth } from "@/api";
import { useNotifications } from "@/hooks/useNotifications";
import { Loader2, X } from "lucide-react";

const LogPage: React.FC = () => {
  const router = useRouter();
  const { userData, loading, error } = useUserPlan();
  const activities = userData["me"]?.activities || [];
  const [selectedActivity, setSelectedActivity] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [quantity, setQuantity] = useState<number>(0);
  const [measureType, setMeasureType] = useState<string>("");
  const [showPhotoUploader, setShowPhotoUploader] = useState(false);
  const [loggedActivityEntry, setLoggedActivityEntry] = useState<any>(null);
  const api = useApiWithAuth();
  const { addToNotificationCount } = useNotifications();
  const [showBanner, setShowBanner] = useState(true);

  const handleSelectActivity = (activityId: string) => {
    setSelectedActivity(activityId);
    const activity = activities.find((a) => a.id === activityId);
    setMeasureType(activity?.measure || "");
    setQuantity(0); // Reset quantity when changing activity
  };

  const handleSelectDate = (date: Date | undefined) => {
    if (date && date <= new Date()) {
      const utcDate = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
      );
      setSelectedDate(utcDate);
    }
  };

  const handleQuantityChange = (amount: number) => {
    setQuantity(Math.max(0, quantity + amount));
  };

  const handleQuickSelect = (value: number) => {
    setQuantity(value);
  };

  const logActivity = async (
    activityId: string,
    date: Date,
    quantity: number
  ) => {
    try {
      const response = await api.post("/api/log-activity", {
        activity_id: activityId,
        iso_date_string: date.toISOString(),
        quantity: quantity,
      });

      toast.success("Activity logged successfully!");
      addToNotificationCount(1);
      return response.data;
    } catch (error) {
      console.error("Error logging activity:", error);
      toast.error("Failed to log activity. Please try again.");
      return null;
    }
  };

  const handleLogActivity = async () => {
    if (!selectedActivity || !selectedDate) {
      toast.error("Please select an activity and date.");
      return;
    }

    const loggedEntry = await logActivity(
      selectedActivity,
      selectedDate,
      quantity
    );

    if (loggedEntry) {
      setLoggedActivityEntry(loggedEntry);
      setShowPhotoUploader(true);
    }
  };

  const handlePhotoUploaded = () => {
    setShowPhotoUploader(false);
    setLoggedActivityEntry(null);
    // Reset form
    setSelectedActivity("");
    setSelectedDate(new Date());
    setQuantity(0);
    setMeasureType("");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="mt-2">Loading Activities</p>
      </div>
    );
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 mb-16 relative">
      {showBanner && (
        <div
          className="fixed top-0 left-0 right-0 bg-gradient-to-r from-purple-500 to-blue-500 text-white p-4 text-center z-50 cursor-pointer"
          onClick={() => router.push("/ai")}
        >
          <p className="font-semibold">
            Log everything at once by talking to our AI coach 💬
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowBanner(false);
            }}
            className="absolute top-1 right-2 text-white"
          >
            <X size={24} />
          </button>
        </div>
      )}
      <h1 className="text-2xl font-bold mb-6 mt-16">Log Activity</h1>
      <ActivitySelector
        activities={activities}
        selectedActivity={selectedActivity}
        onSelectActivity={(aId) => {
          handleSelectActivity(aId);
          // scroll to quantity
          const quantity = document.getElementById("quantity");
          if (quantity) {
            quantity.scrollIntoView({ behavior: "smooth" });
          }
        }}
      />
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Select Date</h2>
          <Calendar
            id="calendar"
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              handleSelectDate(date);
            }}
            className="rounded-md border"
            disableFutureDates={true}
          />
        </div>
        {selectedActivity && (
          <div id="quantity">
            <h2 className="text-xl font-semibold mb-2">{measureType}</h2>
            <div className="flex items-center justify-center space-x-4">
              <Button
                onClick={() => handleQuantityChange(-1)}
                variant="outline"
                size="icon"
              >
                -
              </Button>
              <span className="text-2xl font-bold">{quantity}</span>
              <Button
                onClick={() => handleQuantityChange(1)}
                variant="outline"
                size="icon"
              >
                +
              </Button>
            </div>
            <div className="mt-4 flex justify-center space-x-2">
              {[10, 30, 45, 60, 90].map((value) => (
                <Button
                  key={value}
                  onClick={() => handleQuickSelect(value)}
                  variant="secondary"
                  size="sm"
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="mt-8">
        <div className="fixed bottom-0 left-0 right-0 p-4 pb-20 bg-white border-t">
          <Button
            onClick={handleLogActivity}
            className="w-full bg-black text-white"
            disabled={!selectedActivity || !selectedDate || quantity === 0}
          >
            Log Activity
          </Button>
        </div>
      </div>
      {showPhotoUploader && loggedActivityEntry && (
        <ActivityPhotoUploader
          activityEntry={loggedActivityEntry}
          onClose={() => setShowPhotoUploader(false)}
          onPhotoUploaded={handlePhotoUploaded}
        />
      )}
      <BottomNav />
    </div>
  );
};

export default LogPage;

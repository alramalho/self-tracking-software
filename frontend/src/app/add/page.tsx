"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import ActivitySelector from "@/components/ActivitySelector";
import ActivityPhotoUploader from "@/components/ActivityPhotoUploader";
import { Activity, useUserPlan } from "@/contexts/UserPlanContext";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { useApiWithAuth } from "@/api";
import { useNotifications } from "@/hooks/useNotifications";
import { Loader2, X } from "lucide-react";

const LogPage: React.FC = () => {
  const { useUserDataQuery } = useUserPlan();
  const userDataQuery = useUserDataQuery("me");
  const userData = userDataQuery.data;
  const activities = userData?.activities || [];
  const [selectedActivity, setSelectedActivity] = useState<
    Activity | undefined
  >(undefined);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [quantity, setQuantity] = useState<number>(0);
  const [measureType, setMeasureType] = useState<string>("");
  const [showPhotoUploader, setShowPhotoUploader] = useState(false);
  const searchParams = useSearchParams();
  const shouldOpenAddNewActivityEditor = searchParams.get("openAdd");

  const handleSelectActivity = (activity: Activity) => {
    setSelectedActivity(activity);
    setMeasureType(activity.measure || "");
    setQuantity(0); // Reset quantity when changing activity
  };

  const handleSelectDate = (date: Date | undefined) => {
    if (date && date <= new Date()) {
      const utcDate = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
      );
      setSelectedDate(utcDate);
    }
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const handleQuantityChange = (amount: number) => {
    setQuantity(Math.max(0, quantity + amount));
  };

  const handleQuickSelect = (value: number) => {
    setQuantity(value);
  };

  const handleLogActivity = () => {
    if (!selectedActivity || !selectedDate) {
      toast.error("Please select an activity and date.");
      return;
    }

    setShowPhotoUploader(true);
  };

  const handleActivityLogged = () => {
    setShowPhotoUploader(false);
    // Reset form
    setSelectedActivity(undefined);
    setSelectedDate(new Date());
    setQuantity(0);
    setMeasureType("");
  };

  if (userDataQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="mt-2">Loading Activities</p>
      </div>
    );
  }

  if (userDataQuery.isError) {
    return <div>Error: {userDataQuery.error.message}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 mb-16 relative">
      <h1 className="text-2xl font-bold mb-6">Log Activity</h1>
      <ActivitySelector
        activities={activities}
        selectedActivity={selectedActivity}
        shouldOpenAddNewActivityEditor={shouldOpenAddNewActivityEditor === "true"}
        onSelectActivity={(a) => {
          handleSelectActivity(a);
          // scroll to quantity
          window.scrollTo({
            top: document.body.scrollHeight,
            behavior: "smooth",
          });
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
                className="bg-white"
              >
                -
              </Button>
              <span className="text-2xl font-bold">{quantity}</span>
              <Button
                onClick={() => handleQuantityChange(1)}
                variant="outline"
                size="icon"
                className="bg-white"
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
                  className="bg-white"
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
        <div className="fixed bottom-0 left-0 right-0 p-3 pb-[5.4rem] bg-white border-t-2 z-[45]">
          <Button
            onClick={handleLogActivity}
            className="w-full bg-black text-white h-10"
            disabled={!selectedActivity || !selectedDate || quantity === 0}
          >
            Log Activity
          </Button>
        </div>
      </div>
      <ActivityPhotoUploader
        open={showPhotoUploader}
        activityData={{
          activityId: selectedActivity?.id ?? "",
          date: selectedDate ?? new Date(),
          quantity: quantity,
        }}
        onClose={() => setShowPhotoUploader(false)}
        onSuccess={handleActivityLogged}
      />
    </div>
  );
};

export default LogPage;

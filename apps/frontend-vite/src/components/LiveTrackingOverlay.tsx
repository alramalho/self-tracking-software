import { useActivities } from "@/contexts/activities/useActivities";
import { useLiveTracking } from "@/hooks/useLiveTracking";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Square, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)}km`;
}

export function LiveTrackingOverlay() {
  const {
    isTracking,
    activityId,
    elapsedSeconds,
    distanceMeters,
    hasStaleSession,
    stopTracking,
    discardTracking,
    submitTracking,
  } = useLiveTracking();
  const { activities } = useActivities();

  const [showStopDialog, setShowStopDialog] = useState(false);
  const [showStaleDialog, setShowStaleDialog] = useState(hasStaleSession);
  const [quantity, setQuantity] = useState("");

  const activity = activities.find((a) => a.id === activityId);

  const handleStop = () => {
    stopTracking();
    setShowStopDialog(true);
  };

  const handleSubmit = async () => {
    const qty = parseInt(quantity) || Math.ceil(elapsedSeconds / 60);
    await submitTracking(qty);
    setShowStopDialog(false);
    setQuantity("");
  };

  const handleDiscard = () => {
    discardTracking();
    setShowStopDialog(false);
    setShowStaleDialog(false);
    setQuantity("");
  };

  // Stale session dialog (app was killed mid-tracking)
  if (showStaleDialog && !isTracking && hasStaleSession) {
    return (
      <Dialog open onOpenChange={() => setShowStaleDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resume tracking?</DialogTitle>
            <DialogDescription>
              You have an unfinished tracking session. Would you like to save or
              discard it?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleDiscard}>
              Discard
            </Button>
            <Button
              onClick={() => {
                setShowStaleDialog(false);
                setShowStopDialog(true);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <AnimatePresence>
        {isTracking && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={cn(
              "fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-md",
              "rounded-2xl bg-card border border-border shadow-xl p-4"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {activity && (
                  <span className="text-2xl">{activity.emoji}</span>
                )}
                <div>
                  <p className="text-sm text-muted-foreground font-medium">
                    {activity?.title ?? "Tracking"}
                  </p>
                  <p className="text-3xl font-mono font-bold tabular-nums">
                    {formatElapsed(elapsedSeconds)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {distanceMeters > 0 && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mr-2">
                    <MapPin className="h-3 w-3" />
                    {formatDistance(distanceMeters)}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleDiscard}
                  className="h-10 w-10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={handleStop}
                  className="h-10 w-10"
                >
                  <Square className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stop dialog - enter quantity and save */}
      <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activity?.emoji} Save {activity?.title ?? "Activity"}
            </DialogTitle>
            <DialogDescription>
              Duration: {formatElapsed(elapsedSeconds)}
              {distanceMeters > 10 && ` · ${formatDistance(distanceMeters)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium text-muted-foreground">
              Quantity ({activity?.measure ?? "minutes"})
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={String(Math.ceil(elapsedSeconds / 60))}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-lg"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleDiscard}>
              Discard
            </Button>
            <Button onClick={handleSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

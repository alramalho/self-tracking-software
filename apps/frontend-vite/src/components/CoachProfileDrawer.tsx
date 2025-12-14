import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
} from "@/components/ui/drawer";
import { Check, User, X } from "lucide-react";

interface CoachDetails {
  title: string;
  bio: string;
  focusDescription: string;
  idealPlans: Array<{ emoji: string; title: string }>;
  introVideoUrl?: string;
}

interface HumanCoach {
  id: string;
  ownerId: string;
  type: "HUMAN";
  details: CoachDetails;
  owner: {
    id: string;
    username: string;
    name: string | null;
    picture: string | null;
  };
}

interface CoachProfileDrawerProps {
  coach: HumanCoach | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectCoach: (coachId: string) => void;
}

export function CoachProfileDrawer({
  coach,
  isOpen,
  onClose,
  onSelectCoach,
}: CoachProfileDrawerProps) {
  if (!coach) return null;

  const details = coach.details;

  const handleSelect = () => {
    onSelectCoach(coach.id);
    onClose();
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="relative">
          <DrawerClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </DrawerClose>
        </DrawerHeader>

        <div className="px-6 pb-4 space-y-6">
          {/* Coach Header */}
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={coach.owner.picture || undefined} />
              <AvatarFallback>
                <User className="w-8 h-8" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {coach.owner.name || coach.owner.username}
              </h2>
              <p className="text-muted-foreground">{details.title}</p>
            </div>
          </div>

          {/* Introduction Video */}
          {details.introVideoUrl && (
            <div className="rounded-xl overflow-hidden bg-black">
              <video
                src={details.introVideoUrl}
                controls
                playsInline
                className="w-full max-h-64 object-contain"
              />
            </div>
          )}

          {/* Bio */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              About
            </h3>
            <p className="text-foreground">{details.bio || details.focusDescription}</p>
          </div>

          {/* Focus */}
          {details.bio && details.focusDescription && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Specialization
              </h3>
              <p className="text-foreground">{details.focusDescription}</p>
            </div>
          )}

          {/* Ideal Plans */}
          {details.idealPlans && details.idealPlans.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                I can help you with
              </h3>
              <ul className="space-y-2">
                {details.idealPlans.map((plan, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-3 text-foreground"
                  >
                    <Check className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <span>
                      {plan.emoji} {plan.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DrawerFooter className="pt-0">
          <Button onClick={handleSelect} size="lg" className="w-full">
            Choose {coach.owner.name?.split(" ")[0] || coach.owner.username}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChartBar } from "lucide-react";
import { ExampleCorrelations } from "./ExampleCorrelations";
import AppleLikePopover from "./AppleLikePopover";

interface InsightsBannerProps {
  open: boolean;
  onClose: () => void;
}

export const InsightsBanner: React.FC<InsightsBannerProps> = ({ open, onClose }) => {
  const router = useRouter();

  const handleViewInsights = () => {
    router.push("/insights");
    onClose();
  };

  return (
    <AppleLikePopover open={open} onClose={onClose} className="bg-gray-50">
      <div className="pt-6">
        {/* Welcome text */}
        <div className="text-center mb-8">
          <div className="flex flex-row items-center justify-center gap-5 mb-4">
            <span className="text-[40px] animate-wiggle">👋</span>
            <span className="text-2xl font-bold font-mono">Hey!</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            Discover Your Activity Patterns
          </h2>
          <p className="mt-4 text-gray-600">
            Track how your activities affect your well-being and discover meaningful patterns.
          </p>
        </div>

        <div className="space-y-6">
          <ExampleCorrelations />
          
          <div className="flex justify-end">
            <Button onClick={handleViewInsights} className="w-full">
              View Insights Dashboard
            </Button>
          </div>
        </div>
      </div>
    </AppleLikePopover>
  );
}; 
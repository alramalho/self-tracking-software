import { Button } from "./ui/button";

export function AccountabilityStepCard({
    icon,
    title,
    description,
    buttonText,
    onClick,
    color = "blue",
    secondaryText,
    secondaryOnClick,
  }: {
    icon: React.ReactNode;
    title: string;
    description: string;
    buttonText: string;
    secondaryText?: string;
    secondaryOnClick?: () => void;
    onClick: () => void;
    color?: "blue" | "gradient";
  }) {
    const buttonClasses =
      color === "gradient"
        ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
        : "bg-blue-500 hover:bg-blue-600";
  
    const textClasses =
      color === "gradient" ? "text-purple-500" : "text-blue-500";
  
    const ringClasses =
      color === "gradient"
        ? "ring-2 ring-purple-500/20"
        : "ring-2 ring-blue-500/20";
  
    return (
      <div
        className={`w-full h-full mx-auto bg-white/70 p-6 relative overflow-hidden ${ringClasses} rounded-2xl flex flex-col justify-between`}
      >
        <div>
          <div className="flex flex-row no-wrap gap-2 items-center">
            <div className={`rounded-full ${textClasses} mr-2`}>{icon}</div>
            <h3 className="text-xl font-semibold">{title}</h3>
          </div>
          <div className="mt-6 space-y-3">{description}</div>
          {secondaryOnClick && (
            <Button
              variant="outline"
              onClick={secondaryOnClick}
              className={`w-full mt-6 ${textClasses} hover:opacity-80 rounded-xl`}
            >
              {secondaryText}
            </Button>
          )}
        </div>
        <Button
          onClick={onClick}
          className={`w-full mt-2 ${buttonClasses} text-white rounded-xl`}
        >
          {buttonText}
        </Button>
      </div>
    );
  }
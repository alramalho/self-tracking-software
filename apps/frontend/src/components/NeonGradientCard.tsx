import { cn } from "@/lib/utils";

const NeonCard = ({
  children,
  color,
  className,
}: {
  children: React.ReactNode;
  color: "amber" | "lime" | "none";
  className?: string;
}) => {
  const neonClasses = {
    amber: cn(
      "ring-offset-2 ring-offset-white",
      "ring-amber-400 ring-2",
      "bg-gradient-to-br from-amber-50/80 via-amber-100/60 to-amber-50/80",
      "shadow-lg shadow-amber-200/50"
    ),
    lime: cn(
      "ring-offset-2 ring-offset-white",
      "ring-lime-400 ring-2",
      "bg-gradient-to-br from-lime-50/80 via-lime-100/60 to-green-50/80",
      "shadow-lg shadow-lime-200/50"
    ),
    none: "bg-white/50 backdrop-blur-sm border rounded-2xl overflow-hidden relative",
  };

  const neonClass = neonClasses[color || "none"];

  return (
    <div className={`p-4 rounded-2xl relative ${neonClass} ${className}`}>
      {children}
    </div>
  );
};

export default NeonCard;

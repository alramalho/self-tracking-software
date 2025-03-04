import { PaidPlanType } from "@/hooks/usePaidPlan";

interface PlanBadgeProps {
  planType: PaidPlanType;
  size?: number;
}

export const PlanBadge: React.FC<PlanBadgeProps> = ({ planType, size = 16 }) => {
  if (planType === "free") return null;

  const color = planType === "supporter" ? "#6366f1" : "#3b82f6";

  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      className="bi bi-patch-check-fill" 
      viewBox="0 0 16 16"
    >
      <circle cx="8" cy="8" r="3" fill="white"/>
      <path
        fill={color}
        d="M10.067.87a2.89 2.89 0 0 0-4.134 0l-.622.638-.89-.011a2.89 2.89 0 0 0-2.924 2.924l.01.89-.636.622a2.89 2.89 0 0 0 0 4.134l.637.622-.011.89a2.89 2.89 0 0 0 2.924 2.924l.89-.01.622.636a2.89 2.89 0 0 0 4.134 0l.622-.637.89.011a2.89 2.89 0 0 0 2.924-2.924l-.01-.89.636-.622a2.89 2.89 0 0 0 0-4.134l-.637-.622.011-.89a2.89 2.89 0 0 0-2.924-2.924l-.89.01zm.287 5.984-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7 8.793l2.646-2.647a.5.5 0 0 1 .708.708"
      />
    </svg>
  );
}; 
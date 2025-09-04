import React from "react";
import Lottie from "react-lottie";
import { Badge } from "./ui/badge";
import trophyAnimation from "../../public/animations/trophy.lottie.json";

interface TrophyBadgeProps {
  children: React.ReactNode;
  [key: string]: any;
}

const TrophyBadge: React.FC<TrophyBadgeProps> = ({ children, ...props }) => {
  return (
    <div className="relative">
    <Lottie
      options={{
        loop: true,
        autoplay: true,
        animationData: trophyAnimation,
        rendererSettings: {
          preserveAspectRatio: "xMidYMid slice"
        }
      }}
      height={60}
      width={60}
    />
    <Badge className="absolute -bottom-[10px] -right-[10px] text-2xl bg-transparent">
      {children}
    </Badge>
  </div>
  );
};

export default TrophyBadge;

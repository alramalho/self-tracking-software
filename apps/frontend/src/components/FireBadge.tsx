import React from "react";
import Lottie from "react-lottie";
import { Badge } from "./ui/badge";
import fireAnimation from "../../public/animations/fire.lottie.json";

interface FireBadgeProps {
  children: React.ReactNode;
  [key: string]: any;
}

const FireBadge: React.FC<FireBadgeProps> = ({ children, ...props }) => {
  return (
    <div className={`relative ${!children && "opacity-40 grayscale"}`} {...props}>
      <Lottie
        options={{
          loop: true,
          autoplay: true,
          animationData: fireAnimation,
          rendererSettings: {
            preserveAspectRatio: "xMidYMid slice"
          }
        }}
        height={60}
        width={60}
      />
      {children && (
        <Badge className="absolute bottom-0 left-1/2 -translate-x-1/2 text-sm bg-black/60">
          {children}
        </Badge>
      )}
    </div>
  );
};

export default FireBadge;

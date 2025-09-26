import { cn } from "@/lib/utils";
import { Badge } from "lucide-react";
import React from "react";
import Lottie from "react-lottie";
import fireAnimation from "../../public/animations/fire.lottie.json";

interface FireBadgeProps {
  children: React.ReactNode;
  [key: string]: any;
}

export const FireAnimation = (props: {
  height: number;
  width: number;
  className?: string;
}) => {
  return (
    <div className={cn(props.className, `w-[${props.width || 60}px] h-[${props.height || 60}px]`)}>
      <Lottie
        options={{
          loop: true,
          autoplay: true,
          animationData: fireAnimation,
          rendererSettings: {
            preserveAspectRatio: "xMidYMid slice",
          },
        }}
        height={props.height || 60}
        width={props.width || 60}
      />
    </div>
  );
};

const FireBadge: React.FC<FireBadgeProps> = ({ children, ...props }) => {
  return (
    <div
      className={`relative ${!children && "opacity-40 grayscale"}`}
      {...props}
    >
      <FireAnimation height={props.height || 60} width={props.width || 60} />
      {children && (
        <Badge className="absolute bottom-0 left-1/2 -translate-x-1/2 text-sm bg-black/60">
          {children}
        </Badge>
      )}{" "}
    </div>
  );
};

export default FireBadge;

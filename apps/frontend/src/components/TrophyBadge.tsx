import React from "react";
import { Badge } from "./ui/badge";

interface TrophyBadgeProps {
  children: React.ReactNode;
  [key: string]: any;
}

const TrophyBadge: React.FC<TrophyBadgeProps> = ({ children, ...props }) => {
  return (
    <div className="relative">
    <picture>
      <source
        srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f3c6/512.webp"
        type="image/webp"
      />
      <img
        src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f3c6/512.gif"
        alt="🏆"
        width="60"
        height="60"
      />
    </picture>
    <Badge className="absolute -bottom-[10px] -right-[10px] text-2xl bg-transparent">
      {children}
    </Badge>
  </div>
  );
};

export default TrophyBadge;

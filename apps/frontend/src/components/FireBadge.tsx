import React from "react";
import { Badge } from "./ui/badge";

interface FireBadgeProps {
  children: React.ReactNode;
  [key: string]: any;
}

const FireBadge: React.FC<FireBadgeProps> = ({ children, ...props }) => {
  return (
    <div className={`relative ${!children && "opacity-40 grayscale"}`} {...props}>
      <picture>
        <source
          srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.webp"
          type="image/webp"
        />
        <img
          src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif"
          alt="🔥"
          width="60"
          height="60"
        />
      </picture>
      {children && (
        <Badge className="absolute bottom-0 left-1/2 -translate-x-1/2 text-sm bg-black/60">
          {children}
        </Badge>
      )}
    </div>
  );
};

export default FireBadge;

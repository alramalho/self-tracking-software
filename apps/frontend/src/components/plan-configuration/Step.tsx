import { motion } from "framer-motion";
import React from "react";

interface StepProps {
  stepNumber: number;
  isVisible: boolean;
  children: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement>;
  className?: string;
}

const Step = React.forwardRef<HTMLDivElement, StepProps>(
  ({ stepNumber, isVisible, children, className }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{
          opacity: isVisible ? 1 : 0,
          scale: isVisible ? 1 : 0.95,
          pointerEvents: isVisible ? "auto" : "none",
        }}
        transition={{ duration: 0.3 }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }
);

Step.displayName = "Step";

export default Step; 
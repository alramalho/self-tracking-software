import React from "react";
import { motion } from "framer-motion";

const fadeUpVariants = {
  hidden: {
    opacity: 0,
    y: 10,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.2,
      duration: 0.8,
      ease: "easeOut",
    },
  },
};

const FadeUpWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUpVariants}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
};

export const withFadeUpAnimation = (Component: React.ComponentType) => {
  const WrappedComponent = () => (
    <FadeUpWrapper>
      <Component />
    </FadeUpWrapper>
  );
  WrappedComponent.displayName = `withFadeUpAnimation(${
    Component.displayName || Component.name
  })`;
  return WrappedComponent;
};

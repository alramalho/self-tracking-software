/* eslint-disable react-refresh/only-export-components */
import { motion } from "framer-motion";
import React from "react";

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

export const FadeUpWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUpVariants}
      style={{ width: '100%', height: '100%' }}
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

// /app/components/FloatingPopup.tsx

import React, { useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface FloatingPopupProps {
  message: string;
  onComplete: () => void;
  buttonPosition: { x: number; y: number };
}

const FloatingPopup: React.FC<FloatingPopupProps> = ({ message, onComplete, buttonPosition }) => {
  const controls = useAnimation();

  useEffect(() => {
    controls.start({
      opacity: [0, 1, 1, 0],
      y: [buttonPosition.y, buttonPosition.y - 100, buttonPosition.y - 100, 0],
      x: [buttonPosition.x, buttonPosition.x, buttonPosition.x, '50%'],
      scale: [0.5, 1.1, 1, 1],
      transition: { 
        duration: 0.5 * message.split(' ').length,
        times: [0, 0.1, 0.9, 1],
        ease: "easeInOut"
      }
    }).then(onComplete);
  }, [message, onComplete, controls, buttonPosition]);

  return (
    <motion.div
      initial={{ opacity: 0, y: buttonPosition.y, x: buttonPosition.x, scale: 0.5 }}
      animate={controls}
      className="fixed bg-gray-700 text-white px-4 py-2 rounded-lg shadow-lg z-50"
      style={{ 
        originX: 0,
        originY: 1,
      }}
    >
      {message}
    </motion.div>
  );
};

export default FloatingPopup;
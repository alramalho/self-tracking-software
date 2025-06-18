import React, { forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface QuestionCheckItem {
  icon?: React.ReactNode | string;
  title: string;
  description?: string;
}

export type QuestionsChecks = Record<string, QuestionCheckItem>;

interface QuestionChecksProps {
  questionsChecks: QuestionsChecks;
  checkedItems: Record<string, boolean>;
  questionPrefix?: string;
  onItemClick: () => void;
}

// Helper function to get number emoji based on index
const getNumberEmoji = (number: number): string => {
  const numberEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
  return numberEmojis[number - 1] || `${number}️⃣`;
};

export const QuestionChecks = forwardRef<HTMLDivElement, QuestionChecksProps>(
  ({ questionsChecks, checkedItems, questionPrefix, onItemClick }, ref) => {
    if (!questionsChecks) return null;

    return (
      <div ref={ref} className="space-y-3 mt-12 px-4">
        {questionPrefix && <p className="text-sm text-gray-500 mb-6">{questionPrefix}</p>}
        <div className="space-y-3">
          {Object.entries(questionsChecks).map(([key, item], index) => (
            <AnimatePresence key={key}>
              {checkedItems[key] !== undefined && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{
                    duration: 0.4,
                    delay: index * 1 + 0.5,
                    ease: "easeOut",
                  }}
                  className="group"
                >
                  <div
                    className="flex items-start space-x-4 p-2 rounded-xl bg-white transition-all duration-200 cursor-pointer"
                    onClick={onItemClick}
                  >
                    <div className="relative flex-shrink-0 mt-1">
                      <motion.div
                        className="w-6 h-6 flex items-center justify-center text-lg"
                        initial={false}
                        animate={{
                          scale: checkedItems[key] ? [1, 1.2, 1] : 1,
                        }}
                        transition={{
                          duration: 0.3,
                          ease: "easeOut",
                        }}
                      >
                        <AnimatePresence mode="wait">
                          {checkedItems[key] ? (
                            <motion.span
                              key="checked"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              ✅
                            </motion.span>
                          ) : (
                            <motion.span
                              key="number"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              {item.icon ?? getNumberEmoji(index + 1)}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="space-y-1">
                        <motion.h4
                          className={`text-sm font-semibold transition-colors duration-200 ${
                            checkedItems[key]
                              ? "text-gray-900 dark:text-gray-100"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {item.title}
                        </motion.h4>
                        {item.description && (
                          <motion.p
                            className={`text-xs transition-colors duration-200 leading-relaxed ${
                              checkedItems[key]
                                ? "text-gray-600 dark:text-gray-400"
                                : "text-gray-500 dark:text-gray-500"
                            }`}
                          >
                            {item.description}
                          </motion.p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          ))}
        </div>
      </div>
    );
  }
);

QuestionChecks.displayName = "QuestionChecks";

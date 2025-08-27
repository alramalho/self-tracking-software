"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmotionPie } from "./EmotionPie";
import { Button } from "./ui/button";
import { Lock, ChevronDown } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export function DemoEmotionViewer() {
  const [isOpen, setIsOpen] = useState(false);

  // Mock data for the emotion distribution
  const mockChartData = [
    { category: "Optimism", percentage: 35 },
    { category: "Love", percentage: 25 },
    { category: "Awe", percentage: 20 },
    { category: "Remorse", percentage: 10 },
    { category: "Submission", percentage: 10 },
  ];

  return (
    <div className="w-full">
      <motion.div
        className="w-full cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <motion.div 
          className="px-6 py-4 bg-gradient-to-br from-blue-50/80 to-white rounded-lg border border-gray-200 shadow-sm flex justify-between items-start"
          whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.9)" }}
        >
          <div className="flex flex-col items-start">
            <h3 className="text-xl font-bold tracking-tight">Emotional Profile Preview ⭐️</h3>
            <p className="text-xs font-medium text-muted-foreground">
              Get insights into your emotional patterns through voice messages
            </p>
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ 
              opacity: 1, 
              height: "auto",
              transition: {
                height: { duration: 0.3 },
                opacity: { duration: 0.3, delay: 0.1 }
              }
            }}
            exit={{ 
              opacity: 0, 
              height: 0,
              transition: {
                height: { duration: 0.2 },
                opacity: { duration: 0.2 }
              }
            }}
            className="overflow-hidden"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="bg-gradient-to-br from-blue-50/80 to-white px-6 py-4 mt-2 rounded-lg border border-gray-200 shadow-sm relative"
            >
              <div className="flex flex-col gap-4">
                <Card className="flex-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">
                      Sample Emotion Distribution
                    </CardTitle>
                    <CardDescription>
                      Example of how your emotions could be distributed
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EmotionPie data={mockChartData} numberOfMessages={42} />
                  </CardContent>
                </Card>

                <div className="absolute inset-0 bg-gradient-to-b from-transparent from-0% via-white/90 via-75% to-white to-100% z-10" />
                <div className="flex justify-center mt-4 z-20 relative">
                  <Link href="/ai">
                    <Button className="flex gap-2">
                      <Lock className="h-4 w-4" />
                      Get Access
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

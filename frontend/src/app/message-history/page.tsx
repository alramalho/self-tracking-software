"use client";

import { useUserPlan } from "@/contexts/UserPlanContext";
import { MessageHistoryViewer } from "@/components/MessageHistoryViewer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function MessageHistoryPage() {
  const { messagesData } = useUserPlan();
  const messages = messagesData.data?.messages || [];
  const router = useRouter();

  if (messagesData.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-16 space-y-4">
      <div className="flex h-full flex-col max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Message History</h1>

        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No messages in history
          </div>
        ) : (
          <MessageHistoryViewer messages={messages} />
        )}

        <Button variant="ghost" className="mb-4" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to chat
        </Button>
      </div>
    </div>
  );
}

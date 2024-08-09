import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "../components/BottomNav";
import { Toaster } from "react-hot-toast";
import { NotificationsProvider } from "@/hooks/useNotifications";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tracking Software",
  description: "Know yourself better",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <NotificationsProvider>
          <main className="pb-16">{children}</main>
          <Toaster
            position="top-center"
            containerStyle={{
              bottom: "5rem", // Adjust this value based on your BottomNav height
            }}
          />
          <BottomNav />
        </NotificationsProvider>
      </body>
    </html>
  );
}
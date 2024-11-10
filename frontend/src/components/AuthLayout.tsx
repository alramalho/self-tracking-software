import React from "react";
import Image from "next/image";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <span className="text-[120px]">🎯</span>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Welcome to your <span className="text-blue-500 break-normal text-nowrap">tracking.so<span className="text-blue-300">ftware</span></span>
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Track your journey with friends
          </p>
        </div>
        {children}
      </div>
    </div>
  );
};

export default AuthLayout; 
import React from "react";
import Image from "next/image";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div
      className="relative w-full min-h-dvh bg-gray-50/80 
      [background-image:linear-gradient(#eaedf1_1px,transparent_1px),linear-gradient(to_right,#eef0f3_1px,#f8fafc_1px)] 
      [background-size:20px_20px] flex flex-col items-center justify-center p-4"
    >
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto w-fit -translate-x-[2px]">
            <picture>
              <source
                srcSet="https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.webp"
                type="image/webp"
              />
              <img
                src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif"
                alt="🔥"
                width="150"
                height="150"
              />
            </picture>
          </div>
          <h2 className="mt-10 text-3xl font-bold tracking-tight text-gray-900">
            Welcome to your{" "}
            <span className="text-blue-500 break-normal text-nowrap">
              tracking.so<span className="text-blue-300">ftware</span>
            </span>
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Track your journey with friends
          </p>
        </div>
        <div className="mx-auto w-fit">{children}</div>
      </div>
    </div>
  );
};

export default AuthLayout;

import React from "react";
import Lottie from "react-lottie";
import fireAnimation from "../../public/animations/fire.lottie.json";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="relative w-full min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/80">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-6 sm:py-10">
        <div className="text-center">
          <div className="mx-auto w-fit -translate-x-[2px]">
            <Lottie
              options={{
                loop: true,
                autoplay: true,
                animationData: fireAnimation,
                rendererSettings: {
                  preserveAspectRatio: "xMidYMid slice"
                }
              }}
              height={96}
              width={96}
            />
          </div>
          <h2 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Welcome to your{" "}
            <span className="text-blue-500 break-normal text-nowrap">
              tracking.so<span className="text-blue-300">ftware</span>
            </span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Track your journey with friends
          </p>
        </div>
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
};

export default AuthLayout;

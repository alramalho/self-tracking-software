import React from "react";
import Lottie from "react-lottie";
import fireAnimation from "../../public/animations/fire.lottie.json";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div
    // [background-image:linear-gradient(#eaedf1_1px,transparent_1px),linear-gradient(to_right,#eef0f3_1px,#f8fafc_1px)]
    // [background-size:20px_20px] flex flex-col items-center justify-center p-4
      className={`relative w-full mx-auto min-h-dvh bg-muted/80 flex justify-center items-center`}
    >
      <div className="w-full max-w-md space-y-8 flex flex-col items-center justify-center">
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
              height={150}
              width={150}
            />
          </div>
          <h2 className="mt-10 text-3xl font-bold tracking-tight text-foreground">
            Welcome to your{" "}
            <span className="text-blue-500 break-normal text-nowrap">
              tracking.so<span className="text-blue-300">ftware</span>
            </span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Track your journey with friends
          </p>
        </div>
        <div className="mx-auto w-fit">{children}</div>
      </div>
    </div>
  );
};

export default AuthLayout;
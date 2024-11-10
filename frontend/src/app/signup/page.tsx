"use client";

import { SignUp } from "@clerk/clerk-react";
import { useSearchParams } from "next/dist/client/components/navigation";
import React from "react";
import AuthLayout from "@/components/AuthLayout";

const SignUpPage: React.FC = () => {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");

  return (
    <AuthLayout>
      <SignUp 
        signInUrl={redirectUrl ? `/signin?redirect_url=${redirectUrl}` : "/signin"} 
        forceRedirectUrl={redirectUrl}
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "shadow-none",
          }
        }}
      />
    </AuthLayout>
  );
};

export default SignUpPage;

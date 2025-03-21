"use client";

import { SignIn } from "@clerk/clerk-react";
import React from "react";
import AuthLayout from "@/components/AuthLayout";
import { useSearchParams } from "next/navigation";

const SignInPage: React.FC = () => {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");

  return (
    <AuthLayout>
      <SignIn 
        signUpUrl={redirectUrl ? `/signup?redirect_url=${redirectUrl}` : "/signup"} 
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

export default SignInPage;

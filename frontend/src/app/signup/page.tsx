"use client";

import { SignUp } from "@clerk/clerk-react";
import { useSearchParams } from "next/navigation";
import React from "react";
import AuthLayout from "@/components/AuthLayout";

const SignUpPage: React.FC = () => {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");
  const referrer = searchParams.get("referrer");
  const redirectUrlWithReferrer = redirectUrl && referrer 
    ? `${redirectUrl}?referrer=${referrer}`
    : redirectUrl;

  return (
    <AuthLayout>
      <SignUp 
        signInUrl={redirectUrlWithReferrer ? `/signin?redirect_url=${redirectUrlWithReferrer}` : "/signin"} 
        forceRedirectUrl={redirectUrlWithReferrer || "/"}
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

"use client";

import { SignIn } from "@clerk/clerk-react";
import { useSearchParams } from "next/dist/client/components/navigation";
import React from "react";


const SignUpPage: React.FC = () => {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
      <SignIn signUpUrl={redirectUrl ? "/signup?redirect_url=" + redirectUrl : "/signup"} forceRedirectUrl={redirectUrl} />
    </div>
  );
};

export default SignUpPage;

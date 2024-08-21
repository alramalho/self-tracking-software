"use client";

import { SignIn } from "@clerk/clerk-react";
import React from "react";


const SignUpPage: React.FC = () => {
  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
      <SignIn signUpUrl="/sign-up" />
    </div>
  );
};

export default SignUpPage;

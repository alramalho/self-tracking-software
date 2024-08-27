"use client";

import { SignUp } from "@clerk/clerk-react";
import React from "react";


const SignUpPage: React.FC = () => {
  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
      <SignUp signInUrl="/signin" />
    </div>
  );
};

export default SignUpPage;

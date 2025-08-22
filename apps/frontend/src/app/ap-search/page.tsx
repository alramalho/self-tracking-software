"use client";

import React, { useState } from "react";
import { ApSearchComponent } from "@/components/ApSearch";

const ApSearchPage: React.FC = () => {
  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <ApSearchComponent />
    </div>
  );
};

export default ApSearchPage;

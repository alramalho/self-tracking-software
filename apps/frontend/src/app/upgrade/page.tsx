"use client";

import React from "react";
import { UpgradePopover } from "@/components/UpgradePopover";
import { useRouter } from "next/navigation";

const UpgradePage: React.FC = () => {
  const router = useRouter();
  return (
    <UpgradePopover
      open={true}
      onClose={() => {
        router.push("/");
      }}
    />
  );
};

export default UpgradePage;

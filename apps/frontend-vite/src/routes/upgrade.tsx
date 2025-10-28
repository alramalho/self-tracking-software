import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/upgrade")({
  component: RouteComponent,
});

function RouteComponent() {
  const { setShowUpgradePopover } = useUpgrade();
  const navigate = useNavigate();
  useEffect(() => {
    setShowUpgradePopover(true);
    navigate({ to: "/", replace: true });
  }, []);
  return <></>;
}

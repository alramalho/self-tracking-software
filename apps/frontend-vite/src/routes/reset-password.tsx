import AuthLayout from "@/components/AuthLayout";
import { SignIn } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  return (
    <AuthLayout>
      <SignIn routing="hash" fallbackRedirectUrl="/" />
    </AuthLayout>
  );
}

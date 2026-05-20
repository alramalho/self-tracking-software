import { useCurrentUser } from "@/contexts/users";
import { useNavigate } from "@tanstack/react-router";

export const GreetingCard = () => {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();

  const firstName =
    currentUser?.name?.split(" ")[0] || currentUser?.username || "there";

  return (
    <div
      onClick={() => navigate({ to: "/message-ai" })}
      className="aspect-square flex flex-col justify-end p-4 cursor-pointer active:scale-[0.97] transition-all duration-200"
    >
      <p className="text-lg font-semibold text-foreground">
        Hey, {firstName}
      </p>
      <p className="text-sm text-muted-foreground">how's it going?</p>
    </div>
  );
};

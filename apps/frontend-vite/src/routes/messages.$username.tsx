import { createFileRoute } from "@tanstack/react-router";
import { MessagesPage } from "./messages.index";

export const Route = createFileRoute("/messages/$username")({
  component: MessagesWithUserPage,
});

function MessagesWithUserPage() {
  const { username } = Route.useParams();
  return <MessagesPage targetUsername={username} />;
}

export default MessagesWithUserPage;

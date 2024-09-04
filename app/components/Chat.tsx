import { useMessageHistory } from '../hooks/useMessageHistory';

function Chat() {
  const [messages, setMessages] = useMessageHistory();

  // Use messages and setMessages in your component
  // ...

  return (
    // Your chat UI
  );
}
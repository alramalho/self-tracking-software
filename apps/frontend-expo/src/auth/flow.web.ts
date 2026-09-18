import { useAuth } from "@clerk/expo";
export function useAuthFlow() {
  const auth = useAuth();
  return { isLoaded: auth.isLoaded, isAuthFlowComplete: !!auth.isSignedIn };
}

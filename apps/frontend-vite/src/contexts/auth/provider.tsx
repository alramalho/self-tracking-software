import { authService } from "@/services/auth";
import { type Session, type User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";

interface AuthContextType {
  supabaseUser: User | null;
  session: Session | null;
  isLoading: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabaseUser, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await authService.initializeSocialLogin();
        const { data } = await authService.getCurrentUser();
        setUser(data.user);
        setSession(data.session);
      } catch (error) {
        console.error("Failed to initialize auth:", error);
      } finally {
        setIsLoading(false);
        setIsLoaded(true);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = authService.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event, session);
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      setIsLoaded(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      await authService.signInWithGoogle();
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithApple = async () => {
    setIsLoading(true);
    try {
      await authService.signInWithApple();
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await authService.signOut();
    } finally {
      setIsLoading(false);
    }
  };

  const getToken = async () => {
    return session?.access_token ?? null;
  };

  return (
    <AuthContext.Provider
      value={{
        supabaseUser,
        session,
        isLoading,
        isLoaded,
        isSignedIn: !!supabaseUser,
        signInWithGoogle,
        signInWithApple,
        signOut,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export const useSession = useAuth;
export const useSupabaseUser = () => {
  const { supabaseUser, isLoading, isLoaded, isSignedIn } = useAuth();
  return { supabaseUser, isLoading, isLoaded, isSignedIn };
};

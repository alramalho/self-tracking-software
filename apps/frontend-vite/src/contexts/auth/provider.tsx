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
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
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
      console.log("🔐 Auth state changed:", event);
      console.log("🔐 Session:", session);
      console.log("🔐 User:", session?.user);

      // Log OAuth errors from URL
      const params = new URLSearchParams(window.location.search);
      if (params.has('error')) {
        console.error("🔴 OAuth Error:", {
          error: params.get('error'),
          error_code: params.get('error_code'),
          error_description: params.get('error_description'),
        });
      }

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

  const signInWithEmail = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await authService.signInWithEmail(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await authService.signUpWithEmail(email, password);
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
        signInWithEmail,
        signUpWithEmail,
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

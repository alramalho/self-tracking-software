import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { supabase } from "./supabase";

export class AuthService {
  private isNativePlatform() {
    return Capacitor.isNativePlatform();
  }

  async initializeSocialLogin() {
    if (this.isNativePlatform()) {
      await SocialLogin.initialize({
        google: {
          webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID,
          iOSClientId: import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID,
        },
      });
    }
  }

  async signInWithGoogle() {
    try {
      if (this.isNativePlatform()) {
        // Native: Use Capacitor Social Login
        const result = await SocialLogin.login({
          provider: "google",
          options: {
            scopes: ["email", "profile"],
          },
        });

        // Look for ID token in different possible locations
        const idToken =
          // @ts-expect-error lol
          result.result?.idToken?.token ||
          // @ts-expect-error lol
          result.result?.idToken ||
          // @ts-expect-error lol
          result.result?.accessToken?.idToken;
        // @ts-expect-error lol
        const accessToken = result.result?.accessToken?.token;
        // @ts-expect-error lol
        const serverAuthCode = result.result?.serverAuthCode;

        // Send idToken to backend for verification and session creation
        const backendUrl =
          import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
        const response = await fetch(`${backendUrl}/auth/ios-google-signin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ idToken }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("🔴 Backend auth error:", errorData);
          throw new Error(errorData.error || "Authentication failed");
        }

        const { verificationUrl } = await response.json();

        // Use the verification URL to create a Supabase session
        const url = new URL(verificationUrl);
        const token = url.searchParams.get("token");
        const type = url.searchParams.get("type");

        if (!token || type !== "magiclink") {
          throw new Error("Invalid verification URL");
        }

        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: "magiclink",
        });

        if (error) {
          console.error("🔴 Supabase error:", error);
          throw error;
        }

        return data;
      } else {
        // Web: Use Supabase's built-in OAuth
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin,
            scopes: "email profile",
          },
        });

        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error("Google sign-in error:", error);
      throw error;
    }
  }
  async signOut() {
    await supabase.auth.signOut();

    if (this.isNativePlatform()) {
      await SocialLogin.logout({
        provider: "google",
      });
    }
  }

  async getCurrentUser() {
    const [userResult, sessionResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);

    return {
      data: {
        user: userResult.data.user,
        session: sessionResult.data.session,
      },
      error: userResult.error || sessionResult.error,
    };
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

export const authService = new AuthService();

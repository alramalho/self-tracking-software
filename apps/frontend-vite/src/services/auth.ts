import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { supabase } from "./supabase";

export class AuthService {
  private isNativePlatform() {
    return Capacitor.isNativePlatform();
  }

  async initializeSocialLogin() {
    if (this.isNativePlatform()) {
      // Debug: Log all available env vars
      console.log("🔍 DEBUG: All import.meta.env:", import.meta.env);
      console.log(
        "🔍 DEBUG: VITE_GOOGLE_WEB_CLIENT_ID:",
        import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID
      );
      console.log(
        "🔍 DEBUG: VITE_GOOGLE_IOS_CLIENT_ID:",
        import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID
      );
      console.log(
        "🔍 DEBUG: VITE_SUPABASE_API_URL:",
        import.meta.env.VITE_SUPABASE_API_URL
      );
      console.log(
        "🔍 DEBUG: VITE_SUPABASE_ANON_KEY:",
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );

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

        console.log(
          "🔍 DEBUG: SocialLogin result:",
          JSON.stringify(result, null, 2)
        );

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

        console.log("🔍 DEBUG: idToken:", idToken);
        console.log("🔍 DEBUG: accessToken:", accessToken);
        console.log("🔍 DEBUG: serverAuthCode:", serverAuthCode);

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken || serverAuthCode,
          // @ts-expect-error lol
          nonce: serverAuthCode ? undefined : result.result?.nonce,
        });

        console.log("🔍 DEBUG: Supabase auth response:", { data, error });

        if (error) throw error;
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

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
          // iOSServerClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID,
        },
        apple: {
          // iOS: No config needed (uses native Sign in with Apple)
          // Android/Web: Need service ID and redirect URL
          // clientId: "so.tracking.app.login",
          // redirectUrl: import.meta.env.VITE_SUPABASE_OAUTH_REDIRECT_URL,
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
          "🔵 Full Google login result:",
          JSON.stringify(result, null, 2)
        );
        console.log("🔵 result.result keys:", Object.keys(result.result || {}));

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

        console.log(
          "🔵 Extracted idToken:",
          idToken ? "✅ Present" : "❌ Missing"
        );
        console.log(
          "🔵 Extracted accessToken:",
          accessToken ? "✅ Present" : "❌ Missing"
        );
        console.log(
          "🔵 Extracted serverAuthCode:",
          serverAuthCode ? "✅ Present" : "❌ Missing"
        );

        // Send idToken to backend for verification and session creation
        const backendUrl =
          import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
        console.log("🔵 VITE_BACKEND_URL env:", import.meta.env.VITE_BACKEND_URL);
        console.log("🔵 Using backendUrl:", backendUrl);
        console.log("🔵 Full endpoint:", `${backendUrl}/auth/ios-google-signin`);
        console.log("🔵 Calling backend...");
        const response = await fetch(`${backendUrl}/auth/ios-google-signin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ idToken }),
        });
        console.log("🔵 Backend response status:", response.status);

        if (!response.ok) {
          const errorData = await response.json();
          console.error("🔴 Backend auth error:", errorData);
          throw new Error(errorData.error || "Authentication failed");
        }

        const responseData = await response.json();
        console.log("🔵 Backend response data:", JSON.stringify(responseData, null, 2));
        const { verificationUrl } = responseData;

        // Use the verification URL to create a Supabase session
        const url = new URL(verificationUrl);
        const token = url.searchParams.get("token");
        const type = url.searchParams.get("type");
        console.log("🔵 Parsed token:", token ? "✅ Present" : "❌ Missing");
        console.log("🔵 Parsed type:", type);

        if (!token || type !== "magiclink") {
          console.error("🔴 Invalid verification URL:", verificationUrl);
          throw new Error("Invalid verification URL");
        }

        console.log("🔵 Calling supabase.auth.verifyOtp...");
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: "magiclink",
        });

        if (error) {
          console.error("🔴 Supabase verifyOtp error:", error);
          throw error;
        }

        console.log("🔵 ✅ Google sign-in complete! Session:", data);
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

  async signInWithApple() {
    try {
      console.log(
        `VITE_SUPABASE_API_URL: ${import.meta.env.VITE_SUPABASE_API_URL}`
      );
      console.log("🍎 Starting Apple sign-in flow...");
      console.log("🍎 Platform:", Capacitor.getPlatform());
      console.log("🍎 Is native:", this.isNativePlatform());

      if (this.isNativePlatform()) {
        // Native: Use Capacitor Social Login
        console.log("🍎 Calling SocialLogin.login with Apple provider...");
        const result = await SocialLogin.login({
          provider: "apple",
          options: {
            scopes: ["email", "name"],
          },
        });

        console.log(
          "🍎 Raw result from SocialLogin:",
          JSON.stringify(result, null, 2)
        );

        // Extract identityToken and user info
        const identityToken = result.result?.idToken;
        // @ts-expect-error Apple may provide user info on first sign-in
        const user = result.result?.user;

        console.log(
          "🍎 Extracted identityToken:",
          identityToken ? "✅ Present" : "❌ Missing"
        );
        console.log(
          "🍎 Extracted user info:",
          user ? JSON.stringify(user, null, 2) : "❌ No user info"
        );

        if (!identityToken) {
          console.error("🔴 No identity token received from Apple");
          console.error("🔴 Full result object:", result);
          throw new Error("No identity token received from Apple");
        }

        // Send identityToken to backend for verification and session creation
        const backendUrl =
          import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
        console.log("🍎 Sending identityToken to backend:", backendUrl);

        const response = await fetch(`${backendUrl}/auth/ios-apple-signin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            identityToken,
            user: user
              ? {
                  firstName: user.givenName,
                  lastName: user.familyName,
                }
              : undefined,
          }),
        });

        console.log("🍎 Backend response status:", response.status);

        if (!response.ok) {
          const errorData = await response.json();
          console.error("🔴 Backend auth error:", errorData);
          throw new Error(errorData.error || "Authentication failed");
        }

        const { verificationUrl } = await response.json();
        console.log(
          "🍎 Received verificationUrl from backend:",
          verificationUrl
        );

        // Use the verification URL to create a Supabase session
        const url = new URL(verificationUrl);
        const token = url.searchParams.get("token");
        const type = url.searchParams.get("type");

        console.log(
          "🍎 Parsed token from URL:",
          token ? "✅ Present" : "❌ Missing"
        );
        console.log("🍎 Parsed type from URL:", type);

        if (!token || type !== "magiclink") {
          console.error("🔴 Invalid verification URL");
          console.error("🔴 Token:", token);
          console.error("🔴 Type:", type);
          throw new Error("Invalid verification URL");
        }

        console.log("🍎 Calling supabase.auth.verifyOtp...");
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: "magiclink",
        });

        if (error) {
          console.error("🔴 Supabase verifyOtp error:", error);
          throw error;
        }

        console.log("🍎 ✅ Apple sign-in successful!");
        console.log("🍎 Session data:", data);
        return data;
      } else {
        // Web: Use Supabase's built-in OAuth (same as Google)
        console.log("🍎 Using Supabase OAuth for web...");
        console.log("🍎 Redirect URL:", window.location.origin);
        console.log("🍎 Current URL:", window.location.href);

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "apple",
          options: {
            redirectTo: window.location.origin,
            scopes: "email name",
          },
        });

        if (error) {
          console.error("🔴 Supabase Apple OAuth error:");
          console.error("🔴 Error message:", error.message);
          console.error("🔴 Error details:", error);
          throw error;
        }

        console.log("🍎 ✅ Web Apple sign-in initiated!");
        console.log("🍎 OAuth response data:", data);
        return data;
      }
    } catch (error) {
      console.error("🔴 Apple sign-in error:", error);
      console.error(
        "🔴 Error stack:",
        error instanceof Error ? error.stack : "No stack trace"
      );
      throw error;
    }
  }

  async signInWithEmail(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Email sign-in error:", error);
      throw error;
    }
  }

  async signUpWithEmail(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Email sign-up error:", error);
      throw error;
    }
  }

  async resetPasswordForEmail(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }

  async updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }

  async signOut() {
    // Clear Supabase session
    await supabase.auth.signOut();

    // if (this.isNativePlatform()) {
    //   // Sign out from both Google and Apple
    //   await Promise.allSettled([
    //     SocialLogin.logout({ provider: "google" }),
    //     SocialLogin.logout({ provider: "apple" }),
    //   ]);
    // }
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

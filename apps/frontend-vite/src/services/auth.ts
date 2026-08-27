import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";

interface NativeSignInResponse {
  ticket: string;
}

export class AuthService {
  private isNativePlatform() {
    return Capacitor.isNativePlatform();
  }

  async initializeSocialLogin() {
    if (!this.isNativePlatform()) return;

    await SocialLogin.initialize({
      google: {
        webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID,
        iOSClientId: import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID,
      },
      apple: {},
    });
  }

  async getGoogleSignInTicket(): Promise<string> {
    const result = await SocialLogin.login({
      provider: "google",
      options: { scopes: ["email", "profile"] },
    });

    const idToken =
      // @ts-expect-error Plugin versions expose the token in different shapes.
      result.result?.idToken?.token ??
      // @ts-expect-error Plugin versions expose the token in different shapes.
      result.result?.idToken ??
      // @ts-expect-error Plugin versions expose the token in different shapes.
      result.result?.accessToken?.idToken;

    if (!idToken) throw new Error("Google did not return an ID token");
    return this.exchangeNativeToken("ios-google-signin", { idToken });
  }

  async getAppleSignInTicket(): Promise<string> {
    const result = await SocialLogin.login({
      provider: "apple",
      options: { scopes: ["email", "name"] },
    });

    const identityToken = result.result?.idToken;
    // @ts-expect-error Apple supplies user details only on first authorization.
    const user = result.result?.user;
    if (!identityToken) throw new Error("Apple did not return an identity token");

    return this.exchangeNativeToken("ios-apple-signin", {
      identityToken,
      user: user
        ? { firstName: user.givenName, lastName: user.familyName }
        : undefined,
    });
  }

  private async exchangeNativeToken(
    endpoint: "ios-google-signin" | "ios-apple-signin",
    body: Record<string, unknown>
  ): Promise<string> {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
    const response = await fetch(`${backendUrl}/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as NativeSignInResponse & { error?: string };
    if (!response.ok || !data.ticket) {
      throw new Error(data.error || "Authentication failed");
    }
    return data.ticket;
  }
}

export const authService = new AuthService();

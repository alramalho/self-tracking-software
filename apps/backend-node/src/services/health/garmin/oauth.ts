import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

import type {
  GarminAccessToken,
  GarminOAuthConfig,
  GarminRequestToken,
} from "./types";

export const GARMIN_REQUEST_TOKEN_URL =
  "https://connectapi.garmin.com/oauth-service/oauth/request_token";
export const GARMIN_AUTHORIZE_URL = "https://connect.garmin.com/oauthConfirm";
export const GARMIN_ACCESS_TOKEN_URL =
  "https://connectapi.garmin.com/oauth-service/oauth/access_token";
export const GARMIN_API_BASE_URL = "https://apis.garmin.com/wellness-api/rest";

const DEFAULT_REDIRECT_URI = "https://api.tracking.so/health/garmin/callback";
const DEFAULT_FRONTEND_URL = "https://app.tracking.so";

export class GarminConfigurationError extends Error {
  constructor() {
    super("Garmin Connect is not configured on the server");
    this.name = "GarminConfigurationError";
  }
}

export class GarminApiError extends Error {
  readonly status: number;
  readonly endpoint?: string;

  constructor(status: number, endpoint?: string) {
    super(
      `Garmin Connect request failed with status ${status}${
        endpoint ? ` for ${endpoint}` : ""
      }`,
    );
    this.name = "GarminApiError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

const percentEncode = (value: string): string =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

const getBaseUrl = (value: URL): string =>
  `${value.protocol}//${value.host}${value.pathname}`;

const getConfigValue = (...names: string[]): string | undefined => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
};

export const getGarminOAuthConfig = (): GarminOAuthConfig | null => {
  const consumerKey = getConfigValue(
    "GARMIN_CONSUMER_KEY",
    "GARMIN_CONNECT_CONSUMER_KEY",
  );
  const consumerSecret = getConfigValue(
    "GARMIN_CONSUMER_SECRET",
    "GARMIN_CONNECT_CONSUMER_SECRET",
  );
  const tokenEncryptionKey = getConfigValue("GARMIN_TOKEN_ENCRYPTION_KEY");

  if (!consumerKey || !consumerSecret || !tokenEncryptionKey) return null;

  return {
    consumerKey,
    consumerSecret,
    tokenEncryptionKey,
    redirectUri: getConfigValue("GARMIN_REDIRECT_URI") || DEFAULT_REDIRECT_URI,
    frontendUrl: getConfigValue("FRONTEND_URL") || DEFAULT_FRONTEND_URL,
    apiBaseUrl: getConfigValue("GARMIN_API_BASE_URL") || GARMIN_API_BASE_URL,
  };
};

export const requireGarminOAuthConfig = (): GarminOAuthConfig => {
  const config = getGarminOAuthConfig();
  if (!config) throw new GarminConfigurationError();
  return config;
};

const signingParameters = (
  url: URL,
  oauthParameters: Record<string, string>,
  extraParameters: Record<string, string> = {},
): Array<[string, string]> => {
  const parameters: Array<[string, string]> = [];
  url.searchParams.forEach((value, key) => parameters.push([key, value]));
  for (const [key, value] of Object.entries(oauthParameters)) {
    parameters.push([key, value]);
  }
  for (const [key, value] of Object.entries(extraParameters)) {
    parameters.push([key, value]);
  }

  return parameters.sort((left, right) => {
    const leftKey = percentEncode(left[0]);
    const rightKey = percentEncode(right[0]);
    if (leftKey !== rightKey) return leftKey < rightKey ? -1 : 1;
    const leftValue = percentEncode(left[1]);
    const rightValue = percentEncode(right[1]);
    return leftValue === rightValue ? 0 : leftValue < rightValue ? -1 : 1;
  });
};

export const createOAuth1AuthorizationHeader = (
  method: string,
  rawUrl: string,
  config: Pick<GarminOAuthConfig, "consumerKey" | "consumerSecret">,
  oauthParameters: Record<string, string> = {},
  tokenSecret = "",
  extraParameters: Record<string, string> = {},
): string => {
  const url = new URL(rawUrl);
  const oauth = {
    oauth_consumer_key: config.consumerKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    ...oauthParameters,
  };
  const normalizedParameters = signingParameters(url, oauth, extraParameters)
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join("&");
  const signatureBase = [
    method.toUpperCase(),
    percentEncode(getBaseUrl(url)),
    percentEncode(normalizedParameters),
  ].join("&");
  const signingKey = `${percentEncode(config.consumerSecret)}&${percentEncode(tokenSecret)}`;
  const signature = createHmac("sha1", signingKey)
    .update(signatureBase)
    .digest("base64");

  const headerParameters = { ...oauth, oauth_signature: signature };
  return `OAuth ${Object.entries(headerParameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
    .join(", ")}`;
};

const parseFormEncoded = (body: string): Record<string, string> =>
  Object.fromEntries(new URLSearchParams(body).entries());

const requestForm = async (
  method: "GET" | "POST" | "DELETE",
  url: string,
  config: GarminOAuthConfig,
  oauthParameters: Record<string, string>,
  tokenSecret = "",
): Promise<string> => {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json, application/x-www-form-urlencoded, text/plain",
      Authorization: createOAuth1AuthorizationHeader(
        method,
        url,
        config,
        oauthParameters,
        tokenSecret,
      ),
    },
  });

  const body = await response.text();
  if (!response.ok) throw new GarminApiError(response.status, url);
  return body;
};

function garminApiUrl(
  config: GarminOAuthConfig,
  pathOrUrl: string,
  parameters: Record<string, string | number | undefined> = {},
): URL {
  const url = pathOrUrl.startsWith("http")
    ? new URL(pathOrUrl)
    : new URL(
        `${config.apiBaseUrl.replace(/\/$/, "")}/${pathOrUrl.replace(/^\//, "")}`,
      );
  for (const [key, value] of Object.entries(parameters)) {
    if (value != null) url.searchParams.set(key, String(value));
  }
  return url;
}

export async function requestGarminApiText(
  method: "GET" | "DELETE",
  config: GarminOAuthConfig,
  accessToken: GarminAccessToken,
  pathOrUrl: string,
  parameters: Record<string, string | number | undefined> = {},
): Promise<string> {
  const url = garminApiUrl(config, pathOrUrl, parameters);
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json, text/plain, application/octet-stream",
      Authorization: createOAuth1AuthorizationHeader(
        method,
        url.toString(),
        config,
        { oauth_token: accessToken.token },
        accessToken.secret,
      ),
    },
  });
  const body = await response.text();
  if (!response.ok) throw new GarminApiError(response.status, url.pathname);
  return body;
}

export async function getGarminJson<T = unknown>(
  config: GarminOAuthConfig,
  accessToken: GarminAccessToken,
  pathOrUrl: string,
  parameters: Record<string, string | number | undefined> = {},
): Promise<T> {
  const body = await requestGarminApiText(
    "GET",
    config,
    accessToken,
    pathOrUrl,
    parameters,
  );
  if (!body.trim()) return [] as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new GarminApiError(502, pathOrUrl);
  }
}

const parseTokenResponse = (
  body: string,
): { oauthToken: string; oauthTokenSecret: string } => {
  const values = parseFormEncoded(body);
  if (!values.oauth_token || !values.oauth_token_secret) {
    throw new GarminApiError(502);
  }
  return {
    oauthToken: values.oauth_token,
    oauthTokenSecret: values.oauth_token_secret,
  };
};

export async function requestGarminToken(
  config: GarminOAuthConfig,
): Promise<GarminRequestToken> {
  const body = await requestForm("POST", GARMIN_REQUEST_TOKEN_URL, config, {
    oauth_callback: config.redirectUri,
  });
  const token = parseTokenResponse(body);
  return { token: token.oauthToken, secret: token.oauthTokenSecret };
}

export async function exchangeGarminToken(
  config: GarminOAuthConfig,
  requestToken: GarminRequestToken,
  verifier: string,
): Promise<GarminAccessToken> {
  const body = await requestForm(
    "POST",
    GARMIN_ACCESS_TOKEN_URL,
    config,
    { oauth_token: requestToken.token, oauth_verifier: verifier },
    requestToken.secret,
  );
  const token = parseTokenResponse(body);
  return { token: token.oauthToken, secret: token.oauthTokenSecret };
}

export async function getGarminUserId(
  config: GarminOAuthConfig,
  accessToken: GarminAccessToken,
): Promise<string> {
  const body = await requestGarminApiText(
    "GET",
    config,
    accessToken,
    "/user/id",
  );

  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "userId" in parsed &&
      typeof parsed.userId === "string" &&
      parsed.userId.trim()
    ) {
      return parsed.userId.trim();
    }
  } catch {
    // Some legacy responses are a plain text user id.
  }

  const userId = body.trim();
  if (!userId) throw new GarminApiError(502);
  return userId;
}

export async function getGarminPermissions(
  config: GarminOAuthConfig,
  accessToken: GarminAccessToken,
): Promise<string[]> {
  const payload = await getGarminJson<unknown>(
    config,
    accessToken,
    "/user/permissions",
  );
  if (Array.isArray(payload)) {
    return payload.filter(
      (value): value is string => typeof value === "string",
    );
  }
  if (payload && typeof payload === "object") {
    const permissions = (payload as Record<string, unknown>).permissions;
    if (Array.isArray(permissions)) {
      return permissions.filter(
        (value): value is string => typeof value === "string",
      );
    }
  }
  return [];
}

export async function requestGarminBackfill(
  config: GarminOAuthConfig,
  accessToken: GarminAccessToken,
  summaryType: string,
  summaryStartTimeInSeconds: number,
  summaryEndTimeInSeconds: number,
): Promise<void> {
  await requestGarminApiText(
    "GET",
    config,
    accessToken,
    `/backfill/${summaryType}`,
    { summaryStartTimeInSeconds, summaryEndTimeInSeconds },
  );
}

export async function deleteGarminUser(
  config: GarminOAuthConfig,
  accessToken: GarminAccessToken,
): Promise<void> {
  await requestGarminApiText("DELETE", config, accessToken, "/user/id");
}

export const hashGarminRequestToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const hashGarminAccessToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const deriveEncryptionKey = (secret: string): Buffer =>
  createHash("sha256").update(secret).digest();

export const encryptGarminSecret = (
  value: string,
  encryptionKey: string,
): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    deriveEncryptionKey(encryptionKey),
    iv,
  );
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
};

export const decryptGarminSecret = (
  value: string,
  encryptionKey: string,
): string => {
  const [encodedIv, encodedTag, encodedData] = value.split(".");
  if (!encodedIv || !encodedTag || !encodedData)
    throw new Error("Invalid Garmin secret");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveEncryptionKey(encryptionKey),
    Buffer.from(encodedIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedData, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};

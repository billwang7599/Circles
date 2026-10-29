import {
  exchangeCodeAsync,
  makeRedirectUri,
  refreshAsync,
  revokeAsync,
  TokenError,
  TokenResponse,
} from "expo-auth-session";
import { openAuthSessionAsync } from "expo-web-browser";
import { createStore } from "./store";

const domain = process.env.EXPO_PUBLIC_COGNITO_DOMAIN;
const clientId = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID;

export const cognito =
  domain && clientId
    ? {
        clientId,
        redirectUri: makeRedirectUri({ path: "sign-in" }),
        scopes: ["openid", "email"],
        discovery: {
          authorizationEndpoint: `https://${domain}/oauth2/authorize`,
          tokenEndpoint: `https://${domain}/oauth2/token`,
          revocationEndpoint: `https://${domain}/oauth2/revoke`,
        },
        logoutUrl: `https://${domain}/logout`,
      }
    : undefined;

// The refresh token (or dev token), alone under its key since SecureStore may drop
// values over 2 KB; the access token stays in memory.
const saved = createStore<string | null>(
  "circles.session",
  (raw) => raw || null,
  (value) => value ?? "",
);
let access: TokenResponse | undefined;
let refreshing: Promise<string> | undefined;

export const useSignedIn = () => saved.useValue() !== null;

export const signInAsDev = (email: string) => saved.set(`dev:${email}`);

export async function signInWithCode(code: string, codeVerifier: string) {
  if (!cognito) return;
  const { clientId, redirectUri, discovery } = cognito;
  access = await exchangeCodeAsync(
    {
      clientId,
      redirectUri,
      code,
      extraParams: { code_verifier: codeVerifier },
    },
    discovery,
  );
  saved.set(access.refreshToken ?? null);
}

export function forgetSession() {
  access = undefined;
  saved.set(null);
}

export async function accessToken(): Promise<string | null> {
  const credential = saved.get();
  if (!cognito || !credential) return credential;
  if (access && TokenResponse.isTokenFresh(access)) return access.accessToken;
  refreshing ??= refreshAsync(
    { clientId: cognito.clientId, refreshToken: credential },
    cognito.discovery,
  )
    .then((tokens) => {
      access = tokens;
      return tokens.accessToken;
    })
    .catch((error: unknown) => {
      if (error instanceof TokenError) forgetSession();
      throw error;
    })
    .finally(() => {
      refreshing = undefined;
    });
  return refreshing;
}

export function signOut() {
  const credential = saved.get();
  forgetSession();
  if (!cognito) return;
  const { clientId, redirectUri, discovery, logoutUrl } = cognito;
  const params = new URLSearchParams({
    client_id: clientId,
    logout_uri: redirectUri,
  });
  // Clears the managed login cookie, or the next sign-in would skip the code.
  void openAuthSessionAsync(`${logoutUrl}?${params}`, redirectUri).catch(
    () => undefined,
  );
  if (credential)
    void revokeAsync({ clientId, token: credential }, discovery).catch(
      () => undefined,
    );
}

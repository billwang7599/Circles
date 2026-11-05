import { createStore } from "./store";

const clientId = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID;

export const usesCognito = Boolean(clientId);

// The refresh token (or dev token), alone under its key since SecureStore may drop
// values over 2 KB; the access token stays in memory.
const saved = createStore<string | null>(
  "circles.session",
  (raw) => raw || null,
  (value) => value ?? "",
);
let access: { token: string; expiresAtMs: number } | undefined;
let refreshing: Promise<string> | undefined;

export class CognitoError extends Error {
  readonly type: string;
  constructor(type: string, message: string) {
    super(message);
    this.type = type;
  }
}

type AuthResult = {
  ChallengeName?: string;
  Session?: string;
  AuthenticationResult?: {
    AccessToken: string;
    ExpiresIn: number;
    RefreshToken?: string;
  };
};

async function cognito<T>(action: string, body: object): Promise<T> {
  const res = await fetch("https://cognito-idp.ca-central-1.amazonaws.com/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify({ ClientId: clientId, ...body }),
  });
  const json = await res.json();
  if (!res.ok)
    throw new CognitoError(
      String(json.__type).split("#").pop() ?? "",
      json.message ?? "",
    );
  return json as T;
}

function keep({ AuthenticationResult: tokens }: AuthResult) {
  if (!tokens) throw new Error("Cognito sent no tokens");
  access = {
    token: tokens.AccessToken,
    expiresAtMs: Date.now() + tokens.ExpiresIn * 1000,
  };
  if (tokens.RefreshToken) saved.set(tokens.RefreshToken);
  return tokens.AccessToken;
}

export const useSignedIn = () => saved.useValue() !== null;

export const signInAsDev = (email: string) => saved.set(`dev:${email}`);

export type CodeStep = {
  email: string;
  confirmsSignUp: boolean;
  session?: string;
};

export const RESEND_COOLDOWN_SECONDS = 30;
let codeSentAtMs = -Infinity;

export const resendWaitSeconds = () =>
  Math.max(
    0,
    Math.ceil(RESEND_COOLDOWN_SECONDS - (Date.now() - codeSentAtMs) / 1000),
  );

export async function sendCode(email: string): Promise<CodeStep> {
  let step: CodeStep;
  try {
    const { ChallengeName, Session } = await cognito<AuthResult>(
      "InitiateAuth",
      {
        AuthFlow: "USER_AUTH",
        AuthParameters: { USERNAME: email, PREFERRED_CHALLENGE: "EMAIL_OTP" },
      },
    );
    if (ChallengeName !== "EMAIL_OTP")
      throw new Error(`Cognito asked for ${ChallengeName}`);
    step = { email, confirmsSignUp: false, session: Session };
  } catch (error) {
    if (!(error instanceof CognitoError)) throw error;
    if (error.type === "UserNotFoundException") {
      const { Session } = await cognito<{ Session?: string }>("SignUp", {
        Username: email,
        UserAttributes: [{ Name: "email", Value: email }],
      });
      step = { email, confirmsSignUp: true, session: Session };
    } else if (error.type === "UserNotConfirmedException") {
      await cognito("ResendConfirmationCode", { Username: email });
      step = { email, confirmsSignUp: true };
    } else throw error;
  }
  codeSentAtMs = Date.now();
  return step;
}

export async function enterCode(
  { email, confirmsSignUp, session }: CodeStep,
  code: string,
): Promise<CodeStep | undefined> {
  if (!confirmsSignUp) {
    keep(
      await cognito<AuthResult>("RespondToAuthChallenge", {
        ChallengeName: "EMAIL_OTP",
        Session: session,
        ChallengeResponses: { USERNAME: email, EMAIL_OTP_CODE: code },
      }),
    );
    return;
  }
  const confirmed = await cognito<{ Session?: string }>("ConfirmSignUp", {
    Username: email,
    ConfirmationCode: code,
    Session: session,
  });
  if (confirmed.Session) {
    try {
      keep(
        await cognito<AuthResult>("InitiateAuth", {
          AuthFlow: "USER_AUTH",
          AuthParameters: { USERNAME: email },
          Session: confirmed.Session,
        }),
      );
      return;
    } catch {
      // The sign-up session lasts minutes and resent codes have none: sign in with a new code.
    }
  }
  return sendCode(email);
}

export function forgetSession() {
  access = undefined;
  saved.set(null);
}

export async function accessToken(): Promise<string | null> {
  const credential = saved.get();
  if (!clientId || !credential) return credential;
  if (access && access.expiresAtMs - Date.now() > 60_000) return access.token;
  refreshing ??= cognito<AuthResult>("InitiateAuth", {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    AuthParameters: { REFRESH_TOKEN: credential },
  })
    .then(keep)
    .catch((error: unknown) => {
      if (
        error instanceof CognitoError &&
        error.type === "NotAuthorizedException"
      )
        forgetSession();
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
  if (clientId && credential)
    void cognito("RevokeToken", { Token: credential }).catch(() => undefined);
}

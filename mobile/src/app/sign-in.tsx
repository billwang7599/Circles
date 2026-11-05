import { Email } from "@circles/shared";
import { useEffect, useReducer, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CognitoError,
  enterCode,
  resendWaitSeconds,
  sendCode,
  signInAsDev,
  usesCognito,
  type CodeStep,
} from "../session";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Screen } from "../ui/Screen";
import { ScreenTitle } from "../ui/ScreenTitle";
import { Text } from "../ui/Text";
import { space } from "../ui/theme";

const tooMany = "Too many tries. Wait a few minutes and try again.";
const problems: Record<string, string> = {
  CodeMismatchException:
    "That code didn't work. Check it, or send a new one if it's a few minutes old.",
  ExpiredCodeException: "That code has expired. Send a new one.",
  CodeDeliveryFailureException: "Couldn't email a code to that address.",
  LimitExceededException: tooMany,
  TooManyRequestsException: tooMany,
  TooManyFailedAttemptsException: tooMany,
};

const tooManyCodes =
  "You've asked for a lot of codes. Wait a few minutes, then send again.";
const resendProblems: Record<string, string> = {
  ...problems,
  LimitExceededException: tooManyCodes,
  TooManyRequestsException: tooManyCodes,
};

const problem = (error: unknown, messages = problems) =>
  (error instanceof CognitoError && messages[error.type]) ||
  "Couldn't sign in. Check your connection and try again.";

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | CodeStep>("email");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const resendInSeconds = step === "email" ? 0 : resendWaitSeconds();
  const counting = resendInSeconds > 0;

  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [counting]);

  async function run(
    request: () => Promise<CodeStep | undefined>,
    sentNotice?: string,
    messages = problems,
  ) {
    setError(undefined);
    setNotice(undefined);
    setBusy(true);
    try {
      const next = await request();
      if (next) {
        setStep(next);
        setCode("");
        setNotice(sentNotice);
      }
    } catch (e) {
      setError(problem(e, messages));
    } finally {
      setBusy(false);
    }
  }

  function submitEmail() {
    if (busy) return;
    const parsed = Email.safeParse(email.trim().toLowerCase());
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    if (!usesCognito) return signInAsDev(parsed.data);
    setEmail(parsed.data);
    void run(() => sendCode(parsed.data));
  }

  function submitCode(codeStep: CodeStep) {
    if (busy || !code.trim()) return;
    void run(
      () => enterCode(codeStep, code.trim()),
      "Your email is confirmed. Enter the new code we sent to sign in.",
    );
  }

  function changeEmail() {
    setStep("email");
    setError(undefined);
    setNotice(undefined);
  }

  return (
    <Screen>
      <View style={[styles.form, { marginTop: insets.top }]}>
        <ScreenTitle title="Circles" />
        {step === "email" ? (
          <>
            <Text color="textMuted">
              {usesCognito
                ? "Enter your email and we'll send you a code to sign in."
                : "Development sign-in: any email works against a local API."}
            </Text>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              returnKeyType="go"
              onSubmitEditing={submitEmail}
            />
            <Button title="Continue" onPress={submitEmail} loading={busy} />
          </>
        ) : (
          <>
            <Text color="textMuted">
              We emailed you a code at {step.email}.
            </Text>
            <Field
              label="Code"
              value={code}
              onChangeText={setCode}
              autoFocus
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              returnKeyType="go"
              onSubmitEditing={() => submitCode(step)}
            />
            <Text variant="caption" color="textMuted">
              Didn&apos;t get it? Check your spam or junk folder.
            </Text>
            <Button
              title="Sign in"
              onPress={() => submitCode(step)}
              loading={busy}
              disabled={!code.trim()}
            />
            <Button
              title={
                counting ? `Send again in ${resendInSeconds}s` : "Send again"
              }
              variant="secondary"
              onPress={() =>
                run(
                  () => sendCode(step.email),
                  "We sent a new code.",
                  resendProblems,
                )
              }
              disabled={busy || counting}
            />
            <Button
              title="Use a different email"
              variant="secondary"
              onPress={changeEmail}
              disabled={busy}
            />
          </>
        )}
        {notice ? <Text color="textMuted">{notice}</Text> : null}
        {error ? (
          <Text variant="caption" color="danger">
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
});

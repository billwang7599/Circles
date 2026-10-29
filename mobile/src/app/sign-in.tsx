import { Email } from "@circles/shared";
import { useAuthRequest } from "expo-auth-session";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cognito, signInAsDev, signInWithCode } from "../session";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Screen } from "../ui/Screen";
import { ScreenTitle } from "../ui/ScreenTitle";
import { Text } from "../ui/Text";
import { space } from "../ui/theme";

export default function SignIn() {
  const insets = useSafeAreaInsets();
  return (
    <Screen>
      <View style={[styles.form, { marginTop: insets.top }]}>
        <ScreenTitle title="Circles" />
        {cognito ? <CognitoSignIn config={cognito} /> : <DevSignIn />}
      </View>
    </Screen>
  );
}

function CognitoSignIn({ config }: { config: NonNullable<typeof cognito> }) {
  const [request, , promptAsync] = useAuthRequest(config, config.discovery);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function signIn() {
    if (!request?.codeVerifier) return;
    setError(undefined);
    setBusy(true);
    try {
      const result = await promptAsync();
      if (result.type === "success")
        await signInWithCode(result.params.code, request.codeVerifier);
      else if (result.type === "error")
        setError(result.error?.description ?? "Couldn't sign in, try again");
    } catch {
      setError("Couldn't sign in, try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Text color="textMuted">
        Sign in or create an account with your email. We&apos;ll send you a
        code.
      </Text>
      <Button
        title="Continue with email"
        onPress={signIn}
        loading={busy}
        disabled={!request}
      />
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </>
  );
}

function DevSignIn() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();

  function submit() {
    const parsed = Email.safeParse(email.trim().toLowerCase());
    if (parsed.success) signInAsDev(parsed.data);
    else setError(parsed.error.issues[0]?.message);
  }

  return (
    <>
      <Text color="textMuted">
        Development sign-in: any email works against a local API.
      </Text>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={error}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button title="Sign in" onPress={submit} />
    </>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
});

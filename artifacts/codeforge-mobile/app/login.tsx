import { useAuthActions } from "@convex-dev/auth/react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

type Step =
  | "signIn"
  | { type: "forgot"; email: string }
  | { type: "reset-code"; email: string }
  | { type: "new-password"; email: string; code: string };

export default function LoginScreen() {
  const { signIn } = useAuthActions();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const clearErrors = () => setError("");

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }
    clearErrors();
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const formData = new FormData();
      formData.append("email", email.trim());
      formData.append("password", password);
      const provider = email.trim().endsWith("@test.local") ? "test" : "password";
      await signIn(provider, formData);
    } catch {
      setError("Invalid email or password");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async () => {
    if (!resetEmail.trim()) { setError("Please enter your email"); return; }
    clearErrors();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("email", resetEmail.trim());
      formData.append("flow", "reset");
      await signIn("password", formData);
      setStep({ type: "reset-code", email: resetEmail.trim() });
    } catch {
      setError("Could not send reset email. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetCodeSubmit = (c: string) => {
    if (step === "signIn" || !("email" in step)) return;
    setStep({ type: "new-password", email: step.email, code: c });
    setCode("");
  };

  const handleNewPasswordSubmit = async () => {
    if (step === "signIn" || step.type !== "new-password") return;
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    clearErrors();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("flow", "reset-verification");
      formData.append("email", step.email);
      formData.append("code", step.code);
      formData.append("newPassword", newPassword);
      await signIn("password", formData);
    } catch {
      setError("Reset failed — the code may have expired.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const sharedLogo = (icon: string, title: string, subtitle: string) => (
    <View style={styles.logoContainer}>
      <View style={[styles.logo, { backgroundColor: colors.primary }]}>
        <Feather name={icon as any} size={28} color={colors.primaryForeground} />
      </View>
      <Text style={[styles.logoText, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
    </View>
  );

  const sharedError = error ? (
    <View style={[styles.errorBox, { backgroundColor: colors.destructive + "22", borderColor: colors.destructive + "55" }]}>
      <Feather name="alert-circle" size={14} color={colors.destructive} />
      <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
    </View>
  ) : null;

  const padStyle = {
    paddingTop: insets.top + webTopPad + 40,
    paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20),
  };

  if (typeof step === "object" && step.type === "forgot") {
    return (
      <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.content, padStyle]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {sharedLogo("unlock", "Forgot password?", "Enter your email and we'll send a reset code")}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Feather name="mail" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.mutedForeground}
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoFocus
                />
              </View>
            </View>
            {sharedError}
            <Pressable
              style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              onPress={handleForgotSubmit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color={colors.primaryForeground} size="small" /> :
                <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Send Reset Code</Text>}
            </Pressable>
            <Pressable style={styles.linkRow} onPress={() => { setStep("signIn"); clearErrors(); }}>
              <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
                Back to <Text style={{ color: colors.primary }}>sign in</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (typeof step === "object" && step.type === "reset-code") {
    return (
      <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.content, padStyle]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {sharedLogo("mail", "Check your email", `We sent a reset code to ${step.email}`)}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Reset Code</Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Feather name="key" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={colors.mutedForeground}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoFocus
                />
              </View>
            </View>
            {sharedError}
            <Pressable
              style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              onPress={() => handleResetCodeSubmit(code)}
              disabled={!code.trim()}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Continue</Text>
            </Pressable>
            <Pressable style={styles.linkRow} onPress={() => { setStep({ type: "forgot", email: step.email }); clearErrors(); }}>
              <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
                Didn't receive it? <Text style={{ color: colors.primary }}>Resend</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (typeof step === "object" && step.type === "new-password") {
    return (
      <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.content, padStyle]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {sharedLogo("lock", "Set new password", "Choose a strong password for your account")}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>New Password</Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Feather name="lock" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={colors.mutedForeground}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  textContentType="newPassword"
                  autoFocus
                />
                <Pressable onPress={() => setShowNewPassword((v) => !v)} style={styles.eyeBtn}>
                  <Feather name={showNewPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>
            {sharedError}
            <Pressable
              style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              onPress={handleNewPasswordSubmit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color={colors.primaryForeground} size="small" /> :
                <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Reset Password</Text>}
            </Pressable>
            <Pressable style={styles.linkRow} onPress={() => { setStep("signIn"); clearErrors(); }}>
              <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
                Back to <Text style={{ color: colors.primary }}>sign in</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, padStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {sharedLogo("code", "Welcome back", "Sign in to your account")}

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Feather name="mail" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
              />
            </View>
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
              <Pressable onPress={() => { setResetEmail(email); setStep({ type: "forgot", email: email.trim() }); clearErrors(); }}>
                <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot password?</Text>
              </Pressable>
            </View>
            <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType="password"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </View>

          {sharedError}

          <Pressable
            style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Sign In</Text>
            )}
          </Pressable>

          <Pressable style={styles.linkRow} onPress={() => router.push("/signup")}>
            <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
              Don't have an account?{" "}
              <Text style={{ color: colors.primary }}>Sign up</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoText: {
    fontSize: 24,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  form: { gap: 16 },
  field: { gap: 8 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  eyeBtn: { padding: 4 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  btn: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
  },
  linkRow: {
    alignItems: "center",
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});

import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import Toast from "react-native-toast-message";
import { useAuthStore } from "../store/useAuthStore";
import type { AppScreenProps } from "../navigation/RootNavigator";

export function LoginScreen({ navigation }: AppScreenProps<"Login">) {
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState("alice@example.com");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    try {
      setLoading(true);
      await login({ email: email.trim(), password });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Login failed",
        text2: error instanceof Error ? error.message : "Unable to login"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={styles.page}
    >
      <View style={styles.container}>
        <Text style={styles.heading}>Welcome Back</Text>
        <Text style={styles.subHeading}>Login to continue to Tambola multiplayer.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholder="********"
            placeholderTextColor="#9ca3af"
          />

          <Pressable onPress={handleLogin} disabled={loading} style={[styles.primaryBtn, loading && styles.btnDisabled]}>
            <Text style={styles.primaryBtnText}>{loading ? "Signing in..." : "Login"}</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => navigation.navigate("Register")} style={styles.linkWrap}>
          <Text style={styles.linkText}>
            New player? <Text style={styles.linkTextStrong}>Create account</Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 72
  },
  heading: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111827"
  },
  subHeading: {
    marginTop: 8,
    color: "#6b7280"
  },
  card: {
    marginTop: 28,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 16
  },
  label: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563"
  },
  input: {
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827"
  },
  primaryBtn: {
    marginTop: 4,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#059669",
    paddingVertical: 12
  },
  btnDisabled: {
    opacity: 0.6
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff"
  },
  linkWrap: {
    marginTop: 18,
    alignItems: "center"
  },
  linkText: {
    fontSize: 13,
    color: "#4b5563"
  },
  linkTextStrong: {
    fontWeight: "700",
    color: "#047857"
  }
});

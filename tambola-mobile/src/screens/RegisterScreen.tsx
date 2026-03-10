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
import type { AppScreenProps } from "../navigation/RootNavigator";
import { useAuthStore } from "../store/useAuthStore";

export function RegisterScreen({ navigation }: AppScreenProps<"Register">) {
  const register = useAuthStore((state) => state.register);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    try {
      setLoading(true);
      await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Registration failed",
        text2: error instanceof Error ? error.message : "Unable to register"
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
        <Text style={styles.heading}>Create Account</Text>
        <Text style={styles.subHeading}>Setup your player profile.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            style={styles.input}
            placeholder="Tambola King"
            placeholderTextColor="#9ca3af"
          />

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

          <Pressable onPress={handleRegister} disabled={loading} style={[styles.primaryBtn, loading && styles.btnDisabled]}>
            <Text style={styles.primaryBtnText}>{loading ? "Creating..." : "Create Account"}</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => navigation.goBack()} style={styles.linkWrap}>
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.linkTextStrong}>Login</Text>
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

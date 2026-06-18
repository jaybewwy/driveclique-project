import { useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle2 } from "lucide-react-native";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { authAPI, getErrorMessage } from "../../src/services/api";
import TextField from "../../src/components/ui/TextField";
import GradientButton from "../../src/components/ui/GradientButton";

export default function ResetPassword() {
  const { token } = useLocalSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <View className="flex-1 bg-zinc950 items-center justify-center px-8">
        <Text className="text-white text-xl font-bold text-center">Invalid reset link</Text>
        <Text className="text-zinc400 text-center mt-2">
          This link is missing its token. Request a new one from the login screen.
        </Text>
        <Link href="/(auth)/forgot-password" className="text-accentOrange text-sm font-semibold mt-8">
          Request new link
        </Link>
      </View>
    );
  }

  const handleSubmit = async () => {
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authAPI.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <View className="flex-1 bg-zinc950 items-center justify-center px-8">
        <CheckCircle2 color="#10b981" size={48} />
        <Text className="text-white text-xl font-bold mt-4 text-center">Password reset</Text>
        <Text className="text-zinc400 text-center mt-2">You can now sign in with your new password.</Text>
        <GradientButton title="Go to Sign In" onPress={() => router.replace("/(auth)/login")} className="mt-8 w-full" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-zinc950">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
        <Text className="text-white text-2xl font-bold mb-6">Set a new password</Text>

        <TextField label="New password" secureTextEntry value={password} onChangeText={setPassword} />
        <TextField label="Confirm new password" secureTextEntry value={confirm} onChangeText={setConfirm} />

        {error ? <Text className="text-red-400 text-sm mb-4">{error}</Text> : null}

        <GradientButton title="Reset Password" onPress={handleSubmit} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

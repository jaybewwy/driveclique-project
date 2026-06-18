import { useState } from "react";
import { Link } from "expo-router";
import { CheckCircle2 } from "lucide-react-native";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { authAPI, getErrorMessage } from "../../src/services/api";
import TextField from "../../src/components/ui/TextField";
import GradientButton from "../../src/components/ui/GradientButton";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authAPI.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View className="flex-1 bg-zinc950 items-center justify-center px-8">
        <CheckCircle2 color="#10b981" size={48} />
        <Text className="text-white text-xl font-bold mt-4 text-center">Check your email</Text>
        <Text className="text-zinc400 text-center mt-2">
          If that account exists, we've sent a password reset link to {email}.
        </Text>
        <Link href="/(auth)/login" className="text-accentOrange text-sm font-semibold mt-8">
          Back to sign in
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-zinc950">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
        <Text className="text-white text-2xl font-bold mb-2">Forgot password?</Text>
        <Text className="text-zinc400 mb-6">Enter your email and we'll send you a reset link.</Text>

        <TextField
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        {error ? <Text className="text-red-400 text-sm mb-4">{error}</Text> : null}

        <GradientButton title="Send Reset Link" onPress={handleSubmit} loading={loading} />

        <Link href="/(auth)/login" className="text-center text-zinc400 text-sm mt-6">
          Back to sign in
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

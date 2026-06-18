import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { Car } from "lucide-react-native";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useAuth, getErrorMessage } from "../../src/hooks/useAuth";
import TextField from "../../src/components/ui/TextField";
import GradientButton from "../../src/components/ui/GradientButton";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username || !password) {
      setError("Please enter your username and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(username.trim(), password);
      router.replace("/(tabs)/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-zinc950"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
        <View className="items-center mb-10">
          <View className="w-14 h-14 rounded-2xl items-center justify-center mb-4 bg-accentRed">
            <Car color="#fff" size={28} />
          </View>
          <Text className="text-white text-2xl font-bold">
            Drive<Text className="text-accentOrange">Clique</Text>
          </Text>
          <Text className="text-zinc400 mt-2 text-center">Your crew is waiting for you.</Text>
        </View>

        <TextField
          label="Username"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          placeholder="yourusername"
        />
        <TextField
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
        />

        {error ? <Text className="text-red-400 text-sm mb-4">{error}</Text> : null}

        <GradientButton title="Sign In" onPress={handleSubmit} loading={loading} />

        <Link href="/(auth)/forgot-password" className="text-center text-zinc400 text-sm mt-5">
          Forgot password?
        </Link>

        <View className="flex-row justify-center mt-8">
          <Text className="text-zinc400 text-sm">Don't have an account? </Text>
          <Link href="/(auth)/register" className="text-accentOrange text-sm font-semibold">
            Create one
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

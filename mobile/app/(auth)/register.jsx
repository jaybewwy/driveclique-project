import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useAuth, getErrorMessage } from "../../src/hooks/useAuth";
import TextField from "../../src/components/ui/TextField";
import GradientButton from "../../src/components/ui/GradientButton";
import Logo from "../../src/components/ui/Logo";

const getPasswordStrength = (pwd) => {
  if (!pwd) return 0;
  const hasComplexity = /\d/.test(pwd) || /[^a-zA-Z0-9]/.test(pwd);
  const hasMixedCase = /[a-z]/.test(pwd) && /[A-Z]/.test(pwd);
  if (pwd.length < 6) return 1;
  if (pwd.length < 8 || !hasComplexity) return 2;
  if (pwd.length < 10) return 3;
  return hasComplexity && hasMixedCase ? 4 : 3;
};

const STRENGTH_COLOR = ["#27272a", "#ef4444", "#f97316", "#eab308", "#10b981"];
const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong"];

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    location: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const strength = getPasswordStrength(form.password);

  const handleSubmit = async () => {
    if (!form.username || !form.email || !form.password) {
      setError("Username, email, and password are required.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await register(form);
      router.replace("/(tabs)/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-zinc950">
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 48, paddingBottom: 48 }}>
        <View className="items-center mb-8">
          <View className="mb-4">
            <Logo size={56} />
          </View>
          <Text className="text-white text-2xl font-bold">Find your tribe.</Text>
          <Text className="text-zinc400 mt-1 text-center">Start your journey.</Text>
        </View>

        <View className="flex-row gap-3">
          <TextField label="First Name" className="flex-1" value={form.firstName} onChangeText={set("firstName")} />
          <TextField label="Last Name" className="flex-1" value={form.lastName} onChangeText={set("lastName")} />
        </View>
        <TextField
          label="Username"
          autoCapitalize="none"
          autoCorrect={false}
          value={form.username}
          onChangeText={set("username")}
        />
        <TextField
          label="Email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={form.email}
          onChangeText={set("email")}
        />
        <TextField
          label="Location (optional)"
          value={form.location}
          onChangeText={set("location")}
          placeholder="City, Country"
        />
        <TextField label="Password" secureTextEntry value={form.password} onChangeText={set("password")} />

        {form.password ? (
          <View className="mb-4 -mt-2">
            <View className="flex-row gap-1.5 mb-1.5">
              {[1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  className="flex-1 h-1.5 rounded-full"
                  style={{ backgroundColor: i <= strength ? STRENGTH_COLOR[strength] : "#27272a" }}
                />
              ))}
            </View>
            <Text className="text-zinc400 text-xs">{STRENGTH_LABEL[strength]}</Text>
          </View>
        ) : null}

        {error ? <Text className="text-red-400 text-sm mb-4">{error}</Text> : null}

        <GradientButton title="Create Account" onPress={handleSubmit} loading={loading} />

        <View className="flex-row justify-center mt-8">
          <Text className="text-zinc400 text-sm">Already have an account? </Text>
          <Link href="/(auth)/login" className="text-accentOrange text-sm font-semibold">
            Sign in
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

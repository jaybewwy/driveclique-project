import { useEffect, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { CheckCircle2, XCircle } from "lucide-react-native";
import { ActivityIndicator, Text, View } from "react-native";
import { authAPI, getErrorMessage } from "../../src/services/api";

export default function VerifyEmail() {
  const { token } = useLocalSearchParams();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("This link is missing its verification token.");
      return;
    }
    (async () => {
      try {
        await authAPI.verifyEmail(token);
        setStatus("success");
      } catch (err) {
        setStatus("error");
        setMessage(getErrorMessage(err));
      }
    })();
  }, [token]);

  return (
    <View className="flex-1 bg-zinc950 items-center justify-center px-8">
      {status === "loading" && <ActivityIndicator color="#dc2626" size="large" />}
      {status === "success" && (
        <>
          <CheckCircle2 color="#10b981" size={48} />
          <Text className="text-white text-xl font-bold mt-4">Email verified!</Text>
        </>
      )}
      {status === "error" && (
        <>
          <XCircle color="#ef4444" size={48} />
          <Text className="text-white text-xl font-bold mt-4 text-center">Verification failed</Text>
          <Text className="text-zinc400 text-center mt-2">{message}</Text>
        </>
      )}
      <Link href="/(auth)/login" className="text-accentOrange text-sm font-semibold mt-8">
        Go to sign in
      </Link>
    </View>
  );
}

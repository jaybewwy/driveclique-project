import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { CheckCircle2, XCircle } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { drivesAPI, getErrorMessage } from "../../../src/services/api";

export default function DriveCheckIn() {
  const { driveId } = useLocalSearchParams();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await drivesAPI.getCheckinStatus(driveId);
      setStatus(data);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [driveId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (present) => {
    setSubmitting(true);
    try {
      await drivesAPI.submitCheckin(driveId, present);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-zinc950 items-center justify-center">
        <ActivityIndicator color="#dc2626" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-zinc950 items-center justify-center px-8">
        <XCircle color="#ef4444" size={40} />
        <Text className="text-white font-semibold mt-3 text-center">{error}</Text>
      </View>
    );
  }

  if (status?.isCompleted) {
    return (
      <View className="flex-1 bg-zinc950 items-center justify-center px-8">
        <Text className="text-white text-lg font-semibold text-center">Check-in is closed</Text>
        <Text className="text-zinc400 text-center mt-2">This drive has been marked completed.</Text>
      </View>
    );
  }

  if (status?.checkedIn !== "pending") {
    return (
      <View className="flex-1 bg-zinc950 items-center justify-center px-8">
        {status.checkedIn === "present" ? (
          <CheckCircle2 color="#10b981" size={48} />
        ) : (
          <XCircle color="#ef4444" size={48} />
        )}
        <Text className="text-white text-lg font-semibold mt-4 text-center">
          {status.checkedIn === "present" ? "You're checked in!" : "Marked as not present"}
        </Text>
        <Text className="text-zinc400 text-center mt-1">
          {status.driveName} · {status.clubName}
        </Text>
        <Pressable onPress={() => submit(status.checkedIn !== "present")} disabled={submitting} className="mt-8">
          <Text className="text-accentOrange font-semibold">Change my answer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc950 items-center justify-center px-8">
      <Text className="text-white text-xl font-bold text-center">{status.driveName}</Text>
      <Text className="text-zinc400 text-center mt-1 mb-8">{status.clubName} — are you here?</Text>

      <Pressable
        onPress={() => submit(true)}
        disabled={submitting}
        className="w-full bg-emerald-600 rounded-2xl py-4 items-center mb-3"
      >
        <Text className="text-white font-semibold text-base">I'm here</Text>
      </Pressable>
      <Pressable
        onPress={() => submit(false)}
        disabled={submitting}
        className="w-full bg-white/[0.06] border border-white/[0.10] rounded-2xl py-4 items-center"
      >
        <Text className="text-zinc400 font-semibold text-base">I couldn't make it</Text>
      </Pressable>
    </View>
  );
}

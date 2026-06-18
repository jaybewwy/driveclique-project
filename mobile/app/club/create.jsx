import { useState } from "react";
import { useRouter } from "expo-router";
import { Lock, Unlock } from "lucide-react-native";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { clubsAPI, getErrorMessage } from "../../src/services/api";
import { useClubs } from "../../src/hooks/useClubs";
import TextField from "../../src/components/ui/TextField";
import GradientButton from "../../src/components/ui/GradientButton";

export default function CreateClub() {
  const router = useRouter();
  const { refresh } = useClubs();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !description) {
      setError("Club name and description are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await clubsAPI.create({ name, description, location, isPrivate });
      await refresh();
      router.replace(`/club/${data.club._id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-zinc950">
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 56 }}>
        <Text className="text-white text-2xl font-bold mb-6">Create a Club</Text>

        <TextField label="Club Name" value={name} onChangeText={setName} />
        <TextField label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={3} />
        <TextField label="Location (optional)" value={location} onChangeText={setLocation} placeholder="City, Country" />

        <Text className="text-zinc400 text-xs mb-1.5 uppercase tracking-wide">Privacy</Text>
        <View className="flex-row gap-3 mb-6">
          <Pressable
            onPress={() => setIsPrivate(false)}
            className="flex-1 rounded-2xl p-4 border"
            style={{
              borderColor: !isPrivate ? "#dc2626" : "rgba(255,255,255,0.10)",
              backgroundColor: !isPrivate ? "rgba(220,38,38,0.1)" : "rgba(255,255,255,0.04)",
            }}
          >
            <Unlock color={!isPrivate ? "#dc2626" : "#71717a"} size={18} />
            <Text className="text-white font-semibold mt-2">Public</Text>
            <Text className="text-zinc400 text-xs mt-1">Anyone can join instantly</Text>
          </Pressable>
          <Pressable
            onPress={() => setIsPrivate(true)}
            className="flex-1 rounded-2xl p-4 border"
            style={{
              borderColor: isPrivate ? "#dc2626" : "rgba(255,255,255,0.10)",
              backgroundColor: isPrivate ? "rgba(220,38,38,0.1)" : "rgba(255,255,255,0.04)",
            }}
          >
            <Lock color={isPrivate ? "#dc2626" : "#71717a"} size={18} />
            <Text className="text-white font-semibold mt-2">Private</Text>
            <Text className="text-zinc400 text-xs mt-1">Join by invite code only</Text>
          </Pressable>
        </View>

        {error ? <Text className="text-red-400 text-sm mb-4">{error}</Text> : null}

        <GradientButton title="Create Club" onPress={handleSubmit} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

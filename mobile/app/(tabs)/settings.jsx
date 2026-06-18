import { LogOut, Mail, MapPin, User as UserIcon } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/hooks/useAuth";
import Card from "../../src/components/ui/Card";

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  return (
    <ScrollView
      className="flex-1 bg-zinc950"
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Text className="text-zinc500 text-xs uppercase tracking-widest mb-1">ACCOUNT</Text>
      <Text className="text-white text-2xl font-bold mb-6">Settings</Text>

      <Card className="mb-4">
        <View className="flex-row items-center gap-2 mb-3">
          <UserIcon color="#71717a" size={16} />
          <Text className="text-zinc400 text-sm">Username</Text>
        </View>
        <Text className="text-white font-semibold mb-4">@{user?.username}</Text>

        <View className="flex-row items-center gap-2 mb-3">
          <Mail color="#71717a" size={16} />
          <Text className="text-zinc400 text-sm">Email</Text>
        </View>
        <Text className="text-white font-semibold mb-4">{user?.email}</Text>

        <View className="flex-row items-center gap-2 mb-3">
          <MapPin color="#71717a" size={16} />
          <Text className="text-zinc400 text-sm">Location</Text>
        </View>
        <Text className="text-white font-semibold">{user?.location || "Not set"}</Text>
      </Card>

      <Pressable
        onPress={logout}
        className="flex-row items-center justify-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-2xl py-3.5"
      >
        <LogOut color="#ef4444" size={18} />
        <Text className="text-red-400 font-semibold">Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

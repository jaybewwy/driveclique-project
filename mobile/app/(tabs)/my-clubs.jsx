import { useRouter } from "expo-router";
import { Plus, Users } from "lucide-react-native";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/hooks/useAuth";
import { useClubs } from "../../src/hooks/useClubs";
import Card from "../../src/components/ui/Card";
import GradientButton from "../../src/components/ui/GradientButton";
import { useState } from "react";

export default function MyClubs() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { clubs, isLoading, refresh } = useClubs();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <ScrollView
      className="flex-1 bg-zinc950"
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />}
    >
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-zinc500 text-xs uppercase tracking-widest mb-1">MY GARAGE</Text>
          <Text className="text-white text-2xl font-bold">My Clubs</Text>
        </View>
      </View>

      <GradientButton title="+ Create Club" onPress={() => router.push("/club/create")} className="mb-6" />

      {isLoading && !clubs.length ? (
        <Text className="text-zinc400">Loading...</Text>
      ) : clubs.length === 0 ? (
        <Card>
          <Text className="text-zinc400 text-center mb-4">No clubs yet — find one or create your own.</Text>
        </Card>
      ) : (
        clubs.map((club) => (
          <Pressable key={club._id} onPress={() => router.push(`/club/${club._id}`)}>
            <Card className="mb-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-white font-semibold text-base">{club.name}</Text>
                  <View className="flex-row items-center gap-1.5 mt-1">
                    <Users color="#71717a" size={14} />
                    <Text className="text-zinc400 text-sm">
                      {club.members?.length || 0} member{club.members?.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                </View>
                {club.leader?._id === user?._id && (
                  <View className="bg-accentRed/20 px-2.5 py-1 rounded-full">
                    <Text className="text-accentOrange text-xs font-semibold">Leader</Text>
                  </View>
                )}
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

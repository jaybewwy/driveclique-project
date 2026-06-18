import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Calendar, Car, LogOut } from "lucide-react-native";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/hooks/useAuth";
import { useClubs } from "../../src/hooks/useClubs";
import { drivesAPI } from "../../src/services/api";
import Card from "../../src/components/ui/Card";

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { clubs, isLoading: clubsLoading, refresh: refreshClubs } = useClubs();
  const router = useRouter();
  const [drives, setDrives] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadDrives = async () => {
    try {
      const results = await Promise.all(clubs.map((c) => drivesAPI.getClubDrives(c._id)));
      const all = results.flatMap((r) => r.data.drives || []);
      const upcoming = all
        .filter((d) => !d.isCancelled && new Date(d.date) > new Date())
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      setDrives(upcoming);
    } catch {
      setDrives([]);
    }
  };

  useEffect(() => {
    if (clubs.length) loadDrives();
    else setDrives([]);
  }, [clubs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshClubs();
    setRefreshing(false);
  };

  return (
    <ScrollView
      className="flex-1 bg-zinc950"
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />}
    >
      <View className="flex-row justify-between items-start mb-6">
        <View>
          <Text className="text-zinc500 text-xs uppercase tracking-widest mb-1">GOOD TO SEE YOU</Text>
          <Text className="text-white text-2xl font-bold">
            Welcome back, {user?.firstName || user?.name || user?.username}
          </Text>
        </View>
        <Pressable onPress={logout} className="p-2">
          <LogOut color="#71717a" size={20} />
        </Pressable>
      </View>

      <Card className="mb-6">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-xl bg-accentRed items-center justify-center">
            <Car color="#fff" size={20} />
          </View>
          <View>
            <Text className="text-white font-semibold">{clubs.length} club{clubs.length === 1 ? "" : "s"}</Text>
            <Text className="text-zinc400 text-sm">{drives.length} upcoming drives</Text>
          </View>
        </View>
      </Card>

      <Text className="text-zinc500 text-xs uppercase tracking-widest mb-3">SCHEDULE</Text>
      {clubsLoading && !drives.length ? (
        <Text className="text-zinc400">Loading...</Text>
      ) : drives.length === 0 ? (
        <Card>
          <Text className="text-zinc400 text-center">No upcoming drives. Join a club and RSVP to get started.</Text>
        </Card>
      ) : (
        drives.map((drive) => (
          <Pressable key={drive._id} onPress={() => router.push(`/club/${drive.club}`)}>
            <Card className="mb-3">
              <View className="flex-row items-center gap-3">
                <Calendar color="#ea580c" size={20} />
                <View className="flex-1">
                  <Text className="text-white font-semibold">{drive.name}</Text>
                  <Text className="text-zinc400 text-sm">
                    {new Date(drive.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {drive.location}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

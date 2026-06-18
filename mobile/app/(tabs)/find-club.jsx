import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { Search, Users } from "lucide-react-native";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { clubsAPI, getErrorMessage } from "../../src/services/api";
import TextField from "../../src/components/ui/TextField";
import Card from "../../src/components/ui/Card";

export default function FindClub() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = useCallback(async (q) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await clubsAPI.searchPage(q, 1, 20);
      setResults(data.clubs || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <View className="flex-1 bg-zinc950" style={{ paddingTop: insets.top + 16 }}>
      <View className="px-5 mb-3">
        <Text className="text-zinc500 text-xs uppercase tracking-widest mb-1">DISCOVERY</Text>
        <Text className="text-white text-2xl font-bold mb-4">Find Clubs</Text>
        <TextField
          placeholder="Search by club name or location…"
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            search(v);
          }}
        />
      </View>

      {error ? <Text className="text-red-400 text-sm px-5">{error}</Text> : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        ListEmptyComponent={
          !loading && (
            <Card>
              <View className="items-center py-6">
                <Search color="#71717a" size={28} />
                <Text className="text-zinc400 mt-3">
                  {query ? "No clubs found." : "Search for a club by name or location."}
                </Text>
              </View>
            </Card>
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/club/${item._id}`)}>
            <Card className="mb-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-white font-semibold text-base">{item.name}</Text>
                  <Text className="text-zinc400 text-sm mt-0.5">{item.location || "No location set"}</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Users color="#71717a" size={14} />
                  <Text className="text-zinc400 text-sm">{item.members?.length || 0}</Text>
                </View>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

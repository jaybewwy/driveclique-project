import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Calendar, MapPin, Users } from "lucide-react-native";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/hooks/useAuth";
import { clubsAPI, drivesAPI, getErrorMessage } from "../../src/services/api";
import Card from "../../src/components/ui/Card";
import GradientButton from "../../src/components/ui/GradientButton";

const RSVP_OPTIONS = [
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "not-going", label: "Not Going" },
];

function DriveCard({ drive, isMember, onRsvpChange }) {
  const [status, setStatus] = useState(null);
  const [counts, setCounts] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const { data } = await drivesAPI.getRSVPStatus(drive._id);
      setStatus(data.userStatus);
      setCounts(data.counts);
    } catch {
      /* not a member, or other read error — RSVP UI stays hidden */
    }
  }, [drive._id]);

  useEffect(() => {
    if (isMember) loadStatus();
  }, [isMember, loadStatus]);

  const rsvp = async (value) => {
    setBusy(true);
    try {
      await drivesAPI.rsvp(drive._id, value);
      await loadStatus();
      onRsvpChange?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-3">
      <Text className="text-white font-semibold text-base mb-1">{drive.name}</Text>
      <View className="flex-row items-center gap-1.5 mb-1">
        <Calendar color="#71717a" size={14} />
        <Text className="text-zinc400 text-sm">
          {new Date(drive.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          {drive.time ? ` · ${drive.time}` : ""}
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5 mb-3">
        <MapPin color="#71717a" size={14} />
        <Text className="text-zinc400 text-sm">{drive.location}</Text>
      </View>

      {drive.isCancelled ? (
        <View className="bg-red-500/15 rounded-xl py-2 items-center">
          <Text className="text-red-400 text-sm font-medium">Cancelled</Text>
        </View>
      ) : isMember ? (
        <View className="flex-row gap-2">
          {RSVP_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              disabled={busy}
              onPress={() => rsvp(opt.value)}
              className="flex-1 py-2 rounded-xl items-center"
              style={{ backgroundColor: status === opt.value ? "#dc2626" : "rgba(255,255,255,0.06)" }}
            >
              <Text className={status === opt.value ? "text-white text-xs font-semibold" : "text-zinc400 text-xs"}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {counts ? (
        <Text className="text-zinc500 text-xs mt-3">
          {counts.going} going · {counts.maybe} maybe · {counts.waitlisted} waitlisted
        </Text>
      ) : null}
    </Card>
  );
}

export default function ClubDetail() {
  const { clubId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const [club, setClub] = useState(null);
  const [drives, setDrives] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    try {
      const [clubRes, drivesRes] = await Promise.all([
        clubsAPI.getClubById(clubId),
        drivesAPI.getClubDrives(clubId).catch(() => ({ data: { drives: [] } })),
      ]);
      setClub(clubRes.data.club);
      setDrives((drivesRes.data.drives || []).sort((a, b) => new Date(a.date) - new Date(b.date)));
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const isMember = club?.members?.some((m) => m._id === user?._id);
  const isLeader = club?.leader?._id === user?._id;

  const handleJoin = async () => {
    setJoining(true);
    try {
      await clubsAPI.requestToJoin(clubId);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-zinc950 items-center justify-center">
        <ActivityIndicator color="#dc2626" size="large" />
      </View>
    );
  }

  if (error && !club) {
    return (
      <View className="flex-1 bg-zinc950 items-center justify-center px-8">
        <Users color="#71717a" size={32} />
        <Text className="text-white font-semibold mt-3 text-center">{error}</Text>
        <Pressable onPress={() => router.back()} className="mt-6">
          <Text className="text-accentOrange font-semibold">Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-zinc950"
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />}
    >
      <Text className="text-white text-2xl font-bold mb-1">{club.name}</Text>
      <Text className="text-zinc400 mb-1">{club.description}</Text>
      {club.location ? (
        <View className="flex-row items-center gap-1.5 mb-4">
          <MapPin color="#71717a" size={14} />
          <Text className="text-zinc400 text-sm">{club.location}</Text>
        </View>
      ) : null}

      <Card className="mb-6">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Users color="#71717a" size={16} />
            <Text className="text-zinc400 text-sm">
              {club.members?.length || 0} member{club.members?.length === 1 ? "" : "s"}
            </Text>
          </View>
          {isLeader && (
            <View className="bg-accentRed/20 px-2.5 py-1 rounded-full">
              <Text className="text-accentOrange text-xs font-semibold">You lead this club</Text>
            </View>
          )}
        </View>
      </Card>

      {!isMember && !isLeader && (
        <GradientButton
          title={club.isPrivate ? "Request to Join" : "Join Club"}
          onPress={handleJoin}
          loading={joining}
          className="mb-6"
        />
      )}

      <Text className="text-zinc500 text-xs uppercase tracking-widest mb-3">DRIVES</Text>
      {drives.length === 0 ? (
        <Card>
          <Text className="text-zinc400 text-center">No drives scheduled yet.</Text>
        </Card>
      ) : (
        drives.map((drive) => (
          <DriveCard key={drive._id} drive={drive} isMember={isMember || isLeader} onRsvpChange={load} />
        ))
      )}
    </ScrollView>
  );
}

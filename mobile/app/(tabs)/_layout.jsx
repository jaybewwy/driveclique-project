import { Redirect, Tabs } from "expo-router";
import { Car, LayoutGrid, Search, Settings } from "lucide-react-native";
import { useAuth } from "../../src/hooks/useAuth";

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#09090b", borderTopColor: "#27272a" },
        tabBarActiveTintColor: "#dc2626",
        tabBarInactiveTintColor: "#71717a",
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="my-clubs"
        options={{ title: "My Clubs", tabBarIcon: ({ color, size }) => <Car color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="find-club"
        options={{ title: "Find Club", tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }}
      />
    </Tabs>
  );
}

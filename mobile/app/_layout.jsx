import "../src/theme/global.css";
import { useEffect } from "react";
import { Slot, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/hooks/useAuth";
import { ClubsProvider } from "../src/hooks/useClubs";

// Where a tapped push notification should deep-link to, mirroring the one
// click-to-navigate case the web NotificationPanel already has (DRIVE_CHECKIN_REQUEST)
// plus a general club fallback for every other type that carries a clubId —
// useful here specifically because, unlike the web bell panel, tapping a push
// is often the user's only way back into the app.
function pathForNotification(data) {
  if (!data) return null;
  if (data.type === "DRIVE_CHECKIN_REQUEST" && data.driveId) {
    return `/drive/${data.driveId}/checkin`;
  }
  if (data.clubId) return `/club/${data.clubId}`;
  return null;
}

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const path = pathForNotification(response.notification.request.content.data);
      if (path) router.push(path);
    });
    return () => subscription.remove();
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ClubsProvider>
            <StatusBar style="light" backgroundColor="#09090b" />
            <Slot />
          </ClubsProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

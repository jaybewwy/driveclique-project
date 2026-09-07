import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { authAPI } from "./api";
import { pushTokenStorage } from "./storage";

// Controls how a notification is presented while the app is in the
// foreground (a backgrounded/closed app always shows the native banner —
// this handler only affects what happens while the user is looking at
// the app already).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests notification permission, obtains this device's Expo push token,
 * and registers it with the backend. Safe to call on every login/app-open —
 * the backend upserts by token value, so re-registering is a no-op refresh.
 *
 * Resolves to `null` (never throws) on any of the several legitimate reasons
 * this can't succeed yet: web platform (no native push), permission denied,
 * or no EAS project configured (this app hasn't run `eas init`, so there is
 * no real project ID to request a token against — logged, not faked, per
 * this project's "don't fabricate config that doesn't exist" convention).
 */
export async function registerForPushNotificationsAsync() {
  if (Platform.OS === "web") return null;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#dc2626",
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      console.warn(
        "[push] No EAS project ID configured (app.json extra.eas.projectId) — skipping push registration. Run `eas init` first."
      );
      return null;
    }

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });

    await authAPI.registerPushToken(expoPushToken, Platform.OS);
    await pushTokenStorage.setToken(expoPushToken);
    return expoPushToken;
  } catch (err) {
    console.warn("[push] Failed to register for push notifications:", err.message);
    return null;
  }
}

/**
 * Tells the backend to stop sending push to this device, then forgets the
 * locally-stored token. Must be called while the user is still authenticated
 * (before the auth token is cleared) since the backend route requires it.
 * Best-effort: a failure here just means a dead token ages out server-side
 * the next time Expo reports it as DeviceNotRegistered.
 */
export async function unregisterCurrentPushTokenAsync() {
  const token = await pushTokenStorage.getToken();
  if (!token) return;
  try {
    await authAPI.unregisterPushToken(token);
  } catch {
    /* best-effort */
  }
  await pushTokenStorage.removeToken();
}

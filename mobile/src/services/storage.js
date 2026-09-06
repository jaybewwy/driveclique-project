import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "driveclique_token";
const REFRESH_TOKEN_KEY = "driveclique_refresh_token";
const USER_KEY = "driveclique_user";
const PUSH_TOKEN_KEY = "driveclique_push_token";

// expo-secure-store has no native module on web (Expo SDK 56). AsyncStorage-on-web
// (localStorage) is used there instead so the app is testable in a browser; Android/iOS
// builds always use the real encrypted SecureStore.
const secureGet = Platform.OS === "web" ? AsyncStorage.getItem : SecureStore.getItemAsync;
const secureSet = Platform.OS === "web" ? AsyncStorage.setItem : SecureStore.setItemAsync;
const secureDelete = Platform.OS === "web" ? AsyncStorage.removeItem : SecureStore.deleteItemAsync;

export const tokenStorage = {
  getToken: () => secureGet(TOKEN_KEY),
  setToken: (token) => secureSet(TOKEN_KEY, token),
  removeToken: () => secureDelete(TOKEN_KEY),

  getRefreshToken: () => secureGet(REFRESH_TOKEN_KEY),
  setRefreshToken: (token) => secureSet(REFRESH_TOKEN_KEY, token),
  removeRefreshToken: () => secureDelete(REFRESH_TOKEN_KEY),
};

export const userStorage = {
  getUser: async () => {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setUser: (user) => AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
  removeUser: () => AsyncStorage.removeItem(USER_KEY),
};

// Not a secret (unlike the auth tokens above), just this device's own Expo push
// token — kept so logout can tell the backend exactly which one to unregister.
export const pushTokenStorage = {
  getToken: () => AsyncStorage.getItem(PUSH_TOKEN_KEY),
  setToken: (token) => AsyncStorage.setItem(PUSH_TOKEN_KEY, token),
  removeToken: () => AsyncStorage.removeItem(PUSH_TOKEN_KEY),
};

export const clearSession = async () => {
  await Promise.all([
    tokenStorage.removeToken(),
    tokenStorage.removeRefreshToken(),
    userStorage.removeUser(),
  ]);
};

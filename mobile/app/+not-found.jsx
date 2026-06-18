import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function NotFound() {
  return (
    <View className="flex-1 bg-zinc950 items-center justify-center px-8">
      <Text className="text-white text-3xl font-bold mb-2">404</Text>
      <Text className="text-zinc400 text-center mb-8">This page doesn't exist.</Text>
      <Link href="/" className="text-accentOrange font-semibold">
        Go home
      </Link>
    </View>
  );
}

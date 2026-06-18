import { View } from "react-native";

export default function Card({ children, className = "" }) {
  return (
    <View className={`bg-white/[0.04] border border-white/[0.07] rounded-3xl p-4 ${className}`}>
      {children}
    </View>
  );
}

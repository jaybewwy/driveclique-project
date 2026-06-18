import { ActivityIndicator, Pressable, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function GradientButton({ title, onPress, loading, disabled, className = "" }) {
  const isDisabled = disabled || loading;
  return (
    <Pressable onPress={onPress} disabled={isDisabled} className={className} style={{ opacity: isDisabled ? 0.6 : 1 }}>
      <LinearGradient
        colors={["#dc2626", "#ea580c"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ borderRadius: 16, paddingVertical: 14, alignItems: "center", justifyContent: "center" }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">{title}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

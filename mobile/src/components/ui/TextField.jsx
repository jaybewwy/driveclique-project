import { Text, TextInput, View } from "react-native";

export default function TextField({ label, error, className = "", ...props }) {
  return (
    <View className={`mb-4 ${className}`}>
      {label ? <Text className="text-zinc400 text-xs mb-1.5 uppercase tracking-wide">{label}</Text> : null}
      <TextInput
        placeholderTextColor="#71717a"
        className="bg-white/[0.06] border border-white/[0.10] rounded-2xl px-4 py-3 text-white text-base"
        {...props}
      />
      {error ? <Text className="text-red-400 text-xs mt-1">{error}</Text> : null}
    </View>
  );
}

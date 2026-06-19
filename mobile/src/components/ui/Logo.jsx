import { Image, View } from "react-native";

// The brand mark (red/black) is designed for a light background, so it always
// renders inside a white chip — including on this app's dark screens.
export default function Logo({ size = 56, radius }) {
  const chipRadius = radius ?? size * 0.32;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: chipRadius,
        backgroundColor: "#ffffff",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        source={require("../../assets/logo-mark.png")}
        style={{ width: size * 0.68, height: size * 0.68 }}
        resizeMode="contain"
      />
    </View>
  );
}

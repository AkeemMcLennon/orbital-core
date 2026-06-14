import React from "react";
import {
  ActionSheetIOS,
  Platform,
  Pressable,
  View,
  type ViewStyle,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { SocialLinkIcon } from "./SocialLinkIcon";
import {
  SOCIAL_LINK_META,
  SOCIAL_LINK_TYPES,
  type SocialLinkType,
} from "../utils/socialLinks";
import { colors } from "../theme";

interface PlatformSelectProps {
  value: SocialLinkType;
  onChange: (type: SocialLinkType) => void;
}

const containerStyle: ViewStyle = {
  width: 44,
  height: 44,
  justifyContent: "center",
  alignItems: "center",
  borderRightWidth: 1,
  borderRightColor: colors.border,
};

// iOS has no native dropdown-style Picker (it renders an inline wheel), so the
// transparent-overlay trick used on Android/web doesn't work there. Branch to a
// native ActionSheet on iOS instead.
export function PlatformSelect({ value, onChange }: PlatformSelectProps) {
  if (Platform.OS === "ios") {
    const openSheet = () => {
      const labels = SOCIAL_LINK_TYPES.map((t) => SOCIAL_LINK_META[t].label);
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...labels, "Cancel"], cancelButtonIndex: labels.length },
        (index) => {
          if (index < SOCIAL_LINK_TYPES.length) {
            onChange(SOCIAL_LINK_TYPES[index]);
          }
        },
      );
    };
    return (
      <Pressable
        onPress={openSheet}
        style={containerStyle}
        accessibilityRole="button"
        accessibilityLabel={`Platform: ${SOCIAL_LINK_META[value].label}`}
        accessibilityHint="Opens a list of platforms to choose from"
      >
        <SocialLinkIcon type={value} size={20} />
      </Pressable>
    );
  }

  // Android & web: native Picker overlaid (opacity 0) on the icon — tapping the
  // icon area opens the OS dialog on Android and the native <select> on web.
  return (
    <View style={containerStyle}>
      <SocialLinkIcon type={value} size={20} />
      <Picker
        selectedValue={value}
        onValueChange={(v) => onChange(v as SocialLinkType)}
        mode="dialog"
        dropdownIconColor="transparent"
        style={{
          position: "absolute",
          opacity: 0,
          width: "100%",
          height: "100%",
        }}
      >
        {SOCIAL_LINK_TYPES.map((type) => (
          <Picker.Item
            key={type}
            label={SOCIAL_LINK_META[type].label}
            value={type}
          />
        ))}
      </Picker>
    </View>
  );
}

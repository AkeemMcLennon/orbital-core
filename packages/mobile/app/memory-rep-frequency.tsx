import React from "react";
import { Pressable, Text, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../src/theme";
import { ErrorState } from "../src/components/ErrorState";
import {
  usePreferences,
  useUpdatePreferences,
} from "../src/queries/preferences";

const PRESETS: { label: string; hours: number }[] = [
  { label: "Immediately", hours: 0 },
  { label: "1 day", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
  { label: "2 weeks", hours: 336 },
  { label: "30 days", hours: 720 },
];

export default function MemoryRepFrequencyScreen() {
  const { data, isLoading, error, refetch } = usePreferences();
  // Save failures surface via the hook's onError toast.
  const { mutate: updatePrefs, isPending } = useUpdatePreferences();

  const currentHours = data?.memRepInitialDelayHours;
  const isCustom =
    currentHours !== undefined &&
    !PRESETS.some((p) => p.hours === currentHours);

  const rows = isCustom
    ? [...PRESETS, { label: `Custom (${currentHours}h)`, hours: currentHours }]
    : PRESETS;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text
          style={{ fontSize: 24, fontWeight: "700", color: colors.textMain }}
        >
          Memory Rep Frequency
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: colors.textSecondary,
            marginTop: spacing.xs,
            lineHeight: 20,
          }}
        >
          How long after adding a contact before their memory reps start
          appearing.
        </Text>
      </View>

      {isLoading ? (
        <View style={{ paddingVertical: spacing.xl, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <ErrorState
          error={error}
          title="Couldn't load your setting"
          onRetry={refetch}
        />
      ) : (
        <View style={{ paddingTop: spacing.md }}>
          {rows.map((preset) => {
            const isSelected = currentHours === preset.hours;
            const isCustomRow = isCustom && preset.hours === currentHours;
            return (
              <Pressable
                key={preset.hours}
                disabled={isPending || isCustomRow || isSelected}
                onPress={() =>
                  updatePrefs({ memRepInitialDelayHours: preset.hours })
                }
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  backgroundColor: pressed ? colors.border : colors.bg,
                })}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: colors.textMain,
                    fontWeight: isSelected ? "600" : "400",
                  }}
                >
                  {preset.label}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark" size={22} color={colors.primary} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

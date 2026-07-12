import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { colors, spacing, borderRadius, typography } from "../theme";
import { WelcomeSlide } from "./slides/WelcomeSlide";
import { ImportSlide } from "./slides/ImportSlide";
import { NotesSlide } from "./slides/NotesSlide";
import { MemoryRepsSlide } from "./slides/MemoryRepsSlide";

const SLIDES: { key: string; Component: React.ComponentType }[] = [
  { key: "welcome", Component: WelcomeSlide },
  { key: "import", Component: ImportSlide },
  { key: "notes", Component: NotesSlide },
  { key: "memory", Component: MemoryRepsSlide },
];

/** A single full-width page with a subtle parallax fade tied to scroll. */
function Page({
  index,
  scrollX,
  width,
  children,
}: {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
  children: React.ReactNode;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const input = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      opacity: interpolate(
        scrollX.value,
        input,
        [0.3, 1, 0.3],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateY: interpolate(
            scrollX.value,
            input,
            [24, 0, 24],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  return (
    <View style={{ width }}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        {children}
      </Animated.View>
    </View>
  );
}

/** An animated pagination dot that widens/brightens for the active page. */
function Dot({
  index,
  scrollX,
  width,
}: {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const input = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.value, input, [8, 24, 8], Extrapolation.CLAMP),
      opacity: interpolate(
        scrollX.value,
        input,
        [0.3, 1, 0.3],
        Extrapolation.CLAMP,
      ),
    };
  });

  return (
    <Animated.View
      style={[
        { height: 8, borderRadius: 4, backgroundColor: colors.primary },
        animatedStyle,
      ]}
    />
  );
}

/**
 * Full-screen, swipeable intro carousel. Calls `onDone` when the user finishes
 * (last slide) or skips.
 */
export function IntroCarousel({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const scrollX = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const [index, setIndex] = useState(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const isLast = index === SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      onDone();
      return;
    }
    const next = index + 1;
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Skip */}
      <View
        style={{
          height: 44,
          justifyContent: "center",
          alignItems: "flex-end",
          paddingHorizontal: spacing.lg,
        }}
      >
        {!isLast && (
          <Pressable
            onPress={onDone}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip intro"
          >
            <Text
              style={{
                fontSize: typography.base,
                color: colors.textSecondary,
                fontWeight: "500",
              }}
            >
              Skip
            </Text>
          </Pressable>
        )}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumEnd}
        style={{ flex: 1 }}
      >
        {SLIDES.map(({ key, Component }, i) => (
          <Page key={key} index={i} scrollX={scrollX} width={width}>
            <Component />
          </Page>
        ))}
      </Animated.ScrollView>

      {/* Footer: dots + primary action */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.lg,
          gap: spacing.lg,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            gap: spacing.sm,
            justifyContent: "center",
          }}
        >
          {SLIDES.map((slide, i) => (
            <Dot key={slide.key} index={i} scrollX={scrollX} width={width} />
          ))}
        </View>

        <Pressable
          onPress={handleNext}
          accessibilityRole="button"
          style={{
            backgroundColor: colors.primary,
            borderRadius: borderRadius.lg,
            paddingVertical: spacing.md,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: colors.card,
              fontWeight: "600",
              fontSize: typography.base,
            }}
          >
            {isLast ? "Get started" : "Next"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

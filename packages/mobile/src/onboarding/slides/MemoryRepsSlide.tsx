import React from "react";
import { View } from "react-native";
import { QuizCard } from "../../components/QuizCard";
import { useResponsivePreviewSpacing } from "../useResponsivePreviewSpacing";
import { SlideLayout } from "./SlideLayout";

// Stock photo so the preview shows a face instead of an initials fallback.
const EXAMPLE_AVATAR_URL = "https://i.pravatar.cc/300?img=47";

/**
 * Memory Reps slide: shows a real QuizCard "identify" (face) preview and
 * explains that adding a contact seeds spaced-repetition quizzes drawn from
 * their face and the notes you save.
 */
export function MemoryRepsSlide() {
  const previewSpacing = useResponsivePreviewSpacing();

  return (
    <SlideLayout
      title="Never forget a face"
      subtitle="Every new contact turns into a quick quiz, so names and faces stick before you meet again."
      previewSpacing={previewSpacing}
    >
      <View>
        <QuizCard
          question="Who is this?"
          questionType="identify"
          contactName="Maya Chen"
          contactAvatarUrl={EXAMPLE_AVATAR_URL}
          options={["Maya Chen", "Priya Rao", "Sam Ortiz", "Lena Park"]}
          correctAnswer={0}
        />
      </View>
    </SlideLayout>
  );
}

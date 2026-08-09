import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { spacing, colors, borderRadius, shadows } from "../theme";
import { FaceAvatar } from "./FaceAvatar";

interface QuizCardProps {
  question: string;
  options: string[];
  correctAnswer: number;
  contactName: string;
  questionType?: "detail" | "identify";
  contactAvatarUrl?: string | null;
  onAnswer?: (selectedAnswer: number, isCorrect: boolean) => void;
}

export const QuizCard: React.FC<QuizCardProps> = ({
  question,
  options,
  correctAnswer,
  contactName,
  questionType = "detail",
  contactAvatarUrl,
  onAnswer,
}) => {
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  const isIdentify = questionType === "identify";

  const handleAnswer = (index: number) => {
    if (!answered) {
      setSelectedAnswer(index);
      setAnswered(true);
      onAnswer?.(index, index === correctAnswer);
    }
  };

  const getButtonStyle = (index: number) => {
    const isSelected = selectedAnswer === index;
    const isCorrect = index === correctAnswer;

    if (!answered) {
      return {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
      };
    }

    if (isSelected && isCorrect) {
      return {
        backgroundColor: colors.success,
        borderColor: colors.success,
      };
    }

    if (isSelected && !isCorrect) {
      return {
        backgroundColor: colors.error,
        borderColor: colors.error,
      };
    }

    if (isCorrect) {
      return {
        backgroundColor: colors.success,
        borderColor: colors.success,
      };
    }

    return {
      backgroundColor: colors.border,
      borderColor: colors.border,
    };
  };

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        ...shadows.md,
        marginBottom: spacing.lg,
      }}
    >
      {isIdentify ? (
        /* Identify question: show avatar + "Who is this person?" */
        <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
          <FaceAvatar
            name={contactName}
            avatar={contactAvatarUrl}
            size={120}
            showLabel={false}
            noMargin
          />
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: colors.textMain,
              marginTop: spacing.md,
              lineHeight: 22,
            }}
          >
            {question}
          </Text>
        </View>
      ) : (
        /* Detail question: show contact name label + question text */
        <>
          <Text
            style={{
              fontSize: 12,
              color: colors.textTertiary,
              marginBottom: spacing.sm,
              fontWeight: "500",
            }}
          >
            {contactName.toUpperCase()}
          </Text>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: colors.textMain,
              marginBottom: spacing.lg,
              lineHeight: 22,
            }}
          >
            {question}
          </Text>
        </>
      )}

      {/* Options grid (2x2) */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing.md,
          justifyContent: "space-between",
        }}
      >
        {options.map((option, index) => {
          const buttonStyle = getButtonStyle(index);
          const isSelected = selectedAnswer === index;
          const isCorrect = index === correctAnswer;

          return (
            <Pressable
              key={index}
              onPress={() => handleAnswer(index)}
              // Announced as an answer choice rather than a bare string — for
              // identify questions the options are contact names, which also
              // appear in the Face Stream and timeline on the same screen.
              accessibilityRole="button"
              accessibilityLabel={`Memory rep answer: ${option}`}
              disabled={answered}
              style={{
                flex: 1,
                minWidth: "45%",
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.md,
                borderRadius: borderRadius.md,
                backgroundColor: buttonStyle.backgroundColor,
                borderWidth: 1,
                borderColor: buttonStyle.borderColor,
                opacity: answered && !isSelected && !isCorrect ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  textAlign: "center",
                  color:
                    buttonStyle.backgroundColor === colors.border
                      ? colors.textSecondary
                      : colors.card,
                  fontWeight: "500",
                  fontSize: 13,
                }}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Feedback message */}
      {answered && (
        <Text
          style={{
            marginTop: spacing.lg,
            textAlign: "center",
            fontSize: 13,
            color:
              selectedAnswer === correctAnswer ? colors.success : colors.error,
            fontWeight: "500",
          }}
        >
          {selectedAnswer === correctAnswer
            ? "✓ Correct!"
            : isIdentify
              ? `✗ This is ${contactName}`
              : "✗ Incorrect"}
        </Text>
      )}
    </View>
  );
};

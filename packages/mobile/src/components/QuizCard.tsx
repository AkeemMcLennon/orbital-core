import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { spacing, colors, borderRadius, shadows } from '../theme';

interface QuizCardProps {
  question: string;
  options: string[];
  correctAnswer: number;
  contactName: string;
  onAnswer?: (isCorrect: boolean) => void;
}

export const QuizCard: React.FC<QuizCardProps> = ({
  question,
  options,
  correctAnswer,
  contactName,
  onAnswer,
}) => {
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  const handleAnswer = (index: number) => {
    if (!answered) {
      setSelectedAnswer(index);
      setAnswered(true);
      onAnswer?.(index === correctAnswer);
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
      {/* Contact name */}
      <Text
        style={{
          fontSize: 12,
          color: colors.textTertiary,
          marginBottom: spacing.sm,
          fontWeight: '500',
        }}
      >
        {contactName.toUpperCase()}
      </Text>

      {/* Question */}
      <Text
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: colors.textMain,
          marginBottom: spacing.lg,
          lineHeight: 22,
        }}
      >
        {question}
      </Text>

      {/* Options grid (2x2) */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.md,
          justifyContent: 'space-between',
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
              disabled={answered}
              style={{
                flex: 1,
                minWidth: '45%',
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
                  textAlign: 'center',
                  color:
                    buttonStyle.backgroundColor === colors.border
                      ? colors.textSecondary
                      : colors.card,
                  fontWeight: '500',
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
            textAlign: 'center',
            fontSize: 13,
            color: selectedAnswer === correctAnswer ? colors.success : colors.error,
            fontWeight: '500',
          }}
        >
          {selectedAnswer === correctAnswer ? '✓ Correct!' : '✗ Incorrect'}
        </Text>
      )}
    </View>
  );
};

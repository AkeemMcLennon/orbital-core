import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { RelativePathString, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FaceAvatar, QuizCard, TimelineItem } from "../../src/components";
import { contactKeys, useContactsList } from "../../src/queries/contacts";
import {
  memoryRepKeys,
  useMemoryRepsList,
  useAnswerMemoryRep,
} from "../../src/queries/memory-reps";
import { borderRadius, colors, shadows, spacing } from "../../src/theme";

export default function DailyOrbitScreen() {
  const [searchText, setSearchText] = useState("");
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  useFocusEffect(
    useCallback(() => {
      queryClient.refetchQueries({
        queryKey: contactKeys.all,
        type: "inactive",
      });
      queryClient.refetchQueries({
        queryKey: memoryRepKeys.all,
        type: "inactive",
      });
    }, [queryClient]),
  );

  const { data: contactsData, isLoading, error } = useContactsList({ limit: 50, offset: 0, sort: "date" });
  const contacts = contactsData?.items || [];

  const {
    data: repsData,
    isLoading: repsLoading,
    error: repsError,
  } = useMemoryRepsList();
  const answerMutation = useAnswerMemoryRep();
  const memoryReps = (repsData?.items || []).filter(
    (rep) => !answeredIds.has(rep.id),
  );

  const renderFaceStreamItem = (contact: (typeof contacts)[0]) => {
    const path = `/contacts/${contact.id}` as RelativePathString;
    return (
      <FaceAvatar
        key={contact.id}
        name={contact.name}
        avatar={contact.avatarUrl ?? undefined}
        href={path}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Pressable onPress={() => (navigation as any).openDrawer()}>
            <Ionicons name="menu" size={24} color={colors.textMain} />
          </Pressable>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: colors.textMain,
            }}
          >
            Orbital
          </Text>
          <Image
            source={{
              uri: "https://ui-avatars.com/api/?name=You&background=4F46E5&color=fff",
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: borderRadius.full,
            }}
          />
        </View>

        {/* Search Bar */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginBottom: spacing.lg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.card,
              borderRadius: borderRadius.full,
              paddingHorizontal: spacing.md,
              borderColor: colors.border,
              borderWidth: 1,
              ...shadows.sm,
            }}
          >
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              placeholder="Search contacts..."
              placeholderTextColor={colors.textTertiary}
              value={searchText}
              onChangeText={setSearchText}
              style={{
                flex: 1,
                paddingLeft: spacing.sm,
                paddingVertical: spacing.sm,
                color: colors.textMain,
                fontSize: 14,
              }}
            />
          </View>
        </View>

        {/* Face Stream (Horizontal Scroll) */}
        <View
          style={{
            marginBottom: spacing.xl,
          }}
        >
          <Text
            style={{
              marginLeft: spacing.lg,
              marginBottom: spacing.md,
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMain,
            }}
          >
            Today's People
          </Text>
          {isLoading ? (
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                justifyContent: "center",
                alignItems: "center",
                height: 100,
              }}
            >
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : error ? (
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
              }}
            >
              <Text style={{ color: colors.error, textAlign: "center" }}>
                Failed to load contacts. Please check your connection.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: spacing.lg,
              }}
            >
              <FaceAvatar
                name="+"
                avatar=""
                isAddButton
                href={"/contact-add" as any}
              />
              {contacts.map((contact) =>
                renderFaceStreamItem(contact),
              )}
            </ScrollView>
          )}
        </View>

        {/* Memory Reps (Quiz Cards) */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginBottom: spacing.xl,
          }}
        >
          <Text
            style={{
              marginBottom: spacing.md,
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMain,
            }}
          >
            Memory Reps
          </Text>
          {repsLoading ? (
            <View
              style={{
                paddingVertical: spacing.lg,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : repsError ? (
            <Text
              style={{
                color: colors.error,
                textAlign: "center",
                paddingVertical: spacing.md,
              }}
            >
              Failed to load memory reps.
            </Text>
          ) : memoryReps.length === 0 ? (
            <View
              style={{
                alignItems: "center",
                paddingVertical: spacing.xl,
                paddingHorizontal: spacing.lg,
              }}
            >
              <Ionicons
                name="school-outline"
                size={36}
                color={colors.textTertiary}
              />
              <Text
                style={{
                  color: colors.textSecondary,
                  textAlign: "center",
                  marginTop: spacing.md,
                  fontSize: 14,
                  lineHeight: 20,
                }}
              >
                Quizzes and reminders will appear here as you add new contacts.
              </Text>
            </View>
          ) : (
            memoryReps.map((rep) => (
              <QuizCard
                key={rep.id}
                question={rep.question}
                options={rep.options}
                correctAnswer={rep.correctAnswer}
                contactName={rep.contactName}
                questionType={rep.questionType as "detail" | "identify"}
                contactAvatarUrl={rep.contactAvatarUrl}
                onAnswer={(selectedAnswer, _isCorrect) => {
                  answerMutation.mutate({ id: rep.id, selectedAnswer });
                  setTimeout(() => {
                    setAnsweredIds((prev) => new Set(prev).add(rep.id));
                  }, 2500);
                }}
              />
            ))
          )}
        </View>

        {/* Timeline Section */}
        <View
          style={{
            marginHorizontal: spacing.lg,
          }}
        >
          <Text
            style={{
              marginBottom: spacing.md,
              fontSize: 14,
              fontWeight: "600",
              color: colors.textMain,
            }}
          >
            Recent Activity
          </Text>
          {contacts.map((item, index) => (
            <TimelineItem
              key={item.id}
              contactName={item.name}
              avatar={item.avatarUrl ?? undefined}
              time={(item.lastInteractionAt || item.createdAt) as string}
              description={item.notes ?? ""}
              type="interaction"
              isLast={index === contacts.length - 1}
              href={`/contacts/${item.id}` as any}
            />
          ))}
        </View>
      </ScrollView>

      {/* Floating Command Button */}
      <Pressable
        style={{
          position: "absolute",
          bottom: spacing.lg,
          left: spacing.lg,
          right: spacing.lg,
          backgroundColor: colors.textMain,
          borderRadius: borderRadius.full,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          ...shadows.lg,
        }}
      >
        <Ionicons name="chatbubble-ellipses" size={18} color={colors.card} />
        <Text
          style={{
            color: colors.card,
            marginLeft: spacing.sm,
            fontSize: 14,
            fontWeight: "600",
          }}
        >
          Ask Orbital
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

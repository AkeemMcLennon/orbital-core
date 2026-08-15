import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { Redirect, RelativePathString, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  FaceAvatar,
  QuizCard,
  SearchDialog,
  TimelineItem,
} from "../../src/components";
import { useAuthContext } from "../../src/contexts/AuthContext";
import {
  onboardingCompletedCached,
  readOnboardingCompleted,
} from "../../src/onboarding/completion";
import { contactKeys, useContactsList } from "../../src/queries/contacts";
import {
  memoryRepKeys,
  useMemoryRepsList,
  useAnswerMemoryRep,
  useGenerateMemoryReps,
} from "../../src/queries/memory-reps";
import { ErrorState } from "../../src/components/ErrorState";
import { borderRadius, colors, shadows, spacing } from "../../src/theme";

/**
 * Root-route onboarding gate: send first-run users to the intro tour. Renders
 * the dashboard while the flag is still being read so the cold-start splash /
 * a returning user never see a blank frame.
 */
function useShouldOnboard(): boolean {
  const [completed, setCompleted] = useState<boolean | null>(
    onboardingCompletedCached(),
  );

  useEffect(() => {
    if (completed !== null) return;
    let cancelled = false;
    readOnboardingCompleted().then((value) => {
      if (!cancelled) setCompleted(value);
    });
    return () => {
      cancelled = true;
    };
  }, [completed]);

  return completed === false;
}

export default function DailyOrbitRoute() {
  if (useShouldOnboard()) return <Redirect href="/onboarding" />;
  return <DailyOrbitScreen />;
}

function DailyOrbitScreen() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigation = useNavigation();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.refetchQueries({ queryKey: contactKeys.all }),
      queryClient.refetchQueries({ queryKey: memoryRepKeys.all }),
    ]);
    setIsRefreshing(false);
  }, [queryClient]);

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
      queryClient.invalidateQueries({ queryKey: memoryRepKeys.all });
    }, [queryClient]),
  );

  const {
    data: contactsData,
    isLoading,
    error,
    refetch: refetchContacts,
  } = useContactsList({ limit: 50, offset: 0, sort: "date" });
  const contacts = contactsData?.items || [];

  const {
    data: repsData,
    isLoading: repsLoading,
    error: repsError,
    refetch: refetchReps,
  } = useMemoryRepsList();
  const answerMutation = useAnswerMemoryRep();
  const { mutate: generateReps, isPending: isGenerating } =
    useGenerateMemoryReps();
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
        // Twice xxl, not xxl: the floating "Ask Orbital" pill (absolute,
        // bottom 24 + ~56 tall) overlays the viewport bottom, so anything
        // inside the last ~80px of content — the final timeline entry, a low
        // quiz card's feedback line — could never scroll out from behind it.
        contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
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
          <Pressable
            onPress={() => (navigation as any).openDrawer()}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
          >
            <Ionicons name="menu" size={24} color={colors.textMain} />
          </Pressable>
          <Text
            accessibilityRole="header"
            // "Orbital" alone is a weak anchor — the search bar below reads
            // "Ask Orbital".
            accessibilityLabel="Orbital dashboard"
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: colors.textMain,
            }}
          >
            Orbital
          </Text>
          <FaceAvatar
            name={user?.name || "User"}
            size={36}
            showLabel={false}
            noMargin={true}
            onPress={() => (navigation as any).openDrawer()}
          />
        </View>

        {/* Search Bar */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginBottom: spacing.lg,
          }}
        >
          <Pressable
            onPress={() => setSearchOpen(true)}
            accessibilityRole="button"
            // Named explicitly: the placeholder Text below is the bar's only
            // other accessible name, and the dialog this opens uses the very
            // same string for its real input.
            accessibilityLabel="Open contact search"
            // Hidden while the search dialog is open so it can't peek out behind it.
            pointerEvents={searchOpen ? "none" : "auto"}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.card,
              borderRadius: borderRadius.full,
              paddingHorizontal: spacing.md,
              borderColor: colors.border,
              borderWidth: 1,
              opacity: searchOpen ? 0 : 1,
              ...shadows.sm,
            }}
          >
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <Text
              style={{
                flex: 1,
                paddingLeft: spacing.sm,
                paddingVertical: spacing.sm + 2,
                color: colors.textTertiary,
                fontSize: 14,
              }}
            >
              Search contacts...
            </Text>
          </Pressable>
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
            <ErrorState
              error={error}
              title="Couldn't load contacts"
              onRetry={refetchContacts}
              compact
            />
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
              {contacts.map((contact) => renderFaceStreamItem(contact))}
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
            <ErrorState
              error={repsError}
              title="Couldn't load memory reps"
              onRetry={refetchReps}
              compact
            />
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
              <Pressable
                onPress={() => generateReps({})}
                disabled={isGenerating}
                style={{
                  marginTop: spacing.md,
                  backgroundColor: colors.primary,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.lg,
                  borderRadius: borderRadius.full,
                  opacity: isGenerating ? 0.7 : 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                {isGenerating && (
                  <ActivityIndicator size="small" color="#fff" />
                )}
                <Text
                  style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}
                >
                  Generate Quizzes
                </Text>
              </Pressable>
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
                  // The hook's own onError raises the toast, so plain `mutate`
                  // is enough here: several cards are live at once and each
                  // disables only itself, and react-query drops a *mutate*
                  // call's callbacks once a newer call supersedes it — the
                  // hook-level handler isn't subject to that.
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
              time={item.lastInteractionAt || item.createdAt}
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

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </SafeAreaView>
  );
}

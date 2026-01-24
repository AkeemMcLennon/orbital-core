import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { getContacts } from "@orbital/client";
import { FaceAvatar, TimelineItem, QuizCard } from "../../src/components";
import { timelineItems, quizCards } from "../../src/dummy-data";
import { colors, spacing, borderRadius, shadows } from "../../src/theme";

export default function DailyOrbitScreen() {
  const [searchText, setSearchText] = useState("");
  const navigation = useNavigation();

  // Fetch contacts from API
  const {
    data: contactsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => getContacts({ limit: 50, offset: 0, sort: "date" }),
    throwOnError: false,
  });

  const contacts = contactsData?.status === 200 ? contactsData.data.items : [];

  const renderFaceStreamItem = (
    contact: (typeof contacts)[0],
    index: number,
  ) => {
    console.log(`Render ${contact}`);
    return (
      <FaceAvatar
        key={contact.id}
        name={contact.name}
        avatar={contact.avatarUrl}
        onPress={() => alert(`Tapped ${contact.name}`)}
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
                onPress={() => router.push("/contact-add")}
              />
              {contacts.map((contact) =>
                renderFaceStreamItem(contact, contacts.indexOf(contact)),
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
          {quizCards.map((quiz) => (
            <QuizCard
              key={quiz.id}
              question={quiz.question}
              options={quiz.options}
              correctAnswer={quiz.correctAnswer}
              contactName={quiz.contactName}
              onAnswer={(isCorrect) => {
                console.log(`Answer: ${isCorrect ? "Correct" : "Incorrect"}`);
              }}
            />
          ))}
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
              avatar={item.avatarUrl}
              time={item.lastInteractionAt || item.createdAt}
              description={item.notes}
              type="interaction"
              isLast={index === timelineItems.length - 1}
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

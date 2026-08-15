import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, router } from "expo-router";
import { DrawerActions } from "@react-navigation/native";
import { Tag } from "../../../src/components";
import { useTags, useCreateTag, useDeleteTag } from "../../../src/queries/tags";
import { EmptyState } from "../../../src/components/EmptyState";
import { ErrorState } from "../../../src/components/ErrorState";
import { colors, spacing, borderRadius, shadows } from "../../../src/theme";

export default function TagsScreen() {
  const navigation = useNavigation();
  const [isEditing, setIsEditing] = useState(false);
  const [input, setInput] = useState("");

  const { data: tags, isLoading, error, refetch } = useTags();
  const createMutation = useCreateTag();
  const deleteMutation = useDeleteTag();

  const addTag = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (tags?.some((t) => t.name.toLowerCase() === trimmed.toLowerCase()))
      return;
    // mutateAsync, not a mutate-level onError: nothing stops a second add while
    // this one is in flight, and react-query drops a mutate call's callbacks
    // once a newer call supersedes it — this promise is retained per add.
    createMutation.mutateAsync({ name: trimmed }).catch(() => {
      // The input is cleared optimistically below; put the text back on
      // failure so the user doesn't silently lose what they typed — but only
      // if the box is still empty, since a delayed failure must not clobber
      // the next tag they've already started typing.
      setInput((current) => (current === "" ? trimmed : current));
    });
    setInput("");
  };

  const handleChangeText = (text: string) => {
    if (text.endsWith(",")) {
      addTag(text.slice(0, -1));
    } else {
      setInput(text);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <Pressable
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          style={{ marginRight: spacing.md }}
          hitSlop={8}
        >
          <Ionicons name="menu" size={24} color={colors.textMain} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            fontSize: 18,
            fontWeight: "700",
            color: colors.textMain,
          }}
        >
          Tags
        </Text>
        {isEditing ? (
          <Pressable
            onPress={() => {
              setIsEditing(false);
              setInput("");
            }}
            hitSlop={8}
          >
            <Text
              style={{ fontSize: 15, fontWeight: "600", color: colors.primary }}
            >
              Done
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setIsEditing(true)}
            accessibilityRole="button"
            accessibilityLabel="Edit tags"
            hitSlop={8}
          >
            <Ionicons name="pencil" size={20} color={colors.primary} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        // Previously fell through to the empty state, which read as
        // "you have no tags" when the request had actually failed.
        <ErrorState
          error={error}
          title="Couldn't load tags"
          onRetry={refetch}
        />
      ) : !tags || tags.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            icon="pricetag-outline"
            title={isEditing ? "Add your first tag below." : "No tags yet."}
            message={isEditing ? undefined : "Tap the pencil to add one."}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.sm,
            }}
          >
            {tags.map((tag) =>
              isEditing ? (
                <Tag
                  key={tag.id}
                  name={tag.name}
                  color={tag.color}
                  size="large"
                  onRemove={() =>
                    // The hook's onError raises the toast; plain mutate is
                    // fine because that handler isn't dropped when a second
                    // removal supersedes this one.
                    deleteMutation.mutate(tag.id)
                  }
                />
              ) : (
                <Pressable
                  key={tag.id}
                  onPress={() =>
                    router.push({
                      pathname: "/tags/[id]" as any,
                      params: { id: tag.id, name: tag.name },
                    })
                  }
                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                >
                  <Tag name={tag.name} color={tag.color} size="large" />
                </Pressable>
              ),
            )}
          </View>
        </ScrollView>
      )}

      {/* Add tag input — only visible in edit mode */}
      {isEditing && (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.bg,
              borderRadius: borderRadius.md,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              ...shadows.sm,
            }}
          >
            <Ionicons
              name="add"
              size={18}
              color={colors.textTertiary}
              style={{ marginRight: spacing.sm }}
            />
            <TextInput
              value={input}
              onChangeText={handleChangeText}
              onSubmitEditing={() => addTag(input)}
              blurOnSubmit={false}
              placeholder="Add tag…"
              placeholderTextColor={colors.textTertiary}
              style={{ flex: 1, fontSize: 15, color: colors.textMain }}
              autoCapitalize="none"
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

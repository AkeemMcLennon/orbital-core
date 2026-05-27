import React, { useState } from "react";
import { View, TextInput } from "react-native";
import { Tag } from "./Tag";
import { colors, spacing, borderRadius, shadows } from "../theme";

export interface TagItem {
  name: string;
  isDynamic?: boolean;
  color?: string | null;
}

interface TagEditorProps {
  tags: TagItem[];
  onChange: (tags: TagItem[]) => void;
}

export function TagEditor({ tags, onChange }: TagEditorProps) {
  const [input, setInput] = useState("");

  const addTag = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed && !tags.some((t) => t.name === trimmed)) {
      onChange([...tags, { name: trimmed }]);
    }
    setInput("");
  };

  const handleChangeText = (text: string) => {
    if (text.endsWith(",")) {
      addTag(text.slice(0, -1));
    } else {
      setInput(text);
    }
  };

  const handleSubmit = () => {
    addTag(input);
  };

  const removeTag = (name: string) => {
    onChange(tags.filter((t) => t.name !== name));
  };

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: borderRadius.md,
        borderColor: colors.border,
        borderWidth: 1,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: spacing.xs,
        minHeight: 48,
        ...shadows.sm,
      }}
    >
      {tags.map((tag) => (
        <Tag
          key={tag.name}
          name={tag.name}
          isDynamic={tag.isDynamic}
          color={tag.color}
          onRemove={() => removeTag(tag.name)}
        />
      ))}
      <TextInput
        value={input}
        onChangeText={handleChangeText}
        onSubmitEditing={handleSubmit}
        blurOnSubmit={false}
        placeholder={tags.length === 0 ? "Add tags, separated by commas..." : ""}
        placeholderTextColor={colors.textTertiary}
        style={{
          flex: 1,
          minWidth: 120,
          fontSize: 14,
          color: colors.textMain,
          paddingVertical: spacing.xs,
        }}
      />
    </View>
  );
}

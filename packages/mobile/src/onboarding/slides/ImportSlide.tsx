import React from "react";
import { View } from "react-native";
import { SourceCard } from "../../components/SourceCard";
import { IMPORT_SOURCES } from "../constants";
import { SlideLayout } from "./SlideLayout";

/**
 * Import slide: demonstrates that contacts come in by *sharing* — a social
 * link, a screenshot, or a vCard — reusing the real SourceCard component.
 */
export function ImportSlide() {
  return (
    <SlideLayout
      title="Add people by sharing"
      subtitle="From any app, share a profile link, a screenshot, or a contact card — we'll turn it into a contact for you."
    >
      <View>
        {IMPORT_SOURCES.map((source) => (
          <SourceCard
            key={source.title}
            icon={source.icon}
            iconColor={source.iconColor}
            title={source.title}
            description={source.description}
            showChevron={false}
          />
        ))}
      </View>
    </SlideLayout>
  );
}

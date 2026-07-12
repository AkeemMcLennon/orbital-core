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
      title="Adding people is easy"
      subtitle="No typing required. Share a profile or screenshot and we'll fill in the details."
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

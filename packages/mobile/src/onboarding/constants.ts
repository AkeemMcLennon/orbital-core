import { Ionicons } from "@expo/vector-icons";

/**
 * Storage flag marking that the intro tour has been completed. Versioned so a
 * future redesign can re-trigger onboarding for everyone by bumping the suffix.
 */
export const ONBOARDING_KEY = "onboarding_completed_v1";

export interface ImportSourcePreview {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  description: string;
}

/** Import sources shown (non-interactively) on the import slide. */
export const IMPORT_SOURCES: ImportSourcePreview[] = [
  {
    icon: "link-outline",
    title: "Share a social link",
    description: "Paste a LinkedIn, Instagram or X profile URL.",
  },
  {
    icon: "camera-outline",
    title: "Share a screenshot",
    description: "A profile screenshot — we read the face and details.",
  },
  {
    icon: "person-outline",
    title: "Share a contact card",
    description: "Send a vCard (.vcf) straight from your phone.",
  },
];

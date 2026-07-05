// Design tokens from the Daily Orbit specification
export const colors = {
  primary: "#4F46E5",
  primaryLight: "#EEF2FF",

  bg: "#F8FAFC",
  bgAlt: "#F1F5F9",
  card: "#FFFFFF",
  border: "#E2E8F0",

  textMain: "#0F172A",
  textSecondary: "#64748B",
  textTertiary: "#94A3B8",

  success: "#10B981",
  successLight: "#6EE7B7",
  warning: "#F59E0B",
  error: "#EF4444",
  errorLight: "#FCA5A5",

  indigo: "#4F46E5",
  slate: "#64748B",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
};

export const typography = {
  // Font sizes
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
};

export const inputStyle = {
  backgroundColor: colors.card,
  borderRadius: borderRadius.md,
  borderColor: colors.border,
  borderWidth: 1,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
  color: colors.textMain,
  fontSize: 14,
  ...shadows.sm,
} as const;

// Helper function to create styled view props
export const getStyleProps = (
  variant: "card" | "input" | "button" = "card",
) => {
  switch (variant) {
    case "card":
      return {
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        borderColor: colors.border,
        borderWidth: 1,
        ...shadows.md,
      };
    case "input":
      return {
        backgroundColor: colors.bg,
        borderRadius: borderRadius.md,
        borderColor: colors.border,
        borderWidth: 1,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      };
    case "button":
      return {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
      };
    default:
      return {};
  }
};

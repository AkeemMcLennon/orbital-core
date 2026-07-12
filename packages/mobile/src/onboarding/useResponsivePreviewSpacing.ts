import { useWindowDimensions } from "react-native";
import { spacing } from "../theme";

const MIN_PREVIEW_SPACING = spacing.sm;
const MAX_PREVIEW_SPACING = spacing.xl;
const PREVIEW_SPACING_RATIO = 0.035;

/**
 * Preview-to-title gap for a SlideLayout that scales with screen height:
 * tight on short devices so the title fits without scrolling, capped at the
 * roomier default (spacing.xl) on tall ones.
 */
export function useResponsivePreviewSpacing(): number {
  const { height } = useWindowDimensions();
  return Math.min(
    MAX_PREVIEW_SPACING,
    Math.max(MIN_PREVIEW_SPACING, height * PREVIEW_SPACING_RATIO),
  );
}

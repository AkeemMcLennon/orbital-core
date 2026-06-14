import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { getSocialLinkMeta } from "../utils/socialLinks";

interface SocialLinkIconProps {
  type: string;
  size?: number;
  // Defaults to the platform's brand color; override for tinted contexts
  // (e.g. white on a colored card).
  color?: string;
}

export function SocialLinkIcon({
  type,
  size = 20,
  color,
}: SocialLinkIconProps) {
  const meta = getSocialLinkMeta(type);
  return <Ionicons name={meta.icon} size={size} color={color ?? meta.color} />;
}

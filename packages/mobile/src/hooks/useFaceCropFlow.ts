import { useEffect, useRef } from "react";
import { Image } from "react-native";
import { router } from "expo-router";
import * as ImageManipulator from "expo-image-manipulator";
import ExpoImageCropTool from "@bsky.app/expo-image-crop-tool";
import { useFacesInPhoto } from "@infinitered/react-native-mlkit-face-detection";
import type { RNMLKitFace } from "@infinitered/react-native-mlkit-face-detection";
import { useExtractImageQuery } from "./useExtractImageQuery";

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) =>
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject),
  );
}

/**
 * Computes a padded crop region around a face, clamped to image bounds. The
 * region is square unless the image is too small in one dimension to fit the
 * full side length, in which case it's clamped to what fits.
 */
export function computeSquareCrop(
  frame: RNMLKitFace["frame"],
  imgW: number,
  imgH: number,
): { originX: number; originY: number; width: number; height: number } {
  const side = Math.max(frame.size.x, frame.size.y);
  const padding = side * 0.4;
  const squareSide = side + padding * 2;

  const originX = Math.max(
    0,
    Math.min(frame.origin.x - padding, imgW - squareSide),
  );
  const originY = Math.max(
    0,
    Math.min(frame.origin.y - padding, imgH - squareSide),
  );

  return {
    originX,
    originY,
    width: Math.min(squareSide, imgW - originX),
    height: Math.min(squareSide, imgH - originY),
  };
}

/**
 * Picks the largest detected face, computes a padded square crop around it,
 * and returns the URI of the cropped JPEG. Returns null if cropping fails.
 */
async function cropToFace(
  imageUri: string,
  faces: RNMLKitFace[],
): Promise<string | null> {
  if (faces.length === 0) return null;

  const face = faces.reduce((best, f) =>
    f.frame.size.x * f.frame.size.y > best.frame.size.x * best.frame.size.y
      ? f
      : best,
  );

  let imgW: number;
  let imgH: number;
  try {
    ({ width: imgW, height: imgH } = await getImageSize(imageUri));
  } catch {
    return null;
  }

  const crop = computeSquareCrop(face.frame, imgW, imgH);

  try {
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ crop }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  } catch {
    return null;
  }
}

/**
 * Drives the screenshot → avatar flow: kicks off background contact extraction,
 * detects a face, and once detection settles either auto-crops to the face or
 * falls back to the manual cropper, then navigates to /contact-add.
 *
 * Must be called from a component rendered inside
 * FaceDetectionProvider.
 */
export function useFaceCropFlow(
  sharedImageUri: string,
  sharedImageMimeType?: string,
  sourceUrl?: string,
) {
  // Kick off background extraction immediately while we detect the face.
  // Result is cached in React Query — contact-add reads it on arrival.
  useExtractImageQuery(sharedImageUri, sharedImageMimeType);

  const { faces, error, status } = useFacesInPhoto(sharedImageUri);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !sharedImageUri) return;
    // Wait until detection is complete (done or error)
    if (status !== "done" && status !== "error") return;
    startedRef.current = true;

    const mimeType = sharedImageMimeType ?? "image/jpeg";
    const goToContactAdd = (croppedImageUri?: string) =>
      router.replace({
        pathname: "/contact-add",
        params: {
          sharedImageUri,
          sharedImageMimeType: mimeType,
          ...(croppedImageUri ? { croppedImageUri } : {}),
          ...(sourceUrl ? { url: sourceUrl } : {}),
        },
      });

    async function proceed() {
      // Auto-crop when a face was detected
      if (!error && faces.length > 0) {
        const croppedUri = await cropToFace(sharedImageUri, faces);
        if (croppedUri) {
          goToContactAdd(croppedUri);
          return;
        }
      }

      // No face detected or crop failed — fall back to manual crop
      try {
        const result = await ExpoImageCropTool.openCropperAsync({
          imageUri: sharedImageUri,
          format: "jpeg",
          compressImageQuality: 0.9,
          rotationEnabled: true,
        });
        goToContactAdd(result.path);
      } catch {
        // User cancelled or error — proceed without a cropped avatar
        goToContactAdd();
      }
    }

    proceed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
}

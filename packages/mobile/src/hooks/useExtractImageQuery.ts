import { useQuery } from "@tanstack/react-query";
import { File as FSFile } from "expo-file-system";
import { contactsExtractFromImage, isSuccess } from "@orbital/client";

export type ExtractedContact = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  linkedinUrl?: string;
};

function toFileUri(uri: string): string {
  if (uri.startsWith("file://") || uri.startsWith("content://")) return uri;
  return `file://${uri}`;
}

async function fileToBase64(uri: string): Promise<string> {
  return await new FSFile(toFileUri(uri)).base64();
}

const extractImageQueryKey = (uri?: string) => ["extract-image", uri] as const;

export function useExtractImageQuery(uri?: string, mimeType?: string) {
  return useQuery({
    queryKey: extractImageQueryKey(uri),
    enabled: !!uri,
    staleTime: Infinity,
    retry: 1,
    queryFn: async (): Promise<ExtractedContact> => {
      let base64: string;
      try {
        base64 = await fileToBase64(uri!);
      } catch (e) {
        console.error("[extract] file read failed:", uri, String(e));
        throw e;
      }
      const res = await contactsExtractFromImage({
        image: base64,
        mimeType: (mimeType ?? "image/jpeg") as any,
      });
      if (!isSuccess(res)) throw new Error("Extraction failed");
      return res.data as ExtractedContact;
    },
  });
}

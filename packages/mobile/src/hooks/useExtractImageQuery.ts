import { useQuery } from "@tanstack/react-query";
import { File as FSFile } from "expo-file-system";
import { contactsExtractFromImage, unwrap } from "@orbital/client";
import { toFileUri } from "../utils/fileUri";

export type ExtractedContact = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  notes?: string;
};

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
      // unwrap throws an ApiError carrying the status and server message,
      // rather than a generic "Extraction failed".
      return unwrap(res) as ExtractedContact;
    },
  });
}

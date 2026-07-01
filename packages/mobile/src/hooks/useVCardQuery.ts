import { useEffect } from "react";
import { Alert } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  materializeAvatar,
  readVCardCards,
  type ParsedVCard,
} from "../utils/vcard";

export type VCardContact = {
  card: ParsedVCard;
  avatar?: { uri: string; mimeType: string };
};

/**
 * Read + parse a shared vCard file and materialize each card's avatar.
 *
 * Owns the full pipeline: file read, parse, avatar materialization, and error
 * alerts. Consumers receive data and loading state only — no error handling
 * needed outside this hook. Both the add-contact and import screens share this
 * so the pipeline lives in one place.
 */
export function useVCardQuery(uri?: string) {
  const query = useQuery({
    queryKey: ["vcard-contacts", uri] as const,
    enabled: !!uri,
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<VCardContact[]> => {
      const cards = await readVCardCards(uri!);
      return Promise.all(
        cards.map(async (card) => ({
          card,
          avatar: await materializeAvatar(card),
        })),
      );
    },
  });

  useEffect(() => {
    if (!query.isError) return;
    Alert.alert("Couldn't read vCard", "This vCard file could not be read.");
  }, [query.isError]);

  return query;
}

import { AxGen, f } from "@ax-llm/ax";
import { getVisionAI } from "./llm";

const extractSignature = f()
  .input("profileImage", f.image("Screenshot of a social profile page or business card"))
  .output("name", f.string("Full name of the person").optional())
  .output("email", f.string("Email address").optional())
  .output("phone", f.string("Phone number").optional())
  .output("jobTitle", f.string("Job title or role").optional())
  .output("company", f.string("Company or employer").optional())
  .output("linkedinUrl", f.string("LinkedIn profile URL or path").optional())
  .output("instagramHandle", f.string("Instagram username (without @)").optional())
  .output("twitterHandle", f.string("Twitter/X handle (without @)").optional())
  .output(
    "notes",
    f
      .string(
        "Freeform notes summarising who this person is and any context visible in the screenshot — bio, tagline, areas of expertise, mutual connections, etc. Write in third person (e.g. 'Jane is a senior engineer at...'). Omit if nothing meaningful is visible.",
      )
      .optional(),
  )
  .description(
    "Extract contact information from a profile screenshot (LinkedIn, Instagram, Twitter/X, business card, etc.). Only populate fields that are clearly visible in the image.",
  )
  .build();

export interface ExtractedContact {
  name?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  company?: string;
  linkedinUrl?: string;
  instagramHandle?: string;
  twitterHandle?: string;
  notes?: string;
}

export async function extractContactFromImage(
  imageData: string,
  mimeType: string,
): Promise<ExtractedContact> {
  const gen = new AxGen(extractSignature);
  const result = await gen.forward(getVisionAI(), {
    profileImage: { mimeType, data: imageData },
  });

  return Object.fromEntries(
    Object.entries(result).filter(([, v]) => typeof v === "string" && v.length > 0),
  ) as ExtractedContact;
}

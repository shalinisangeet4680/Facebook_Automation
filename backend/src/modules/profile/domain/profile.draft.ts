import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const draftSchema = z.object({
  facebook: z
    .object({
      about: optionalText(255),
      description: optionalText(2000),
      website: z.string().url().startsWith("http").nullable().optional(),
      phone: optionalText(30),
      email: z.string().email().nullable().optional(),
      pictureCreativeId: z.string().uuid().nullable().optional(),
      coverCreativeId: z.string().uuid().nullable().optional(),
    })
    .default({}),
  instagram: z
    .object({
      name: optionalText(30),
      bio: optionalText(150),
      website: z.string().url().startsWith("http").nullable().optional(),
      pictureCreativeId: z.string().uuid().nullable().optional(),
    })
    .default({}),
});

export type ProfileDraft = z.infer<typeof draftSchema>;

export const FACEBOOK_PARTS = [
  "about",
  "description",
  "website",
  "phone",
  "email",
  "picture",
  "cover",
] as const;
export type FacebookPart = (typeof FACEBOOK_PARTS)[number];

import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
  firstName: z.string().min(1, "First name is required").max(60),
  familyName: z.string().min(1, "Family name is required").max(60),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  photo: z.string().optional().nullable(),
  country: z.string().min(1, "Country is required").max(80),
  socialNumber: z.string().min(1, "Social number is required").max(40),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const newPostSchema = z
  .object({
    type: z.enum(["text", "image"]),
    body: z.string().max(800).optional().nullable(),
    image: z.string().optional().nullable(), // data URL
    clientLocale: z.string().max(20).optional().nullable(),
    imageW: z.number().int().positive().optional().nullable(),
    imageH: z.number().int().positive().optional().nullable(),
    imageKb: z.number().int().positive().optional().nullable()
  })
  .refine(
    (v) => (v.type === "text" ? !!v.body && v.body.trim().length > 0 : true),
    { message: "Text posts require a body", path: ["body"] }
  )
  .refine(
    (v) => (v.type === "image" ? !!v.image && v.image.startsWith("data:image/") : true),
    { message: "Image posts require an image", path: ["image"] }
  );

export type NewPost = z.infer<typeof newPostSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type SignupFormInput = SignupInput;
export type LoginInput = z.infer<typeof loginSchema>;

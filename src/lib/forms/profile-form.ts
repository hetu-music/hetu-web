import { z } from "zod";
import {
  displayNameField,
  emailField,
  introField,
  newPasswordField,
  PASSWORD_MISMATCH,
  passwordsMatch,
} from "@/lib/forms/account-rules";

export const profileAccountFormSchema = z.object({
  displayName: displayNameField,
  intro: introField,
  display: z.boolean(),
});

export const profilePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "请输入当前密码"),
    newPassword: newPasswordField,
    confirmPassword: z.string().min(1, "请再次输入新密码"),
  })
  .refine(passwordsMatch, PASSWORD_MISMATCH);

export const profileEmailFormSchema = z.object({
  email: emailField,
  currentPassword: z.string().min(1, "请输入当前密码"),
});

export type ProfileAccountFormValues = z.infer<typeof profileAccountFormSchema>;
export type ProfilePasswordFormValues = z.infer<
  typeof profilePasswordFormSchema
>;
export type ProfileEmailFormValues = z.infer<typeof profileEmailFormSchema>;

import { z } from "zod";
import {
  emailField,
  newPasswordField,
  PASSWORD_MISMATCH,
  passwordField,
  passwordsMatch,
} from "@/lib/forms/account-rules";

const turnstileField = z.string().min(1, "请完成人机验证");

export function createAuthFormSchema(mode: "login" | "register") {
  return z.object({
    email: emailField,
    password: mode === "login" ? passwordField : newPasswordField,
    turnstileToken: turnstileField,
  });
}

/** 找回密码第一步：邮箱与人机验证 */
export const recoveryEmailFormSchema = z.object({
  email: emailField,
  turnstileToken: turnstileField,
});

/** 找回密码最后一步：设新密码 */
export const newPasswordFormSchema = z
  .object({
    newPassword: newPasswordField,
    confirmPassword: z.string().min(1, "请再次输入新密码"),
  })
  .refine(passwordsMatch, PASSWORD_MISMATCH);

export const otpFormSchema = z
  .object({
    otp: z.array(z.string().regex(/^\d?$/, "验证码只能为数字")).length(6),
  })
  .superRefine((values, context) => {
    if (values.otp.some((digit) => !/^\d$/.test(digit))) {
      context.addIssue({
        code: "custom",
        path: ["otp"],
        message: "请输入完整的6位验证码",
      });
    }
  });

export type AuthFormValues = z.infer<ReturnType<typeof createAuthFormSchema>>;
export type RecoveryEmailFormValues = z.infer<typeof recoveryEmailFormSchema>;
export type NewPasswordFormValues = z.infer<typeof newPasswordFormSchema>;
export type OtpFormValues = z.infer<typeof otpFormSchema>;

export function createAuthFormValues(): AuthFormValues {
  return {
    email: "",
    password: "",
    turnstileToken: "",
  };
}

export function createOtpFormValues(): OtpFormValues {
  return {
    otp: ["", "", "", "", "", ""],
  };
}

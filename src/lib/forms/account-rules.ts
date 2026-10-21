import { z } from "zod";

/**
 * 账户相关字段的规则，前端表单与 /api/auth/* 共用一份。
 * 以前密码规则在注册、改密的前后端各写了一遍，用户名的长度前端 1、后端 2，
 * 前端放行的输入到了后端才被拒。
 */

export const PASSWORD_RULE_MESSAGE = "密码要求至少8位，并包含字母和数字";

export const emailField = z.email("请输入正确的邮箱地址");

/** 设新密码时的强度要求；登录、核对旧密码只要求非空，见 passwordField */
export const newPasswordField = z
  .string()
  .min(8, PASSWORD_RULE_MESSAGE)
  .regex(/[A-Za-z]/, PASSWORD_RULE_MESSAGE)
  .regex(/\d/, PASSWORD_RULE_MESSAGE);

export const passwordField = z.string().min(1, "请输入密码");

export const otpCodeField = z.string().regex(/^\d{6}$/, "请输入6位数字验证码");

export const displayNameField = z
  .string()
  .trim()
  .min(2, "用户名不少于2个字符")
  .max(30, "用户名不能超过30个字符");

/**
 * 用户名撞了 users 上的唯一索引（lower(btrim(name))）时回给前端的文案。
 * 不另做「是否可用」的预查：先查再写挡不住两人同时提交，以约束为准
 */
export const DISPLAY_NAME_TAKEN = "这个用户名已经有人用了";

export const introField = z
  .string()
  .trim()
  .max(200, "个人简介不能超过200个字符");

/** 新密码与确认两栏：.refine(passwordsMatch, PASSWORD_MISMATCH)，提示落在确认栏上 */
export const passwordsMatch = (values: {
  newPassword: string;
  confirmPassword: string;
}) => values.newPassword === values.confirmPassword;

export const PASSWORD_MISMATCH = {
  message: "两次输入的新密码不一致",
  path: ["confirmPassword"],
};

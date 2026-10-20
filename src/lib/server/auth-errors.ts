import { NextResponse } from "next/server";

/**
 * 把 GoTrue 的错误码翻成给用户看的话。
 *
 * 以前各路由直接把 error.message 回给前端，用户会看到
 * 「New password should be different from the old password.」这样的英文原文。
 * 原文只进服务端日志；码表外的错误给调用方传入的通用文案。
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "邮箱或密码错误",
  email_not_confirmed: "邮箱尚未验证",
  user_already_exists: "该邮箱已被注册",
  email_exists: "该邮箱已被使用",
  weak_password: "密码强度不够，请换一个更复杂的密码",
  same_password: "新密码不能与原密码相同",
  // GoTrue 对错码和过期码都回 otp_expired（Token has expired or is invalid）
  otp_expired: "验证码错误或已过期",
  over_email_send_rate_limit: "邮件发送太频繁，请稍后再试",
  over_request_rate_limit: "操作太频繁，请稍后再试",
  email_address_invalid: "邮箱地址无效",
  email_address_not_authorized: "暂时无法向该邮箱发送邮件",
  signup_disabled: "暂未开放注册",
  session_not_found: "登录已失效，请重新登录",
  reauthentication_needed: "请重新登录后再试",
};

const RATE_LIMIT_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
]);

type AuthErrorLike = { code?: string; message?: string; status?: number };

export function authErrorMessage(
  error: AuthErrorLike,
  fallback: string,
): string {
  return (error.code && AUTH_ERROR_MESSAGES[error.code]) || fallback;
}

/**
 * GoTrue 报错时的统一响应：日志留原文，响应给中文文案与错误码。
 * 错误码一并给前端，是为了让它分辨要走哪条路（如 email_not_confirmed 转去填验证码）。
 */
export function authErrorResponse(
  scope: string,
  error: AuthErrorLike,
  fallback: string,
  status = 400,
): NextResponse {
  console.error(`[${scope}]`, error.code ?? "", error.message ?? error);
  const code = error.code;
  return NextResponse.json(
    { error: authErrorMessage(error, fallback), ...(code ? { code } : {}) },
    { status: code && RATE_LIMIT_CODES.has(code) ? 429 : status },
  );
}

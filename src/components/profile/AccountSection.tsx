"use client";

import EmailForm from "@/components/profile/account/EmailForm";
import PasswordForm from "@/components/profile/account/PasswordForm";
import ProfileForm from "@/components/profile/account/ProfileForm";
import SessionsBlock from "@/components/profile/account/SessionsBlock";
import ProfileSectionHeading from "@/components/profile/ProfileSectionHeading";
import { useUserContext } from "@/context/UserContext";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

/** 账户设置：公开资料、登录邮箱、密码、登录设备四组 */
export default function AccountSection() {
  const t = useTranslations("profile");
  const { user, loaded } = useUserContext();

  return (
    <section>
      <ProfileSectionHeading label={t("tabs.account")} />
      {!loaded || !user ? (
        <Loader2 size={20} className="mt-12 animate-spin text-slate-400" />
      ) : (
        <div className="mt-8 lg:mt-12 max-w-[40em] space-y-16">
          <ProfileForm />
          <EmailForm />
          <PasswordForm />
          <SessionsBlock />
        </div>
      )}
    </section>
  );
}

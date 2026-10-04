import { AuthFrame } from "@/components/auth/auth-frame";
import { LoginForm } from "@/components/auth/login-form";
import { getTranslations } from "@/i18n/server";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; inbjudan?: string }> }) {
  const { next, inbjudan } = await searchParams;
  const { t } = await getTranslations();
  return (
    <AuthFrame eyebrow={t("auth.eyebrow")} title={t("auth.login")} description={t("auth.loginDescription")}>
      <LoginForm returnTo={next} invitationAccepted={inbjudan === "accepterad"} />
    </AuthFrame>
  );
}

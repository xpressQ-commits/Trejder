import { AuthFrame } from "@/components/auth/auth-frame";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AuthFrame eyebrow="Kontohjälp" title="Välj nytt lösenord" description="Använd ett unikt lösenord med minst 12 tecken."><ResetPasswordForm token={token} /></AuthFrame>;
}

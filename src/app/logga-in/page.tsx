import { AuthFrame } from "@/components/auth/auth-frame";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; inbjudan?: string }> }) {
  const { next, inbjudan } = await searchParams;
  return (
    <AuthFrame eyebrow="Trejder" title="Logga in" description="Logga in som bilhandlare eller privat säljare.">
      <LoginForm returnTo={next} invitationAccepted={inbjudan === "accepterad"} />
    </AuthFrame>
  );
}

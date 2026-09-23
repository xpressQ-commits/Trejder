import { AuthFrame } from "@/components/auth/auth-frame";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; inbjudan?: string }> }) {
  const { next, inbjudan } = await searchParams;
  return (
    <AuthFrame eyebrow="För bilhandlare" title="Logga in" description="Använd kontot som är kopplat till ditt företag.">
      <LoginForm returnTo={next} invitationAccepted={inbjudan === "accepterad"} />
    </AuthFrame>
  );
}

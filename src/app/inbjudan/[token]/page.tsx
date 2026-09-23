import { AuthFrame } from "@/components/auth/auth-frame";
import { InvitationForm } from "@/components/auth/invitation-form";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AuthFrame eyebrow="Företagsinbjudan" title="Välkommen till Handlarbörsen" description="Acceptera inbjudan för att få åtkomst till ditt företag."><InvitationForm token={token} /></AuthFrame>;
}

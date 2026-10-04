import { AuthFrame } from "@/components/auth/auth-frame";
import { PrivateVerification } from "@/components/auth/private-verification";

export default async function VerifyPrivatePage({ params }: { params: Promise<{ token: string }> }) {
  return <AuthFrame eyebrow="Privatkonto" title="Verifiera konto" description="Vi aktiverar ditt konto säkert."><PrivateVerification token={(await params).token} /></AuthFrame>;
}

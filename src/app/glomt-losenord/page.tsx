import { AuthFrame } from "@/components/auth/auth-frame";
import { RequestResetForm } from "@/components/auth/request-reset-form";

export default function ForgotPasswordPage() {
  return <AuthFrame eyebrow="Kontohjälp" title="Återställ lösenord" description="Ange din e-postadress så skickar vi instruktioner om ett konto finns."><RequestResetForm /></AuthFrame>;
}

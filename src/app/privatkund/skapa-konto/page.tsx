import { AuthFrame } from "@/components/auth/auth-frame";
import { PrivateRegistrationForm } from "@/components/auth/private-registration-form";

export default function PrivateRegistrationPage() {
  return <AuthFrame eyebrow="För privatpersoner" title="Sälj din bil" description="Skapa ett konto och verifiera din e-postadress för att publicera din bil till anslutna handlare."><PrivateRegistrationForm /></AuthFrame>;
}

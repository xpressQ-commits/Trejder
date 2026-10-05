"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { primaryButtonClassName } from "@/components/ui/form-controls";
import { usePreferences } from "@/components/preferences/preferences-provider";

export function DealCompletionAction({
  dealId,
  alreadyConfirmed,
  completed,
}: {
  dealId: string;
  alreadyConfirmed: boolean;
  completed: boolean;
}) {
  const router = useRouter();
  const { t } = usePreferences();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  if (completed)
    return (
      <p className="flex items-center gap-2 font-semibold text-[var(--success)]">
        <CheckCircle2 size={19} /> {t("deals.completedStatus")}
      </p>
    );
  if (alreadyConfirmed)
    return (
      <p className="text-sm text-[var(--muted)]">
        {t("deals.awaitingCounterparty")}
      </p>
    );
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!window.confirm(t("deals.completeConfirm"))) return;
          setPending(true);
          setError(false);
          const response = await fetch(`/api/deals/${dealId}/complete`, {
            method: "POST",
          });
          if (response.ok) router.refresh();
          else {
            setError(true);
            setPending(false);
          }
        }}
        className={primaryButtonClassName}
      >
        {pending ? t("common.loading") : t("deals.markComplete")}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-[var(--danger)]">
          {t("error.generic")}
        </p>
      ) : null}
    </div>
  );
}

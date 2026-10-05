"use client";

import { Check } from "lucide-react";
import type { EquipmentKey } from "@/domain/equipment";
import { equipmentLabel } from "@/i18n/equipment";
import { usePreferences } from "@/components/preferences/preferences-provider";

export function EquipmentList({
  equipment,
  otherEquipment,
}: {
  equipment: EquipmentKey[];
  otherEquipment?: string | null;
}) {
  const { locale } = usePreferences();
  if (!equipment.length && !otherEquipment) return null;
  return (
    <section className="mt-8 border-t border-[var(--border)] pt-7">
      <h2 className="text-xl font-semibold">
        {locale === "sv" ? "Utrustning" : "Equipment"}
      </h2>
      {equipment.length ? (
        <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {equipment.map((key) => (
            <li key={key} className="flex items-center gap-2 text-sm">
              <Check
                aria-hidden="true"
                className="shrink-0 text-[var(--success)]"
                size={17}
              />
              {equipmentLabel(locale, key)}
            </li>
          ))}
        </ul>
      ) : null}
      {otherEquipment ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold">
            {locale === "sv" ? "Övrig utrustning" : "Other equipment"}
          </h3>
          <p className="mt-1 text-sm whitespace-pre-wrap text-[var(--muted)]">
            {otherEquipment}
          </p>
        </div>
      ) : null}
    </section>
  );
}

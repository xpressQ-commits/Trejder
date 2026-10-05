"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  commonEquipment,
  equipmentCatalog,
  equipmentCategories,
  type EquipmentKey,
} from "@/domain/equipment";
import { equipmentCategoryLabel, equipmentLabel } from "@/i18n/equipment";
import { usePreferences } from "@/components/preferences/preferences-provider";

export function EquipmentSelector({
  value,
  onChange,
  disabled,
}: {
  value: EquipmentKey[];
  onChange: (value: EquipmentKey[]) => void;
  disabled?: boolean;
}) {
  const { locale } = usePreferences();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const normalized = query
      .trim()
      .toLocaleLowerCase(locale === "sv" ? "sv-SE" : "en-US");
    if (normalized)
      return equipmentCatalog.filter(([key]) =>
        equipmentLabel(locale, key)
          .toLocaleLowerCase(locale === "sv" ? "sv-SE" : "en-US")
          .includes(normalized),
      );
    if (!expanded)
      return equipmentCatalog.filter(([key]) => commonEquipment.includes(key));
    return equipmentCatalog;
  }, [expanded, locale, query]);

  function toggle(key: EquipmentKey) {
    onChange(
      value.includes(key)
        ? value.filter((item) => item !== key)
        : [...value, key],
    );
  }

  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="font-semibold">
        {locale === "sv" ? "Utrustning" : "Equipment"}{" "}
        <span className="font-normal text-[var(--muted)]">
          · {value.length} {locale === "sv" ? "valda" : "selected"}
        </span>
      </legend>
      <p className="text-sm text-[var(--muted)]">
        {locale === "sv"
          ? "Välj den utrustning som finns på bilen"
          : "Select the equipment fitted to the vehicle"}
      </p>
      {expanded || query ? (
        <label className="relative block max-w-md">
          <span className="sr-only">
            {locale === "sv" ? "Sök utrustning" : "Search equipment"}
          </span>
          <Search
            className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--muted)]"
            size={17}
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              locale === "sv" ? "Sök utrustning" : "Search equipment"
            }
            className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pr-3 pl-10"
          />
        </label>
      ) : null}
      {equipmentCategories.map((category) => {
        const items = visible.filter(
          ([, itemCategory]) => itemCategory === category,
        );
        if (!items.length) return null;
        return (
          <section key={category}>
            <h3 className="mb-2 text-xs font-bold tracking-wide text-[var(--muted)] uppercase">
              {equipmentCategoryLabel(locale, category)}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(([key]) => (
                <label
                  key={key}
                  className={`flex min-h-11 cursor-pointer items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-[var(--focus)] ${value.includes(key) ? "border-[var(--primary)] bg-[var(--surface-selected)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)]"}`}
                >
                  <input
                    type="checkbox"
                    checked={value.includes(key)}
                    onChange={() => toggle(key)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${value.includes(key) ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)]"}`}
                  >
                    {value.includes(key) ? "✓" : ""}
                  </span>
                  {equipmentLabel(locale, key)}
                </label>
              ))}
            </div>
          </section>
        );
      })}
      {!query ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="min-h-11 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--surface-subtle)]"
        >
          {expanded
            ? locale === "sv"
              ? "Visa mindre"
              : "Show less"
            : locale === "sv"
              ? "Visa all utrustning"
              : "Show all equipment"}
        </button>
      ) : null}
      {query && visible.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          {locale === "sv"
            ? "Ingen utrustning matchar sökningen."
            : "No equipment matches your search."}
        </p>
      ) : null}
    </fieldset>
  );
}

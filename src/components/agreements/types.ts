import type { AgreementDto } from "@/server/agreements";
import type { listCompanyDeals } from "@/server/deals";

export type AgreementView = Omit<
  AgreementDto,
  "createdAt" | "updatedAt" | "generatedAt"
> & {
  createdAt: string;
  updatedAt: string;
  generatedAt: string | null;
};

export type AgreementDealOption = Omit<
  Awaited<ReturnType<typeof listCompanyDeals>>[number],
  "acceptedAt" | "completedAt" | "viewerCompletedAt" | "counterpartyCompletedAt"
> & {
  acceptedAt: string;
  completedAt: string | null;
  viewerCompletedAt: string | null;
  counterpartyCompletedAt: string | null;
};

export function serializeAgreement(value: AgreementDto): AgreementView {
  return {
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
    generatedAt: value.generatedAt?.toISOString() ?? null,
  };
}

export function serializeAgreementDeal(
  value: Awaited<ReturnType<typeof listCompanyDeals>>[number],
): AgreementDealOption {
  return {
    ...value,
    acceptedAt: value.acceptedAt.toISOString(),
    completedAt: value.completedAt?.toISOString() ?? null,
    viewerCompletedAt: value.viewerCompletedAt?.toISOString() ?? null,
    counterpartyCompletedAt:
      value.counterpartyCompletedAt?.toISOString() ?? null,
  };
}

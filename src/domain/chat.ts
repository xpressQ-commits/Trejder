export function dealerCounterpartyLabel(input: {
  viewerCompanyId: string;
  sellerCompanyId: string;
  buyerCompanyId: string;
  sellerName: string;
  buyerName: string;
  anonymousNumber: number;
  identityRevealed: boolean;
}): string {
  if (input.viewerCompanyId === input.buyerCompanyId) return input.sellerName;
  return input.identityRevealed ? input.buyerName : `Anonym köpare #${input.anonymousNumber}`;
}

export function normalizeChatBody(value: string): string {
  const body = value.trim();
  if (!body || body.length > 2000) throw new Error("INVALID_CHAT_MESSAGE");
  return body;
}

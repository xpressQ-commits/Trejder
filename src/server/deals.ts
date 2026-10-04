import { desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/server/db";
import { company, match, vehicleListing } from "@/server/db/schema";

const seller = alias(company, "deal_seller"); const buyer = alias(company, "deal_buyer");
export async function listCompanyDeals(companyId: string) {
  const rows = await getDb().select({ id: match.id, listingId: match.listingId, amountOre: match.vehicleAmountOre, acceptedAt: match.acceptedAt, sellerCompanyId: match.sellerCompanyId, buyerCompanyId: match.buyerCompanyId, sellerName: seller.legalName, sellerEmail: seller.contactEmail, sellerPhone: seller.contactPhone, buyerName: buyer.legalName, buyerEmail: buyer.contactEmail, buyerPhone: buyer.contactPhone, vehicleModel: vehicleListing.vehicleModel, registrationNumber: vehicleListing.registrationNumber }).from(match).innerJoin(vehicleListing, eq(vehicleListing.id, match.listingId)).innerJoin(seller, eq(seller.id, match.sellerCompanyId)).innerJoin(buyer, eq(buyer.id, match.buyerCompanyId)).where(or(eq(match.sellerCompanyId, companyId), eq(match.buyerCompanyId, companyId))).orderBy(desc(match.acceptedAt));
  return rows.map((row) => ({ id: row.id, listingId: row.listingId, amountOre: row.amountOre, acceptedAt: row.acceptedAt, listingLabel: row.vehicleModel ?? row.registrationNumber ?? "Bilannons", counterparty: row.sellerCompanyId === companyId ? { name: row.buyerName, email: row.buyerEmail, phone: row.buyerPhone } : { name: row.sellerName, email: row.sellerEmail, phone: row.sellerPhone }, viewerIsSeller: row.sellerCompanyId === companyId }));
}

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const companyStatus = pgEnum("company_status", ["active", "suspended"]);
export const membershipRole = pgEnum("membership_role", ["admin", "trader", "viewer"]);
export const membershipStatus = pgEnum("membership_status", ["active", "suspended", "revoked"]);
export const invitationStatus = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);
export const listingInputKind = pgEnum("listing_input_kind", ["registration", "model"]);
export const listingStatus = pgEnum("listing_status", [
  "draft",
  "active",
  "matched",
  "withdrawn",
]);
export const plateRedactionStatus = pgEnum("plate_redaction_status", [
  "NOT_CHECKED",
  "PROCESSING",
  "NO_PLATE_DETECTED",
  "PLATE_REDACTED",
  "REVIEW_REQUIRED",
  "FAILED",
]);
export const bidStatus = pgEnum("bid_status", ["active", "withdrawn", "accepted", "lost"]);

export const company = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  legalName: varchar("legal_name", { length: 200 }).notNull(),
  organizationNumber: varchar("organization_number", { length: 20 }).notNull().unique(),
  contactEmail: varchar("contact_email", { length: 320 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 40 }),
  status: companyStatus("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const companyMembership = pgTable(
  "company_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: membershipRole("role").notNull(),
    status: membershipStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("company_memberships_company_user_uq").on(table.companyId, table.userId),
    index("company_memberships_user_idx").on(table.userId),
  ],
);

/** Internal platform authority, deliberately separate from dealer-company roles. */
export const platformAdmin = pgTable("platform_admins", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const companyInvitation = pgTable(
  "company_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    role: membershipRole("role").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    status: invitationStatus("status").notNull().default("pending"),
    invitedByUserId: text("invited_by_user_id")
      .references(() => user.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("company_invitations_company_email_idx").on(table.companyId, table.email),
    uniqueIndex("company_invitations_one_pending_email_uq")
      .on(table.companyId, sql`lower(${table.email})`)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export const vehicleListing = pgTable(
  "vehicle_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sellerCompanyId: uuid("seller_company_id")
      .notNull()
      .references(() => company.id, { onDelete: "restrict" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    inputKind: listingInputKind("input_kind").notNull(),
    registrationNumber: varchar("registration_number", { length: 16 }),
    vehicleModel: varchar("vehicle_model", { length: 160 }),
    modelYear: integer("model_year"),
    mileageKm: integer("mileage_km").notNull(),
    shortComment: varchar("short_comment", { length: 500 }).notNull(),
    deductibleVat: boolean("deductible_vat").notNull(),
    status: listingStatus("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("vehicle_listings_id_seller_uq").on(table.id, table.sellerCompanyId),
    index("vehicle_listings_seller_status_idx").on(table.sellerCompanyId, table.status),
    check("vehicle_listings_mileage_nonnegative", sql`${table.mileageKm} >= 0`),
    check(
      "vehicle_listings_mileage_whole_mil",
      sql`${table.mileageKm} <= 2000000 AND ${table.mileageKm} % 10 = 0`,
    ),
    check("vehicle_listings_version_positive", sql`${table.version} > 0`),
    check("vehicle_listings_model_year_range", sql`${table.modelYear} IS NULL OR ${table.modelYear} BETWEEN 1950 AND 3000`),
    check(
      "vehicle_listings_identifier_matches_kind",
      sql`(${table.inputKind} = 'registration' AND ${table.registrationNumber} IS NOT NULL AND ${table.vehicleModel} IS NULL) OR (${table.inputKind} = 'model' AND ${table.vehicleModel} IS NOT NULL AND ${table.registrationNumber} IS NULL)`,
    ),
  ],
);

export const vehicleImage = pgTable(
  "vehicle_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => vehicleListing.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    objectKey: text("object_key").notNull().unique(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    checksumSha256: varchar("checksum_sha256", { length: 64 }).notNull(),
    sourceChecksumSha256: varchar("source_checksum_sha256", { length: 64 }).notNull(),
    plateRedactionStatus: plateRedactionStatus("plate_redaction_status")
      .notNull()
      .default("NOT_CHECKED"),
    plateConfidence: integer("plate_confidence"),
    plateProcessedAt: timestamp("plate_processed_at", { withTimezone: true }),
    plateProcessingError: varchar("plate_processing_error", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("vehicle_images_listing_position_uq").on(table.listingId, table.position),
    check("vehicle_images_position_range", sql`${table.position} BETWEEN 1 AND 5`),
    check("vehicle_images_plate_confidence_range", sql`${table.plateConfidence} IS NULL OR ${table.plateConfidence} BETWEEN 0 AND 1000`),
    check("vehicle_images_byte_size_positive", sql`${table.byteSize} > 0`),
  ],
);

export const bid = pgTable(
  "bids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id").notNull(),
    listingSellerCompanyId: uuid("listing_seller_company_id").notNull(),
    bidderCompanyId: uuid("bidder_company_id")
      .notNull()
      .references(() => company.id, { onDelete: "restrict" }),
    placedByUserId: text("placed_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    anonymousNumber: integer("anonymous_number").notNull(),
    amountOre: integer("amount_ore").notNull(),
    status: bidStatus("status").notNull().default("active"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    foreignKey({
      columns: [table.listingId, table.listingSellerCompanyId],
      foreignColumns: [vehicleListing.id, vehicleListing.sellerCompanyId],
      name: "bids_listing_and_seller_fk",
    }).onDelete("restrict"),
    uniqueIndex("bids_listing_bidder_uq").on(table.listingId, table.bidderCompanyId),
    uniqueIndex("bids_listing_alias_uq").on(table.listingId, table.anonymousNumber),
    uniqueIndex("bids_match_reference_uq").on(
      table.id,
      table.listingId,
      table.listingSellerCompanyId,
      table.bidderCompanyId,
    ),
    uniqueIndex("bids_one_accepted_per_listing_uq")
      .on(table.listingId)
      .where(sql`${table.status} = 'accepted'`),
    check("bids_no_self_bid", sql`${table.listingSellerCompanyId} <> ${table.bidderCompanyId}`),
    check("bids_amount_positive", sql`${table.amountOre} > 0`),
    check("bids_alias_positive", sql`${table.anonymousNumber} > 0`),
    check("bids_version_positive", sql`${table.version} > 0`),
  ],
);

export const match = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => vehicleListing.id, { onDelete: "restrict" })
      .unique(),
    acceptedBidId: uuid("accepted_bid_id")
      .notNull()
      .references(() => bid.id, { onDelete: "restrict" })
      .unique(),
    sellerCompanyId: uuid("seller_company_id")
      .notNull()
      .references(() => company.id, { onDelete: "restrict" }),
    buyerCompanyId: uuid("buyer_company_id")
      .notNull()
      .references(() => company.id, { onDelete: "restrict" }),
    acceptedByUserId: text("accepted_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    vehicleAmountOre: integer("vehicle_amount_ore").notNull(),
    sellerFeeExVatOre: integer("seller_fee_ex_vat_ore").notNull(),
    buyerFeeExVatOre: integer("buyer_fee_ex_vat_ore").notNull(),
    commercialTermsVersion: varchar("commercial_terms_version", { length: 80 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("SEK"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.acceptedBidId, table.listingId, table.sellerCompanyId, table.buyerCompanyId],
      foreignColumns: [
        bid.id,
        bid.listingId,
        bid.listingSellerCompanyId,
        bid.bidderCompanyId,
      ],
      name: "matches_bid_and_parties_fk",
    }).onDelete("restrict"),
    check("matches_distinct_parties", sql`${table.sellerCompanyId} <> ${table.buyerCompanyId}`),
    check("matches_vehicle_amount_positive", sql`${table.vehicleAmountOre} > 0`),
    check("matches_seller_fee_nonnegative", sql`${table.sellerFeeExVatOre} >= 0`),
    check("matches_buyer_fee_nonnegative", sql`${table.buyerFeeExVatOre} >= 0`),
    check("matches_currency_sek", sql`${table.currency} = 'SEK'`),
    index("matches_seller_idx").on(table.sellerCompanyId),
    index("matches_buyer_idx").on(table.buyerCompanyId),
  ],
);

export const auditLog = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "restrict" }),
    actorCompanyId: uuid("actor_company_id").references(() => company.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 120 }).notNull(),
    aggregateType: varchar("aggregate_type", { length: 80 }).notNull(),
    aggregateId: text("aggregate_id").notNull(),
    requestId: varchar("request_id", { length: 120 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_aggregate_idx").on(table.aggregateType, table.aggregateId),
    index("audit_logs_actor_company_idx").on(table.actorCompanyId),
    index("audit_logs_occurred_at_idx").on(table.occurredAt),
  ],
);

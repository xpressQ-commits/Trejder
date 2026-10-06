# Domain

## Core records

- **Company:** a dealer business; owns listings and bids through its users.
- **User:** an authenticated human identity.
- **CompanyMembership:** connects one user to one company with `ADMIN`, `TRADER` or `VIEWER` authority and an active, suspended or revoked state.
- **CompanyInvitation:** one-time, expiring invitation to a company and role.
- **AccountApplication:** public dealer application in pending, approved or rejected review state; it grants no access by itself.
- **VehicleListing:** seller-owned vehicle input, mileage, comment, VAT flag, 48–120 hour publication duration and server-controlled state.
- **VehicleImage:** private object reference at position 1–5 with plate-redaction status. Publication requires 1–5 valid images; completed plate checks are required when redaction is configured.
- **Bid:** one current bid per bidder company and listing, with a listing-scoped anonymous number.
- **Match/Deal:** result of accepting one bid, including immutable parties, amount and historical commercial terms plus a small deal lifecycle (`accepted -> in_progress -> completed`).
- **AuditLog:** append-only security and domain event record with sanitized metadata.
- **ListingQuestion:** public, permanently anonymous dealer question with at most one seller answer.
- **Notification:** identity-safe in-app event for one user.
- **CompanySubscription:** one dealer-company billing/access aggregate containing Stripe references, time-limited free access, explicit manual override and retryable seat-sync state.
- **ProcessedStripeEvent:** durable Stripe event-ID receipt that makes webhook handling idempotent.

## Subscription and seat policy

- Premium is 69,900 öre/month excluding VAT and includes two active company memberships.
- Each additional active membership is 19,900 öre/month excluding VAT. Canonical extra quantity is `max(activeMembershipCount - 2, 0)`.
- Suspended/revoked memberships and pending invitations never count. The browser never calculates a chargeable quantity.
- Effective precedence is `manual block > manual Premium > unexpired free access > Stripe state > Obetald`.
- Gratis expires at its exact stored end instant. It cannot be granted over a live Stripe subscription, because that would leave Stripe charging while access appears free.
- `invoice.payment_failed` records `past_due` without deleting data and retains Premium access during Stripe's collection retries. Stripe `unpaid`/canceled subscription lifecycle state produces Obetald; a matching current-subscription `invoice.paid` restores Stripe-backed Premium only when no higher manual override exists.
- Membership commits only mark seat synchronization pending. A retryable server worker updates the licensed Stripe item outside the membership transaction.
- Checkout is allowed only when no manual override or active free window exists and no live Stripe subscription is already linked. This prevents charging while a higher-precedence access decision remains visible.
- An active dealer membership is sufficient for marketplace reads and subscription/settings remediation. A valid subscription is additionally required for dealer mutations such as bidding and asking questions.

## Invariants encoded in the schema

- Membership is unique per user and company.
- User email identity is unique case-insensitively.
- At most one pending invitation exists for the same normalized email and company.
- A listing contains exactly one of registration number or vehicle model.
- Mileage is a non-negative integer number of kilometres.
- Image positions are 1–5 and unique per listing.
- One company has at most one current bid per listing.
- Bid aliases are unique within a listing.
- A duplicated seller company key plus a composite foreign key lets PostgreSQL reject self-bidding.
- A partial unique index permits at most one accepted bid per listing.
- `matches.listing_id` and `matches.accepted_bid_id` are unique.
- A composite match-to-bid foreign key requires the accepted bid, listing, seller and buyer to agree.
- Match amount and fee snapshots are integer öre; parties must differ and currency is SEK.
- Deal completion requires separate seller and buyer confirmations; the second confirmation changes the deal to `completed` transactionally.

The publish transaction requires 1–5 images. When plate redaction is configured, it permits only `NO_PLATE_DETECTED` or `PLATE_REDACTED` before changing the listing to active.

## State transitions

Listing:

- `draft -> active`: ADMIN/TRADER of seller; complete required data, 48–120 hour publication duration and 1–5 images, plate-checked when the provider is configured. The server derives the expiry timestamp.
- `draft -> withdrawn`: ADMIN/TRADER of seller.
- `active -> withdrawn`: ADMIN/TRADER of seller if no match exists.
- `active -> matched`: only the bid acceptance transaction.
- `matched` and `withdrawn` are terminal in the initial product.

## Private-customer communication matrix

| State        | Public Q&A                    | Private bid thread                      | Identity                         | Contact details              |
| ------------ | ----------------------------- | --------------------------------------- | -------------------------------- | ---------------------------- |
| No bid       | dealer asks, seller answers   | forbidden                               | anonymous                        | blocked                      |
| Active bid   | remains available             | forbidden                               | anonymous                        | blocked                      |
| Accepted bid | remains visible and anonymous | becomes full retained-history deal chat | revealed only to matched parties | allowed only in matched chat |

Public Q&A never creates private-message authority. A private thread requires a completed match keyed by its accepted bid and is accessible only to that match's seller and buyer. Acceptance is both the chat-authority and identity-reveal transition. Historical threads created before acceptance are retained for audit safety but are excluded from dealer reads and writes.

The match is the authoritative Deal record and is created in the same transaction as bid acceptance. Its unique listing and accepted-bid constraints prevent duplicate deals. A single chat thread is created for the accepted bid; older matches without a thread are handled by the same idempotent create-or-get path when their deal detail is opened.

Company contact email and phone are managed by company ADMIN users. They remain excluded from marketplace and bid projections and are disclosed only to the matched counterparty after acceptance.

Bid:

- create as `active` only on another company's active listing.
- update amount while `active`, scoped to the bidder company, using optimistic versioning.
- `active -> withdrawn`: bidder company ADMIN/TRADER.
- `active -> accepted`: seller acceptance transaction.
- other active bids become `lost` after a match.
- `withdrawn`, `accepted` and `lost` are terminal.

## Acceptance algorithm (future implementation)

Within one PostgreSQL transaction: authorize fresh seller membership; lock and validate seller-owned active listing; lock a valid bid scoped to that listing; conditionally move listing to matched; move the chosen bid to accepted and remaining bids to lost; create the unique Match using server-loaded amount/parties and server-owned fee policy; append audit records; commit. Concurrent attempts serialize, while unique constraints provide a final defence. Same-bid idempotent retry returns the existing match; a different later choice returns conflict.

Phase 2 implements only the seller company's own listing use cases; marketplace visibility is introduced separately in Phase 3.

## Phase 3 marketplace visibility

- An authenticated user with a fresh active membership may browse every unexpired active listing; VIEWER, TRADER and ADMIN have equal read access.
- Draft, withdrawn, matched and expired listings are not marketplace-visible. Own-company active listings remain visible in the feed.
- Marketplace projections deliberately omit seller company/user identity, storage keys and internal metadata.
- Marketplace images are readable only while the corresponding listing satisfies the marketplace visibility predicate.
- Feed queries use bounded, newest-first cursor pagination and optional registration/model text and deductible-VAT filters.

## Phase 2 listing policy

- `createDraft` derives seller company and creator from the active server context.
- UI mileage is a whole number of Swedish mil. The server multiplies it by 10 and PostgreSQL enforces a non-negative whole-mil kilometre value no greater than 2,000,000 km.
- Trader comments are required and limited to 500 characters.
- A draft may be fully edited and may hold zero to five images.
- Publishing locks the listing row, requires 1–5 images and changes `draft -> active`. Completed plate checks are enforced when redaction is configured. Repeated publication of the same active listing is idempotent.
- Active listings allow comment corrections and atomic image replacement only. Registration/model, mileage and VAT are locked; changing them requires withdrawal and a new listing.
- `draft|active -> withdrawn` is allowed. Withdrawn is terminal.
- ADMIN and TRADER mutate. VIEWER has own-company read access only.

## Phase 1 company access transitions

- Invitation: `pending -> accepted | revoked | expired`. Acceptance locks the row, derives company and role from it, and consumes it in the same transaction that creates membership.
- Membership: `active <-> suspended`, or `active/suspended -> revoked`. Revocation is terminal. Only a fresh active ADMIN membership may manage members.
- A member phone number belongs to the company membership, not the global user, so the same person can keep different company contact details without cross-tenant updates.
- A company-row lock serializes every membership mutation that could change the number of active ADMINs. The final active ADMIN cannot be demoted, suspended or revoked.
- Suspended and revoked memberships are excluded whenever dealer context is resolved, so an existing authentication session does not preserve dealer access.

# Domain

## Core records

- **Company:** a dealer business; owns listings and bids through its users.
- **User:** an authenticated human identity.
- **CompanyMembership:** connects one user to one company with `ADMIN`, `TRADER` or `VIEWER` authority and an active, suspended or revoked state.
- **CompanyInvitation:** one-time, expiring invitation to a company and role.
- **VehicleListing:** seller-owned vehicle input, mileage, comment, VAT flag and server-controlled state.
- **VehicleImage:** private object reference at position 1–5 with plate-redaction status. Publication requires 3–5 valid, completed image checks.
- **Bid:** one current bid per bidder company and listing, with a listing-scoped anonymous number.
- **Match:** immutable result of accepting one bid, including amount and historical commercial terms.
- **AuditLog:** append-only security and domain event record with sanitized metadata.

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

The publish transaction requires 3–5 images and permits only `NO_PLATE_DETECTED` or `PLATE_REDACTED` before changing the listing to active.

## State transitions

Listing:

- `draft -> active`: ADMIN/TRADER of seller; complete required data and 3–5 plate-checked images.
- `draft -> withdrawn`: ADMIN/TRADER of seller.
- `active -> withdrawn`: ADMIN/TRADER of seller if no match exists.
- `active -> matched`: only the bid acceptance transaction.
- `matched` and `withdrawn` are terminal in the initial product.

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

- An authenticated user with a fresh active membership may browse active listings owned by other dealer companies; VIEWER, TRADER and ADMIN have equal read access.
- Draft, withdrawn, matched and own-company listings are not marketplace-visible.
- Marketplace projections deliberately omit seller company/user identity, storage keys and internal metadata.
- Marketplace images are readable only while the corresponding listing satisfies the marketplace visibility predicate.
- Feed queries use bounded, newest-first cursor pagination and optional registration/model text and deductible-VAT filters.

## Phase 2 listing policy

- `createDraft` derives seller company and creator from the active server context.
- UI mileage is a whole number of Swedish mil. The server multiplies it by 10 and PostgreSQL enforces a non-negative whole-mil kilometre value no greater than 2,000,000 km.
- Trader comments are required and limited to 500 characters.
- A draft may be fully edited and may hold zero to five images.
- Publishing locks the listing row, requires 3–5 completed plate checks, and changes `draft -> active`. Repeated publication of the same active listing is idempotent.
- Active listings allow comment corrections and atomic image replacement only. Registration/model, mileage and VAT are locked; changing them requires withdrawal and a new listing.
- `draft|active -> withdrawn` is allowed. Withdrawn is terminal.
- ADMIN and TRADER mutate. VIEWER has own-company read access only.

## Phase 1 company access transitions

- Invitation: `pending -> accepted | revoked | expired`. Acceptance locks the row, derives company and role from it, and consumes it in the same transaction that creates membership.
- Membership: `active <-> suspended`, or `active/suspended -> revoked`. Revocation is terminal. Only a fresh active ADMIN membership may manage members.
- A company-row lock serializes every membership mutation that could change the number of active ADMINs. The final active ADMIN cannot be demoted, suspended or revoked.
- Suspended and revoked memberships are excluded whenever dealer context is resolved, so an existing authentication session does not preserve dealer access.

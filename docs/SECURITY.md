# Security

## Non-negotiable invariants

### Tenant and role isolation

Every request derives the user from the server session and reloads an active company membership. Repository reads and writes include tenant/ownership predicates. Client values never select acting company, seller, bidder, owner, role, status, accepted identity or fee. Unknown or cross-tenant object references should generally produce a non-disclosing not-found response.

Platform administrators are held in a separate authority table and never inferred from the dealer-company `ADMIN` role. Bootstrap credentials are supplied only at runtime, hashed with Better Auth's credential hasher and never printed or committed.

Global company and membership administration is exposed only below `/admin` and `/api/platform`. Every platform mutation revalidates the separate authority record, requires an exact same-origin request and writes an attributed audit event. Operational company removal uses suspension so tenant data and audit history are retained.

`VIEWER` cannot mutate. `TRADER` can perform marketplace mutations but cannot manage the company or users. `ADMIN` can do both. Middleware and hidden controls may improve UX but never replace use-case authorization.

### Bid anonymity

Before acceptance, seller APIs return an explicit allow-list only: opaque listing-scoped bid reference, `Bidgivare N`, amount, timestamps and later approved anonymous trust signals. They never serialize ORM bid rows or return company/user IDs, organization number, identity, contact data, globally stable aliases or lookup-capable metadata. Non-winning bidders stay anonymous after another bid wins.

Identity is revealed only through a completed-match projection to the matched seller and buyer.

Private-customer accounts use a dedicated `private_customer` membership role and a server-owned private company context. They may mutate only their own listings and seller-side bid/Q&A/deal resources. Marketplace reads, bidding and dealer-company administration require a dealer company context and are denied server-side. Public Q&A and pre-accept bid messages use allow-listed anonymous DTOs and reject contact-sharing content server-side. Q&A aliases are allocated per listing and never reused as a global identity.

### Money and commercial terms

Money is integer öre. The current server policy is 49,900 öre excluding VAT on each side of a dealer match. Acceptance snapshots both fees and a terms version in the Match. Client-supplied amount, fee, party or state fields cannot populate the match.

The future accepted-match price target is 89,900 öre excluding VAT per dealer side, but Phase 3.5 does not change or charge the runtime match fee. Premium billing is separately fixed at 69,900 öre/month plus 19,900 öre per active user above two. Only the canonical server seat function supplies Stripe quantity.

PWT Invest AB's platform-owner flag is a protected database policy input. The server independently zeroes only that company's match-fee side; a non-exempt counterparty retains the normal fee snapshot. No browser-supplied company identity or exemption value participates.

### Subscription and Stripe isolation

Dealer membership and subscription access are separate checks. Read-only marketplace routes and company settings require a fresh active dealer membership but deliberately permit an unpaid company. Dealer mutations, including bidding, remain subscription-gated on the server. Dealer ADMIN billing, company-contact and member-remediation routes also permit an unpaid company. Platform-admin authority remains independent. Manual block outranks every Stripe webhook, and no webhook clears an override.

Checkout and portal requests derive the company from the authenticated selected-company cookie plus a fresh active ADMIN membership. They accept no company, customer, price or amount from the client. Superadmin subscription mutations require fresh platform authority and exact same origin. Gratis days are bounded to 1–3650.

Stripe webhooks require a valid signature over the unparsed body. Processed event IDs are unique, so replays cannot duplicate business actions. Audit metadata may contain Stripe object IDs and statuses, but never secrets, payment credentials or full payment details. An invoice failure records a conservative billing problem; it never removes company data or memberships.

Platform-owner companies are rejected before Stripe customer, Checkout or Portal creation and are omitted from licensed-seat synchronization. Their entitlement and zero seat cost come from the central server policy even if stale subscription data exists.

### State, concurrency and audit

Publishing, republication, bid mutation and acceptance are server-controlled transitions. Republication locks the listing, verifies server-derived expiry, closes the current bid round and increments the round atomically. Acceptance uses a single transaction, row locking/conditional updates and unique constraints. Sensitive commands use idempotency where retries can duplicate effects. Successful important actions append a sanitized audit record attributed from the session, never the request body.

Production database privileges should make match commercial snapshots and audit rows append-only/immutable for the runtime role.

## Authentication baseline and work before launch

- Database-backed revocable sessions; secure cookies in production.
- Exact trusted origins and CSRF/origin protections for auth and application mutations.
- Verified email is mandatory; public Better Auth sign-up is disabled. Public account applications create review-only records and never create access. A freshly authorized platform administrator may approve an application, atomically create its company and pending initial-ADMIN invitation, and trigger delivery from `konto@trejder.se`; rejection sends a notice without creating access. A platform administrator may also create a standalone SUPERADMIN credential account, or a dealer credential account whose ADMIN, TRADER or VIEWER role is bound to a selected active company.
- Invitation tokens contain 256 bits of randomness and only SHA-256 hashes are stored. Company and role are loaded from the locked row; acceptance payloads cannot override them.
- Existing accounts must be authenticated as the invitation email. A token may create a new verified credential identity because possession proves control of the destination mailbox.
- Membership and company status are reloaded on every dealer request. Suspension or revocation therefore removes dealer access without relying on browser state or global session revocation.
- Application mutations require an exact configured Origin. Better Auth keeps its own origin and CSRF protections.
- Successful password reset revokes the user's existing sessions.
- Password reset and verification delivery use the transactional email abstraction. Endpoint-specific distributed rate limiting remains deployment work.
- Production transactional email uses Resend with an API key supplied only at runtime. Invitations, verification and password-reset messages default to `Trejder <konto@trejder.se>`; the domain must be verified before production delivery. Provider response bodies and token-bearing message content are never logged.

## Images

Vehicle images use private storage and server-generated opaque object keys with 256 random bits, no tenant/listing identifiers, and no exposure in DTOs. Every upload, read, replacement and deletion first resolves a freshly authorized active company and tenant-scoped listing. Supported formats are JPEG, PNG and WebP, limited to 10 MB, with claimed MIME checked against file signatures and structural markers. Position is server-validated to 1–5 and PostgreSQL enforces uniqueness per listing.

Draft images may be added, replaced or removed. Active images may only be replaced atomically, preserving the 1–5 invariant. Sharp normalizes EXIF orientation and removes metadata. Plate Recognizer Snapshot Cloud receives the normalized image for bounding-box detection; its token is server-only. High-confidence boxes are blurred locally and only that result is stored. A no-plate result stores the normalized image. When the provider token is configured (or `PLATE_REDACTION_REQUIRED=true`), failed, unchecked or low-confidence checks cannot be published. Without a configured provider, images remain transparently marked `NOT_CHECKED` and publication remains available. Plate Recognizer documents 30-day rolling Cloud dashboard retention, so production use requires accepting that processor policy or deploying its on-premise SDK. Reads use an authenticated application route with `private, no-store` and `nosniff`; the R2 bucket is not public.

Marketplace image reads independently reload active membership and require an unexpired active listing. Withdrawing or expiring a listing therefore immediately removes its marketplace image access. Marketplace DTOs expose only application image routes, never object keys or image identifiers.

## Verification strategy

Before each feature ships, test direct API access, the complete role matrix, cross-tenant IDs, stale sessions, mass assignment, malformed input and invalid state transitions. Anonymity contract tests recursively reject forbidden keys and known bidder values. Acceptance requires real PostgreSQL concurrency tests with independent connections. UI tests supplement but never prove server authorization.

# Product

## Purpose

Trejder is a responsive Swedish dealer-to-dealer vehicle marketplace. It should be as quick to use as posting a vehicle to a dealer group, while providing controlled bidding and a reliable completed match.

## Primary workflow

Publishing stays deliberately short:

`Vehicle model -> model year (1950 through next year) -> mileage -> short comment -> deductible VAT yes/no -> publication duration (48–120 hours) -> 1–5 images -> publish`

There is no automatic vehicle lookup. Never invent specifications from a registration number or model.

Phase 2 implements this as one Swedish, mobile-first form. Images are checked server-side for visible registration plates; confident detections are blurred before publication. The dealer's own `/app/bilar` area contains only its active listings, drafts and withdrawn listings; it is not a marketplace feed.

## Account model

There is one company type: car dealer. The same company may publish, bid, accept bids and buy. A company can have multiple users:

- **ADMIN:** all dealer actions plus company users and settings.
- **TRADER:** listing, bidding, acceptance and completed-match actions.
- **VIEWER:** read-only access to the marketplace and its company's data.

Authorization is always server-side.

Dealer onboarding remains approval-based. A public applicant may submit contact and company details for manual review, but this never creates a user, company or membership. Platform administrators review pending, approved and rejected applications. Approval creates the dealer company and sends its initial ADMIN a single-use invitation; rejection sends a non-approval notice. The platform may also create approved credentials directly: a SUPERADMIN account needs no company, while ADMIN, TRADER and VIEWER authority always belongs to a selected existing company. There is no public self-registration, and a user can never attach themselves by entering an organization number or company ID. Company ADMIN users may invite additional ADMIN, TRADER or VIEWER users.

## Marketplace rules

- The marketplace shows every unexpired active listing, including the browsing dealer's own listings, newest first.
- The seller sees listing-scoped labels such as `Bidgivare 1`, never bidder identity before acceptance.
- A seller may accept any valid bid, not necessarily the highest.
- One listing can create at most one match.
- Only the matched seller and buyer learn each other's identity and contact details.
- Trejder Premium costs 699 SEK excluding VAT per dealer company/month and includes two active dealer users. Each additional active membership costs 199 SEK excluding VAT/month. Suspended/revoked memberships and pending invitations do not count.
- The intended future accepted dealer match fee is 899 SEK excluding VAT for each dealer side. Charging it remains out of scope until the match-payment phase; the current runtime match snapshot policy is unchanged.
- Dealer access is Gratis (time-limited), Premium or Obetald. Billing uses Stripe-hosted Checkout and Customer Portal; Trejder never collects card details.

## Private sellers

A verified `PRIVATE_CUSTOMER` may publish and manage only their own vehicles, receive dealer bids, answer public listing questions, exchange bid-gated messages and accept one bid. Private customers cannot browse the marketplace, bid, buy, manage dealer companies or access dealer-only routes. Dealer and seller identity remains hidden from the counterparty until a bid is accepted.

## Phase 3.5 subscription access

The server is authoritative for both membership and subscription access. Manual block, manual Premium, active free access and Stripe state are evaluated in that precedence order. A Stripe webhook cannot erase a manual decision. Free access has an explicit end instant and expires to Obetald unless a lower-precedence active Stripe subscription applies. Gratis cannot be granted while a live Stripe subscription exists, preventing accidental parallel charging; the subscription must first be ended in Stripe.

## Current non-goals

No vehicle registry integration, CRM, accounting, Fortnox, Blocket, inventory/ERP, financing, warranties, automated valuation, AI descriptions, chart dashboards, native apps, transaction charging, coupons, credits, annual plans or custom card collection.

## Product language and units

UI copy is Swedish. The user-facing mileage convention is Swedish `mil`; the database stores canonical integer kilometres. Currency is SEK and monetary values are integer öre.

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
- Target dealer subscription: 699 SEK excluding VAT per company/month.
- Accepted dealer match fee: 499 SEK excluding VAT for seller and 499 SEK excluding VAT for buyer.
- Payments and invoicing are not part of the current implementation.

## Current non-goals

No private sellers, vehicle registry integration, CRM, accounting, Fortnox, Blocket, inventory/ERP, financing, warranties, automated valuation, AI descriptions, messaging, chart dashboards or native apps.

Private sellers may be explored later. Do not add polymorphic architecture solely for that possibility.

## Product language and units

UI copy is Swedish. The user-facing mileage convention is Swedish `mil`; the database stores canonical integer kilometres. Currency is SEK and monetary values are integer öre.

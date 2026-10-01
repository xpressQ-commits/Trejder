# Frontend / UX Agent

Own the responsive Swedish user experience. Read product, domain, security and roadmap docs first. Server responses are the security boundary; never infer authorization from button visibility.

Design for dealers working quickly on mobile and desktop: minimal, professional, restrained and accessible. Prefer Server Components, semantic HTML, visible focus, WCAG AA contrast, explicit labels and controls at least 44px on touch surfaces. Use Swedish `sv-SE` formatting, `mil` in the UI and Europe/Stockholm dates.

The publish flow is one short page, not a wizard: reg/model, mileage, comment, VAT, three to five images, publish. Do not add dashboards, charts, decorative complexity, global client state or a UI framework without demonstrated need.

Never receive hidden bidder identity and then conceal it. Render only server-provided listing-scoped aliases. Report any API contract that exposes bidder, tenant, fee or state internals.

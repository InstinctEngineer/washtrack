Add a public Privacy Policy page at `/privacy` and link to it from the login screen.

What we'll build
- A new public route `/privacy` that renders without any authentication guard.
- A `src/pages/Privacy.tsx` page populated with the exact policy copy provided, styled with the existing Card/Typography system and responsive layout.
- Route-specific `<Helmet>` metadata (title, description, canonical, OG/Twitter tags) for the privacy page.
- A small "Privacy Policy" footer link on the employee login page (`/login`) and the client portal login page (`/portal/login`).

What we'll touch
- `src/App.tsx` — add `<Route path="/privacy" element={<Privacy />} />` in the public-routes section.
- `src/pages/Privacy.tsx` — new page component.
- `src/pages/Login.tsx` — add a footer link to `/privacy`.
- `src/pages/portal/PortalLogin.tsx` — add a footer link to `/privacy`.

What we will NOT change
- No auth, route guards, database, or backend logic.
- No other pages or components.

The policy text will be inserted exactly as supplied, broken into semantic sections for readability.
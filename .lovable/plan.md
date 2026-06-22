## Problems

1. The admin error-report modal shows two reply systems: the legacy "Response to user" block (Textarea + "Send response" / "Mark resolved" footer buttons) and the newer "Conversation" thread (replies list + "Send reply" button). Only one is needed.
2. Submitting a new error report does not email `nwarder@esd2.com`. `send-error-report-email` currently sends through the Lovable Resend connector gateway, which rejects the request with `lovable_api_key_not_registered`. The working `send-welcome-email` function bypasses the gateway and calls Resend directly with `RESEND_API_KEY`.

## Changes

### 1) Consolidate the admin reply UI (`src/pages/AdminDashboard.tsx`)

Keep only the threaded "Conversation" panel.

- Remove the "Response to user" section: label, helper text, the `Textarea` bound to `responseText`, and related state (`responseText`, `sendingResponse`).
- Remove the "Send response" footer button and `handleSendResponse`. Keep "Close" and "Mark resolved / Reopen".
- Drop the `useEffect` line that seeds `responseText` from `selectedReport.admin_response`.
- No schema change; `error_report_replies` remains the single source of truth (matching `MyErrorReports`).

### 2) Make the error-report email use the same path as user-creation emails (`supabase/functions/send-error-report-email/index.ts`)

Mirror `_shared/welcome-email.ts`'s approach so it works with the existing, proven setup.

- Stop calling `https://connector-gateway.lovable.dev/resend/emails` with `LOVABLE_API_KEY` + `X-Connection-Api-Key`.
- Call `https://api.resend.com/emails` directly with `Authorization: Bearer ${RESEND_API_KEY}`.
- Remove the `LOVABLE_API_KEY` env check; keep `RESEND_API_KEY` and `ERROR_REPORT_EMAIL` checks.
- Keep the rest of the function (auth check, report lookup, signed screenshot URL, HTML builder) unchanged.

No new secrets required — `RESEND_API_KEY` is already configured and in use by the welcome email flow.

## Out of scope

- No changes to `MyErrorReports.tsx`, `ErrorReportButton.tsx`, or DB schema. Legacy `admin_response` / `responded_at` columns stay in place untouched.

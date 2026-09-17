# Why the phone and desktop disagree — and how to fix it

## What the records actually show

I checked the live data before writing this:

- Alexander Richards' last saved washes at ATW are dated **Sep 11**. Nothing from him, or from anyone else at ATW, has been saved since.
- His account shows **no activity of any kind since Sep 11** — no logins, no taps, nothing reaching the server.
- Other crews saved work every day this week, so the system as a whole is accepting entries fine.

So the desktop is not showing a stale copy. The desktop is right, and the phone is showing work that never reached the server. The billing data genuinely isn't there.

## Why this keeps happening more often

The app is installed on phones as a home-screen app. Once installed it keeps running its own stored copy of the app and stays open for weeks. Three gaps let a washer believe they saved when they didn't:

1. **No offline warning.** In a lot or a warehouse with bad signal, taps register on screen but the save silently fails or never returns. The list keeps showing the items as picked.
2. **No retry.** If a save fails, nothing is queued and nothing is retried when the signal returns. The work is simply lost.
3. **No sign that the login expired.** When the stored login goes stale, saves are rejected but the screen still looks normal.

On the office side, a report page left open all day never refreshes on its own, so even correct new entries can look missing until someone reloads.

## The fix

### Phone side — make a failed save impossible to miss
- Show a clear offline banner at the top of the washer screen when the device has no connection.
- Keep unsubmitted picks visually marked as "not saved yet" and never let them look identical to confirmed, saved work.
- After submitting, confirm the entries back from the server before clearing the screen. If confirmation doesn't come, keep the picks and show a red "Not saved — retry" state instead of a success message.
- Queue failed submissions on the device and retry automatically when the connection returns, with a visible "N entries waiting to save" counter until they land.
- Detect an expired login and send the user to sign in again instead of failing quietly.
- Show an "Update available — tap to reload" prompt when a newer version of the app has been published, so phones and desktops run the same version.

### Office side — keep reports current
- Refresh the work data automatically when the tab is brought back into focus, plus a light refresh on a timer.
- Show "Updated at HH:MM" with a manual Refresh button on the weekly work and reporting screens.

### Right now — recover this week's ATW billing
Alex's Sep 14-16 washes are not in the system in any form; they only exist on his screen. He will need to re-enter them (the app allows back-dating to a past day), or send the counts so they can be entered on his behalf before invoicing.

## Technical notes

- Root cause confirmed by query: zero `work_logs` rows for ATW's location after 2026-09-11, and zero `activity_logs` rows for the user after 2026-09-11.
- `EmployeeDashboard.handleBatchSubmit` clears `pendingEntries` on the success path only, but a stalled/aborted fetch or an auth failure surfaces as a single toast that is easy to miss on a phone in the field; nothing persists the batch.
- Add a small persisted queue (localStorage/IndexedDB keyed by user + work date) written before the insert and cleared only after the server returns rows; flush on `online` and on app focus.
- Add `online`/`offline` listeners and a `navigator.onLine` banner in the employee layout.
- Add `visibilitychange`/`focus` refetch to `FinanceThisWeek` and `FinanceDashboard` fetch effects, plus an interval refresh and a "last updated" timestamp.
- Surface the vite-plugin-pwa update flow with `useRegisterSW` (`needRefresh` -> reload prompt) instead of the current silent autoUpdate.

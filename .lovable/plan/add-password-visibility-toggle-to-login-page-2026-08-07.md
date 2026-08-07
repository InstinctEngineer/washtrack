# Add Password Visibility Toggle to Login Page

## Goal
Add an eye icon to the password field on the internal employee login page (`/login`) so users can temporarily reveal what they typed. The password should show while the eye icon is pressed/held and hide again when released.

## Changes

### `src/pages/Login.tsx`
- Import `Eye` icon from `lucide-react`.
- Add local state: `showPassword` (boolean).
- Wrap the password `Input` in a relative container.
- Add an absolute right-side button containing the `Eye` icon.
- Attach pointer/touch events to the button:
  - `onMouseDown` / `onTouchStart`: set `showPassword` to `true`
  - `onMouseUp` / `onMouseLeave` / `onTouchEnd`: set `showPassword` to `false`
- Set the password input `type` to `"text"` when `showPassword` is true, otherwise `"password"`.
- Add `aria-label="Show password"` (or similar) to the toggle button for accessibility.
- Keep existing validation, loading, and redirect behavior unchanged.

## Optional follow-up
Apply the same visibility toggle to `src/pages/portal/PortalLogin.tsx` if you want the client portal login to behave the same way.

## Verification
- Open `/login` in the preview.
- Type into the password field and press/hold the eye icon — the text should reveal.
- Release the icon — the text should hide again.
- Confirm form submission and login still work normally.

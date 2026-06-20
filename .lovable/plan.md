## Problem

In Messages, the "Read by" list shows "Unknown" for some users. Root cause: the `get_user_display_info` RPC filters `WHERE is_active = true`, so any deactivated user (e.g., Rylie Bender in the current data) returns no row and the UI falls back to "Unknown". The same issue would also affect deactivated message authors and reply authors.

## Fix

Update the `get_user_display_info` security-definer function to return display info for **all** users (active or inactive). Returning only `id` + `name` remains safe — it's the same minimal data exposed today, just no longer hidden when an account is deactivated.

```sql
CREATE OR REPLACE FUNCTION public.get_user_display_info(user_ids uuid[])
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id, u.name
  FROM public.users u
  WHERE u.id = ANY(user_ids);
$$;
```

No frontend changes required — `Messages.tsx` will now resolve names for deactivated users automatically, eliminating the "Unknown" labels in Read by, message authors, recipients, and replies.

## Out of scope

- No schema changes, no RLS changes, no UI changes.
- Not adding an "(inactive)" badge — can be a follow-up if you want it.
import { supabase } from '@/integrations/supabase/client';

const SENSITIVE_FIELDS = [
  'password', 'ssn', 'social_security', 'pay_rate', 'commission_percentage',
  'date_of_birth', 'dob', 'emergency_contact_phone', 'emergency_contact_name',
  'account_locked_until', 'failed_login_attempts', 'last_login_ip',
  'two_factor_enabled', 'credentials_shared_at', 'password_changed_at',
  'must_change_password', 'token', 'secret', 'api_key'
];

const FLUSH_INTERVAL_MS = 5000;
const MAX_BUFFER_SIZE = 10;

interface LogEntry {
  user_id: string;
  action: string;
  page?: string;
  target?: string;
  metadata?: Record<string, any>;
}

let buffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let currentUserId: string | null = null;
let globalListenersAttached = false;

function redactSensitive(data: Record<string, any> | null | undefined): Record<string, any> | null {
  if (!data) return null;
  const redacted: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      redacted[key] = redactSensitive(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

async function flushBuffer() {
  if (buffer.length === 0) return;
  const toSend = [...buffer];
  buffer = [];

  try {
    await supabase.from('activity_logs' as any).insert(toSend);
  } catch {
    // Fire-and-forget — don't let logging errors affect the app
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushBuffer();
  }, FLUSH_INTERVAL_MS);
}

function enqueue(entry: LogEntry) {
  buffer.push(entry);
  if (buffer.length >= MAX_BUFFER_SIZE) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flushBuffer();
  } else {
    scheduleFlush();
  }
}

// Set the current user for logging
export function setLoggerUser(userId: string | null) {
  currentUserId = userId;
}

// Log a page view
export function logPageView(page: string) {
  if (!currentUserId) return;
  enqueue({ user_id: currentUserId, action: 'page_view', page });
}

// Log a generic action (button click, form open, etc.)
export function logAction(action: string, target?: string, metadata?: Record<string, any>) {
  if (!currentUserId) return;
  enqueue({
    user_id: currentUserId,
    action,
    page: window.location.pathname,
    target,
    metadata: redactSensitive(metadata),
  });
}

// Log a data mutation (create/update/delete)
export function logDataChange(
  operation: 'data_create' | 'data_update' | 'data_delete',
  tableName: string,
  metadata?: Record<string, any>
) {
  if (!currentUserId) return;
  enqueue({
    user_id: currentUserId,
    action: operation,
    page: window.location.pathname,
    target: tableName,
    metadata: redactSensitive(metadata),
  });
}

// ── Global UI interaction tracking ──────────────────────────────────

/** Extract a human-readable label from a DOM element */
function getElementLabel(el: HTMLElement): string {
  // Try aria-label first
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  // Try innerText (but limit length)
  const text = el.innerText?.trim();
  if (text && text.length <= 80) return text;
  if (text && text.length > 80) return text.slice(0, 77) + '...';

  // Try title, placeholder, name, alt
  const title = el.getAttribute('title');
  if (title) return title;

  const placeholder = (el as HTMLInputElement).placeholder;
  if (placeholder) return `[${placeholder}]`;

  const name = el.getAttribute('name');
  if (name) return `[name=${name}]`;

  const alt = (el as HTMLImageElement).alt;
  if (alt) return alt;

  // Fallback to tag + class
  const cls = el.className && typeof el.className === 'string'
    ? '.' + el.className.split(' ').slice(0, 2).join('.')
    : '';
  return `<${el.tagName.toLowerCase()}${cls}>`;
}

/** Get the closest interactive ancestor or the element itself */
function getInteractiveTarget(el: HTMLElement): HTMLElement | null {
  return el.closest('button, a, [role="button"], [role="menuitem"], [role="tab"], [role="option"], [role="checkbox"], [role="switch"], input, select, textarea, [data-log]');
}

/** Determine the element "type" for categorization */
function getElementType(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role');

  if (tag === 'button' || role === 'button') return 'button';
  if (tag === 'a') return 'link';
  if (role === 'menuitem') return 'menu_item';
  if (role === 'tab') return 'tab';
  if (role === 'option') return 'option';
  if (role === 'checkbox' || role === 'switch') return 'toggle';
  if (tag === 'input') return 'input';
  if (tag === 'select') return 'select';
  if (tag === 'textarea') return 'textarea';
  return tag;
}

/** Check if this is a sensitive input we should not log values for */
function isSensitiveInput(el: HTMLElement): boolean {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  const name = (el.getAttribute('name') || '').toLowerCase();
  const type = (el as HTMLInputElement).type?.toLowerCase();
  if (type === 'password') return true;
  return SENSITIVE_FIELDS.some(f => name.includes(f));
}

/** Global click handler */
function handleGlobalClick(e: MouseEvent) {
  if (!currentUserId) return;
  const rawTarget = e.target as HTMLElement;
  if (!rawTarget) return;

  const el = getInteractiveTarget(rawTarget);
  if (!el) return; // Ignore clicks on non-interactive elements

  const elType = getElementType(el);
  const label = getElementLabel(el);

  // Build metadata
  const metadata: Record<string, any> = { element_type: elType };

  // Add href for links
  if (el instanceof HTMLAnchorElement && el.href) {
    metadata.href = el.pathname || el.href;
  }

  // Add data-log attribute value if present
  const dataLog = el.getAttribute('data-log');
  if (dataLog) metadata.data_log = dataLog;

  // Find closest dialog/modal for context
  const dialog = el.closest('[role="dialog"], [data-state="open"]');
  if (dialog) {
    const dialogTitle = dialog.querySelector('[class*="DialogTitle"], [class*="SheetTitle"], h2, h3');
    if (dialogTitle) {
      metadata.dialog = (dialogTitle as HTMLElement).innerText?.trim()?.slice(0, 60);
    }
  }

  enqueue({
    user_id: currentUserId,
    action: 'click',
    page: window.location.pathname,
    target: label,
    metadata: redactSensitive(metadata),
  });
}

/** Global focus-out handler for inputs — logs what field was interacted with (not the value for sensitive fields) */
function handleGlobalChange(e: Event) {
  if (!currentUserId) return;
  const el = e.target as HTMLElement;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) return;

  const label = getElementLabel(el);
  const metadata: Record<string, any> = {
    element_type: getElementType(el),
    field_name: el.getAttribute('name') || el.getAttribute('id') || undefined,
  };

  // Log the value only if NOT sensitive (and truncate long values)
  if (!isSensitiveInput(el)) {
    const val = el.value;
    if (val && val.length > 0) {
      metadata.value = val.length > 100 ? val.slice(0, 97) + '...' : val;
    }
  } else {
    metadata.value = '[REDACTED]';
  }

  // Find form context
  const form = el.closest('form');
  if (form) {
    const formName = form.getAttribute('name') || form.getAttribute('aria-label') || form.id;
    if (formName) metadata.form = formName;
  }

  enqueue({
    user_id: currentUserId,
    action: 'input_change',
    page: window.location.pathname,
    target: label,
    metadata: redactSensitive(metadata),
  });
}

/** Global form submit handler */
function handleGlobalSubmit(e: Event) {
  if (!currentUserId) return;
  const form = e.target as HTMLFormElement;
  if (!(form instanceof HTMLFormElement)) return;

  const formName = form.getAttribute('name') || form.getAttribute('aria-label') || form.id || 'unnamed_form';

  // Collect field names (not values) to show what was submitted
  const fieldNames: string[] = [];
  const formData = new FormData(form);
  for (const key of formData.keys()) {
    fieldNames.push(key);
  }

  enqueue({
    user_id: currentUserId,
    action: 'form_submit',
    page: window.location.pathname,
    target: formName,
    metadata: { fields: fieldNames },
  });
}

/** Attach global event listeners — call once */
export function attachGlobalListeners() {
  if (globalListenersAttached) return;
  globalListenersAttached = true;

  document.addEventListener('click', handleGlobalClick, { capture: true, passive: true });
  document.addEventListener('change', handleGlobalChange, { capture: true, passive: true });
  document.addEventListener('submit', handleGlobalSubmit, { capture: true, passive: true });
}

/** Detach global event listeners */
export function detachGlobalListeners() {
  if (!globalListenersAttached) return;
  globalListenersAttached = false;

  document.removeEventListener('click', handleGlobalClick, { capture: true });
  document.removeEventListener('change', handleGlobalChange, { capture: true });
  document.removeEventListener('submit', handleGlobalSubmit, { capture: true });
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushBuffer();
    }
  });
}

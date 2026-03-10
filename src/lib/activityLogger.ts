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

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushBuffer();
    }
  });
}

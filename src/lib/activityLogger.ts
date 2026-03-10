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

// ── Dialog context tracking ────────────────────────────────────────
let currentDialogContext: string | null = null;
let dialogObserver: MutationObserver | null = null;

function updateDialogContext() {
  const dialogs = document.querySelectorAll('[role="dialog"][data-state="open"]');
  if (dialogs.length === 0) {
    currentDialogContext = null;
    return;
  }
  // Get the topmost (last) open dialog
  const topDialog = dialogs[dialogs.length - 1];
  const titleEl = topDialog.querySelector(
    '[class*="DialogTitle"], [class*="SheetTitle"], [class*="AlertDialogTitle"], h2, h3'
  );
  currentDialogContext = titleEl
    ? (titleEl as HTMLElement).innerText?.trim()?.slice(0, 80) || null
    : 'Unknown Dialog';
}

function startDialogObserver() {
  if (dialogObserver) return;
  dialogObserver = new MutationObserver(() => {
    updateDialogContext();
  });
  dialogObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-state'],
  });
}

// ── Correlation ID for form→DB linking ─────────────────────────────
let activeCorrelationId: string | null = null;
let correlationTimer: ReturnType<typeof setTimeout> | null = null;

function generateCorrelationId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function setCorrelationId() {
  activeCorrelationId = generateCorrelationId();
  if (correlationTimer) clearTimeout(correlationTimer);
  correlationTimer = setTimeout(() => {
    activeCorrelationId = null;
    correlationTimer = null;
  }, 3000); // 3-second TTL
}

// ── Redaction ──────────────────────────────────────────────────────

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

// ── Buffer & flush ─────────────────────────────────────────────────

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

// ── Public API ──────────────────────────────────────────────────────

export function setLoggerUser(userId: string | null) {
  currentUserId = userId;
}

export function logPageView(page: string) {
  if (!currentUserId) return;
  enqueue({ user_id: currentUserId, action: 'page_view', page });
}

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

// ── Auth event logging ─────────────────────────────────────────────

export function logAuthEvent(
  action: 'auth_login' | 'auth_logout' | 'auth_login_failed' | 'auth_signup' | 'auth_password_change' | 'auth_password_reset' | 'auth_session_refresh' | 'auth_token_expired' | 'auth_error',
  metadata?: Record<string, any>
) {
  const userId = currentUserId || metadata?.user_id || 'anonymous';
  enqueue({
    user_id: userId,
    action,
    page: window.location.pathname,
    target: metadata?.email ? `user:${metadata.email}` : undefined,
    metadata: redactSensitive({
      ...metadata,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
    }),
  });
  // Flush auth events immediately
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushBuffer();
}

// ── Database operation logging ──────────────────────────────────────

export function logDbOperation(
  operation: 'db_insert' | 'db_update' | 'db_delete' | 'db_select' | 'db_rpc',
  target: string,
  metadata?: Record<string, any>
) {
  if (!currentUserId) return;
  enqueue({
    user_id: currentUserId,
    action: operation,
    page: window.location.pathname,
    target,
    metadata: redactSensitive(metadata),
  });
}

// ── URL parsing helpers ─────────────────────────────────────────────

function extractTableFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/rest\/v1\/([^?/]+)/);
    if (match && !match[1].startsWith('rpc')) return match[1];
  } catch {}
  return null;
}

function extractRpcFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/rest\/v1\/rpc\/([^?/]+)/);
    if (match) return match[1];
  } catch {}
  return null;
}

function extractFiltersFromUrl(url: string): Record<string, string> | null {
  try {
    const urlObj = new URL(url);
    const filters: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      // Skip Supabase internal params
      if (['select', 'apikey', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) return;
      filters[key] = value;
    });
    return Object.keys(filters).length > 0 ? filters : null;
  } catch {
    return null;
  }
}

async function parseRequestBody(init: RequestInit | undefined): Promise<Record<string, any> | null> {
  if (!init?.body) return null;
  try {
    let bodyText: string;
    if (typeof init.body === 'string') {
      bodyText = init.body;
    } else if (init.body instanceof ArrayBuffer) {
      bodyText = new TextDecoder().decode(init.body);
    } else {
      return null; // FormData, Blob, etc — skip
    }
    const parsed = JSON.parse(bodyText);
    // Handle arrays (batch inserts) — only log first few items
    if (Array.isArray(parsed)) {
      const items = parsed.slice(0, 3).map(item => redactSensitive(item));
      return { _batch: true, _count: parsed.length, items };
    }
    return redactSensitive(parsed);
  } catch {
    return null;
  }
}

// ── Global UI interaction tracking ──────────────────────────────────

function getElementLabel(el: HTMLElement): string {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const text = el.innerText?.trim();
  if (text && text.length <= 80) return text;
  if (text && text.length > 80) return text.slice(0, 77) + '...';

  const title = el.getAttribute('title');
  if (title) return title;

  const placeholder = (el as HTMLInputElement).placeholder;
  if (placeholder) return `[${placeholder}]`;

  const name = el.getAttribute('name');
  if (name) return `[name=${name}]`;

  const alt = (el as HTMLImageElement).alt;
  if (alt) return alt;

  const cls = el.className && typeof el.className === 'string'
    ? '.' + el.className.split(' ').slice(0, 2).join('.')
    : '';
  return `<${el.tagName.toLowerCase()}${cls}>`;
}

function getInteractiveTarget(el: HTMLElement): HTMLElement | null {
  return el.closest('button, a, [role="button"], [role="menuitem"], [role="tab"], [role="option"], [role="checkbox"], [role="switch"], input, select, textarea, [data-log]');
}

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

function isSensitiveInput(el: HTMLElement): boolean {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  const name = (el.getAttribute('name') || '').toLowerCase();
  const type = (el as HTMLInputElement).type?.toLowerCase();
  if (type === 'password') return true;
  return SENSITIVE_FIELDS.some(f => name.includes(f));
}

function handleGlobalClick(e: MouseEvent) {
  if (!currentUserId) return;
  const rawTarget = e.target as HTMLElement;
  if (!rawTarget) return;

  const el = getInteractiveTarget(rawTarget);
  if (!el) return;

  const elType = getElementType(el);
  const label = getElementLabel(el);

  const metadata: Record<string, any> = { element_type: elType };

  if (el instanceof HTMLAnchorElement && el.href) {
    metadata.href = el.pathname || el.href;
  }

  const dataLog = el.getAttribute('data-log');
  if (dataLog) metadata.data_log = dataLog;

  // Attach current dialog context
  if (currentDialogContext) {
    metadata.dialog = currentDialogContext;
  }

  const dialog = el.closest('[role="dialog"], [data-state="open"]');
  if (dialog && !metadata.dialog) {
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

function handleGlobalChange(e: Event) {
  if (!currentUserId) return;
  const el = e.target as HTMLElement;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) return;

  const label = getElementLabel(el);
  const metadata: Record<string, any> = {
    element_type: getElementType(el),
    field_name: el.getAttribute('name') || el.getAttribute('id') || undefined,
  };

  // Attach dialog context
  if (currentDialogContext) {
    metadata.dialog = currentDialogContext;
  }

  if (!isSensitiveInput(el)) {
    const val = el.value;
    if (val && val.length > 0) {
      metadata.value = val.length > 100 ? val.slice(0, 97) + '...' : val;
    }
  } else {
    metadata.value = '[REDACTED]';
  }

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

function handleGlobalSubmit(e: Event) {
  if (!currentUserId) return;
  const form = e.target as HTMLFormElement;
  if (!(form instanceof HTMLFormElement)) return;

  // Generate correlation ID to link this form submit to subsequent DB ops
  setCorrelationId();

  const formName = form.getAttribute('name') || form.getAttribute('aria-label') || form.id || 'unnamed_form';

  const fieldNames: string[] = [];
  const formData = new FormData(form);
  for (const key of formData.keys()) {
    fieldNames.push(key);
  }

  const metadata: Record<string, any> = { fields: fieldNames };
  if (activeCorrelationId) metadata.correlation = activeCorrelationId;
  if (currentDialogContext) metadata.dialog = currentDialogContext;

  enqueue({
    user_id: currentUserId,
    action: 'form_submit',
    page: window.location.pathname,
    target: formName,
    metadata,
  });
}

// ── Error, warning, and system fault tracking ──────────────────────

function handleGlobalError(e: ErrorEvent) {
  const userId = currentUserId || 'system';
  enqueue({
    user_id: userId,
    action: 'error',
    page: window.location.pathname,
    target: e.message?.slice(0, 200),
    metadata: {
      filename: e.filename,
      line: e.lineno,
      col: e.colno,
      stack: e.error?.stack?.slice(0, 500),
    },
  });
}

function handleUnhandledRejection(e: PromiseRejectionEvent) {
  const userId = currentUserId || 'system';
  const reason = e.reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  enqueue({
    user_id: userId,
    action: 'error',
    page: window.location.pathname,
    target: `Unhandled Promise: ${message.slice(0, 180)}`,
    metadata: {
      type: 'unhandled_rejection',
      stack: reason instanceof Error ? reason.stack?.slice(0, 500) : undefined,
    },
  });
}

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function interceptConsole() {
  console.error = (...args: any[]) => {
    originalConsoleError.apply(console, args);
    if (!currentUserId) return;
    const message = args.map(a => {
      if (a instanceof Error) return a.message;
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ').slice(0, 300);

    if (message.includes('activity_logs')) return;

    enqueue({
      user_id: currentUserId,
      action: 'console_error',
      page: window.location.pathname,
      target: message,
      metadata: { type: 'console.error' },
    });
  };

  console.warn = (...args: any[]) => {
    originalConsoleWarn.apply(console, args);
    if (!currentUserId) return;
    const message = args.map(a => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ').slice(0, 300);

    enqueue({
      user_id: currentUserId,
      action: 'warning',
      page: window.location.pathname,
      target: message,
      metadata: { type: 'console.warn' },
    });
  };
}

// ── Fetch interceptor with body capture ─────────────────────────────

const originalFetch = window.fetch;
function interceptFetch() {
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
    const init = args[1] as RequestInit | undefined;
    const method = init?.method || 'GET';

    // Pre-parse request body for mutations (before fetch consumes it)
    let requestBody: Record<string, any> | null = null;
    if (['POST', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && url.includes('/rest/v1/') && !url.includes('activity_logs')) {
      requestBody = await parseRequestBody(init);
    }

    try {
      const response = await originalFetch.apply(window, args);

      // Skip logging activity_logs requests to avoid loops
      if (url.includes('activity_logs')) return response;

      // Log failed HTTP requests (4xx/5xx)
      if (!response.ok && response.status >= 400) {
        const userId = currentUserId || 'system';
        enqueue({
          user_id: userId,
          action: response.status >= 500 ? 'system_fault' : 'network_error',
          page: window.location.pathname,
          target: `${method} ${response.status} ${response.statusText}`,
          metadata: {
            url: url.replace(/apikey=[^&]+/, 'apikey=[REDACTED]').slice(0, 300),
            method,
            status: response.status,
          },
        });
      }

      // Auto-log Supabase REST mutations with body capture
      if (url.includes('/rest/v1/') && !url.includes('/rpc/') && ['POST', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
        const tableName = extractTableFromUrl(url);
        if (tableName && tableName !== 'activity_logs') {
          const opMap: Record<string, string> = { POST: 'db_insert', PATCH: 'db_update', DELETE: 'db_delete' };
          const userId = currentUserId || 'system';
          
          const metadata: Record<string, any> = {
            method,
            status: response.status,
          };

          // Attach request body (redacted)
          if (requestBody) {
            metadata.body = requestBody;
          }

          // Attach query filters (for updates/deletes targeting specific records)
          const filters = extractFiltersFromUrl(url);
          if (filters) {
            metadata.filters = filters;
          }

          // Attach dialog/modal context
          if (currentDialogContext) {
            metadata.modal = currentDialogContext;
          }

          // Attach correlation ID from recent form submit
          if (activeCorrelationId) {
            metadata.correlation = activeCorrelationId;
          }

          enqueue({
            user_id: userId,
            action: opMap[method.toUpperCase()] || 'db_operation',
            page: window.location.pathname,
            target: tableName,
            metadata,
          });
        }
      }

      // Auto-log Supabase RPC calls
      if (url.includes('/rest/v1/rpc/') && method.toUpperCase() === 'POST') {
        const rpcName = extractRpcFromUrl(url);
        if (rpcName) {
          const userId = currentUserId || 'system';
          const metadata: Record<string, any> = {
            status: response.status,
          };

          if (requestBody) {
            metadata.args = requestBody;
          }

          if (currentDialogContext) {
            metadata.modal = currentDialogContext;
          }

          if (activeCorrelationId) {
            metadata.correlation = activeCorrelationId;
          }

          enqueue({
            user_id: userId,
            action: 'db_rpc',
            page: window.location.pathname,
            target: rpcName,
            metadata,
          });
        }
      }

      return response;
    } catch (err) {
      if (!url.includes('activity_logs')) {
        const userId = currentUserId || 'system';
        enqueue({
          user_id: userId,
          action: 'network_error',
          page: window.location.pathname,
          target: `Fetch failed: ${(err as Error).message?.slice(0, 150)}`,
          metadata: {
            url: url.replace(/apikey=[^&]+/, 'apikey=[REDACTED]').slice(0, 200),
            method,
          },
        });
      }
      throw err;
    }
  };
}

// ── Lifecycle ───────────────────────────────────────────────────────

export function attachGlobalListeners() {
  if (globalListenersAttached) return;
  globalListenersAttached = true;

  document.addEventListener('click', handleGlobalClick, { capture: true, passive: true });
  document.addEventListener('change', handleGlobalChange, { capture: true, passive: true });
  document.addEventListener('submit', handleGlobalSubmit, { capture: true, passive: true });
  window.addEventListener('error', handleGlobalError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
  interceptConsole();
  interceptFetch();
  startDialogObserver();
}

export function detachGlobalListeners() {
  if (!globalListenersAttached) return;
  globalListenersAttached = false;

  document.removeEventListener('click', handleGlobalClick, { capture: true });
  document.removeEventListener('change', handleGlobalChange, { capture: true });
  document.removeEventListener('submit', handleGlobalSubmit, { capture: true });
  window.removeEventListener('error', handleGlobalError);
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  window.fetch = originalFetch;
  if (dialogObserver) {
    dialogObserver.disconnect();
    dialogObserver = null;
  }
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushBuffer();
    }
  });
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = "WashTrack Errors <noreply@mail.esd2.com>";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(args: {
  reporterName: string;
  reporterEmail: string;
  description: string;
  pageUrl: string;
  userAgent: string;
  viewport: string;
  createdAt: string;
  screenshotUrl: string | null;
  appLink: string;
}): string {
  const desc = escapeHtml(args.description).replace(/\n/g, "<br/>");
  const screenshotBlock = args.screenshotUrl
    ? `<p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>Screenshot:</strong></p>
       <p style="margin:0 0 16px;"><a href="${args.screenshotUrl}"><img src="${args.screenshotUrl}" alt="Screenshot" style="max-width:100%;border-radius:8px;border:1px solid #e5e7eb;"/></a></p>`
    : `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">No screenshot attached.</p>`;

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td>
          <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#b91c1c;">New Error Report</h1>
          <p style="margin:0 0 20px;font-size:13px;color:#6b7280;">${escapeHtml(args.createdAt)}</p>

          <p style="margin:0 0 8px;font-size:14px;"><strong>Reported by:</strong> ${escapeHtml(args.reporterName)} (${escapeHtml(args.reporterEmail)})</p>
          <p style="margin:0 0 8px;font-size:14px;"><strong>Page:</strong> ${escapeHtml(args.pageUrl)}</p>
          <p style="margin:0 0 8px;font-size:14px;"><strong>Viewport:</strong> ${escapeHtml(args.viewport)}</p>
          <p style="margin:0 0 16px;font-size:12px;color:#6b7280;word-break:break-all;"><strong>User Agent:</strong> ${escapeHtml(args.userAgent)}</p>

          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin:0 0 20px;font-size:14px;line-height:1.55;">
            ${desc}
          </div>

          ${screenshotBlock}

          <p style="margin:24px 0 0;">
            <a href="${args.appLink}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px;">View in WashTrack</a>
          </p>
          <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">${args.appLink}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const reportId = String(body?.reportId ?? "").trim();
    if (!reportId) {
      return new Response(JSON.stringify({ error: "reportId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipient = Deno.env.get("ERROR_REPORT_EMAIL");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!recipient || !lovableKey || !resendKey) {
      console.error("Missing required env: ERROR_REPORT_EMAIL/LOVABLE_API_KEY/RESEND_API_KEY");
      return new Response(JSON.stringify({ error: "Email not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: report, error: reportErr } = await supabaseAdmin
      .from("error_reports")
      .select("id, description, screenshot_url, page_url, user_agent, viewport, reported_by, created_at")
      .eq("id", reportId)
      .maybeSingle();

    if (reportErr || !report) {
      return new Response(JSON.stringify({ error: "Report not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only the reporter (or admin) can trigger the email
    if (report.reported_by !== user.id) {
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const allowed = (roles ?? []).some((r: any) =>
        ["admin", "super_admin"].includes(r.role)
      );
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: reporter } = await supabaseAdmin
      .from("users")
      .select("name, email")
      .eq("id", report.reported_by)
      .maybeSingle();

    let screenshotUrl: string | null = null;
    if (report.screenshot_url) {
      const { data: signed } = await supabaseAdmin
        .storage
        .from("error-reports")
        .createSignedUrl(report.screenshot_url, 60 * 60 * 24 * 7);
      screenshotUrl = signed?.signedUrl ?? null;
    }

    const appBase = (Deno.env.get("APP_URL") ?? "https://washtracking.com").replace(/\/$/, "");
    const appLink = `${appBase}/admin/dashboard?errorReportId=${encodeURIComponent(report.id)}`;

    const html = buildHtml({
      reporterName: reporter?.name ?? "Unknown user",
      reporterEmail: reporter?.email ?? "unknown",
      description: report.description ?? "",
      pageUrl: report.page_url ?? "",
      userAgent: report.user_agent ?? "",
      viewport: report.viewport ?? "",
      createdAt: new Date(report.created_at).toLocaleString(),
      screenshotUrl,
      appLink,
    });

    const resp = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from: FROM,
        to: [recipient],
        subject: `Error report from ${reporter?.name ?? "user"} — ${report.page_url ?? ""}`,
        html,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Resend send failed:", resp.status, text);
      return new Response(JSON.stringify({ error: "Email send failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-error-report-email error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
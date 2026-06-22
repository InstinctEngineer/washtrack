// Shared helper to send the welcome / set-password email via Resend
// using a Supabase admin-generated recovery link.

export interface SendWelcomeEmailParams {
  email: string;
  name?: string;
  mode?: "welcome" | "reset";
}

export interface SendWelcomeEmailResult {
  sent: boolean;
  error?: string;
}

const FROM = "WashTrack <noreply@mail.esd2.com>";

function buildHtml(
  name: string | undefined,
  actionLink: string,
  mode: "welcome" | "reset",
): string {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const heading = mode === "reset" ? "Reset your WashTrack password" : "Welcome to WashTrack";
  const intro = mode === "reset"
    ? "A password reset was requested for your account. Click the button below to set a new password."
    : "An account was created for you. Click the button below to securely set your password and sign in.";
  const cta = mode === "reset" ? "Reset password" : "Set your password";
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <tr><td>
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#0f172a;">${heading}</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">${greeting}</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.55;">${intro}</p>
            <p style="margin:0 0 28px;">
              <a href="${actionLink}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px;">${cta}</a>
            </p>
            <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">This link is single-use and expires soon. If it doesn't work, ask an admin to resend the invite.</p>
            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">Or paste this link into your browser:<br/>${actionLink}</p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;">WashTrack — washtracking.com</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function sendWelcomeEmail(
  supabaseAdmin: any,
  { email, name, mode = "welcome" }: SendWelcomeEmailParams,
): Promise<SendWelcomeEmailResult> {
  try {
    const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!appUrl) return { sent: false, error: "APP_URL not configured" };
    if (!resendKey) return { sent: false, error: "RESEND_API_KEY not configured" };

    const redirectTo = `${appUrl}/change-password`;

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (error) {
      console.error("generateLink error:", error);
      return { sent: false, error: error.message ?? "Failed to generate link" };
    }

    const actionLink: string | undefined =
      data?.properties?.action_link ?? data?.action_link;
    if (!actionLink) {
      return { sent: false, error: "No action link returned" };
    }

    const html = buildHtml(name, actionLink, mode);
    const subject = mode === "reset"
      ? "Reset your WashTrack password"
      : "Welcome to WashTrack — set your password";
    const text = mode === "reset"
      ? `Reset your WashTrack password here: ${actionLink}\n\nThis link is single-use and expires soon.`
      : `Welcome to WashTrack.\n\nSet your password here: ${actionLink}\n\nThis link is single-use and expires soon.`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Resend error:", res.status, body);
      return { sent: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
    }

    return { sent: true };
  } catch (e) {
    console.error("sendWelcomeEmail unexpected error:", e);
    return { sent: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
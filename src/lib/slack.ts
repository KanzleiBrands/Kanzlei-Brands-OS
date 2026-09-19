/**
 * Posts to a Slack Incoming Webhook (https://api.slack.com/messaging/webhooks).
 * Silently no-ops (logging instead) when SLACK_WEBHOOK_URL isn't configured,
 * matching sendSystemEmail's fallback so a missing webhook never breaks the
 * calling flow.
 */
export async function sendSlackNotification(text: string): Promise<{ ok: boolean; error?: string }> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[slack] SLACK_WEBHOOK_URL not configured, skipping notification:", text);
    return { ok: false, error: "Slack ist nicht konfiguriert (SLACK_WEBHOOK_URL fehlt)." };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) return { ok: false, error: `Slack-Fehler ${response.status}` };
  return { ok: true };
}

// Fire-and-forget Discord alerts for news curation pipeline health.
// Posts to news_curation_alert_webhook_url in server_settings.

import { getAISetting } from "../serverSettings.js";

export type CurationAlertInput = {
  title: string;
  description: string;
  color?: number;
};

function webhookUrl(): string | null {
  const url = getAISetting("news_curation_alert_webhook_url");
  if (!url || !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//i.test(url)) return null;
  return url;
}

export async function sendNewsCurationAlert(input: CurationAlertInput): Promise<void> {
  const webhook = webhookUrl();
  if (!webhook) return;

  const payload = {
    username: "Nuggie · News",
    embeds: [
      {
        title: input.title.slice(0, 256),
        description: input.description.slice(0, 2000),
        color: input.color ?? 0xfbbf77
      }
    ]
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    }).finally(() => clearTimeout(timer));
  } catch (err) {
    console.error("[generalNews] curation alert webhook failed:", err);
  }
}

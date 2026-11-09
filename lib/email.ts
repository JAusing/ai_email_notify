import { Resend } from "resend";
import type { Digest } from "./digest";

// 寄件人使用 Resend 預設寄件人;收件人寫死
export const EMAIL_FROM = "每日晨報 <onboarding@resend.dev>";
export const EMAIL_TO = "jess.babu@gmail.com";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const fmt = (n: number | null, digits = 2) =>
  n == null ? "-" : n.toLocaleString("zh-TW", { maximumFractionDigits: digits });

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC','Microsoft JhengHei',Arial,sans-serif";

function section(title: string, body: string, bg = "#ffffff") {
  return `
  <tr><td style="padding:0 0 16px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border:1px solid #e4e4e7;border-radius:12px;">
      <tr><td style="padding:20px 24px;">
        <div style="font-size:12px;font-weight:600;letter-spacing:1px;color:#71717a;margin-bottom:10px;">${esc(title)}</div>
        ${body}
      </td></tr>
    </table>
  </td></tr>`;
}

const failed = (msg?: string) =>
  `<p style="margin:0;font-size:14px;color:#dc2626;">資料取得失敗${msg ? `:${esc(msg)}` : ""}</p>`;

export function renderEmail(d: Digest) {
  const errors = d.errors ?? {};
  const subject = `每日晨報 ${d.date}`;

  const summary = d.ai
    ? `<p style="margin:0;font-size:15px;line-height:1.8;color:#18181b;">${esc(d.ai.summary)}</p>`
    : failed(errors.ai);

  const encouragement = d.ai
    ? `<p style="margin:0;font-size:15px;line-height:1.8;color:#18181b;">${esc(d.ai.encouragement)}</p>`
    : failed(errors.ai);

  const w = d.weather;
  const weather = w
    ? `<div style="font-size:28px;font-weight:600;color:#18181b;">${w.currentTemp}°C
         <span style="font-size:15px;font-weight:400;color:#71717a;">${esc(w.condition)}</span></div>
       <div style="margin-top:8px;font-size:14px;color:#3f3f46;">
         最高 ${w.maxTemp}°C · 最低 ${w.minTemp}°C · 降雨機率 ${w.rainProbability}%</div>`
    : failed(errors.weather);

  const s = d.stock;
  let stock: string;
  if (s) {
    // 台股習慣:紅漲綠跌
    const up = (s.change ?? 0) >= 0;
    const color = up ? "#dc2626" : "#16a34a";
    const change =
      s.change != null
        ? `<span style="font-size:15px;font-weight:400;color:${color};">${up ? "▲" : "▼"} ${fmt(Math.abs(s.change))} (${fmt(Math.abs(s.changePercent ?? 0))}%)</span>`
        : "";
    stock = `<div style="font-size:28px;font-weight:600;color:#18181b;">${fmt(s.close)} ${change}</div>
       <div style="margin-top:4px;font-size:12px;color:#71717a;">交易日 ${esc(s.date)}</div>
       <div style="margin-top:8px;font-size:14px;color:#3f3f46;">
         開盤 ${fmt(s.open)} · 最高 ${fmt(s.high)} · 最低 ${fmt(s.low)} · 成交量 ${fmt(s.volume, 0)} 股</div>`;
  } else {
    stock = failed(errors.stock);
  }

  const news = d.news
    ? d.news
        .map(
          (n) => `<div style="padding:8px 0;border-top:1px solid #f4f4f5;">
            <a href="${esc(n.link)}" style="font-size:14px;font-weight:500;color:#18181b;text-decoration:none;">${esc(n.title)}</a>
            <div style="margin-top:2px;font-size:12px;color:#71717a;">${esc(
              new Date(n.pubDate).toLocaleString("zh-TW", {
                timeZone: "Asia/Taipei",
              }),
            )}</div></div>`,
        )
        .join("")
    : failed(errors.news);

  const html = `<!doctype html>
<html lang="zh-Hant">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:${FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
        <tr><td style="padding:0 0 16px 0;">
          <div style="font-size:22px;font-weight:600;color:#18181b;">每日晨報</div>
          <div style="font-size:13px;color:#71717a;">${esc(d.date)}</div>
        </td></tr>
        ${section("AI 晨報摘要", summary)}
        ${section("給你的一句話", encouragement, "#fffbeb")}
        ${section(`今日天氣${w ? ` · ${w.city}` : ""}`, weather)}
        ${section(`${s?.name ?? "台積電"}昨日股價${s ? ` · ${s.symbol}` : ""}`, stock)}
        ${section("今日科技新聞", news)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // 純文字版本,提升相容性與送達率
  const text = [
    `每日晨報 ${d.date}`,
    "",
    "【AI 晨報摘要】",
    d.ai?.summary ?? "資料取得失敗",
    "",
    "【給你的一句話】",
    d.ai?.encouragement ?? "資料取得失敗",
    "",
    "【今日天氣】",
    w
      ? `${w.city} ${w.condition},現在 ${w.currentTemp}°C,最高 ${w.maxTemp}°C / 最低 ${w.minTemp}°C,降雨機率 ${w.rainProbability}%`
      : "資料取得失敗",
    "",
    "【台積電昨日股價】",
    s
      ? `${s.date} 收盤 ${fmt(s.close)}(${s.change != null ? `${s.change >= 0 ? "+" : ""}${fmt(s.change)} / ${fmt(s.changePercent)}%` : "-"})`
      : "資料取得失敗",
    "",
    "【今日科技新聞】",
    ...(d.news ? d.news.map((n) => `- ${n.title}\n  ${n.link}`) : ["資料取得失敗"]),
  ].join("\n");

  return { subject, html, text };
}

export async function sendDigestEmail(digest: Digest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("缺少 RESEND_API_KEY");

  const { subject, html, text } = renderEmail(digest);
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: EMAIL_TO,
    subject,
    html,
    text,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return { id: data?.id, from: EMAIL_FROM, to: EMAIL_TO, subject };
}

import { createHash, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { buildDigest } from "../../../lib/digest";
import { sendDigestEmail } from "../../../lib/email";
import { connectDB } from "../../../lib/mongodb";
import { EmailLog } from "../../../models/EmailLog";

// 背景工作(after)最長可執行的秒數;部署平台若有上限,以平台為準
export const maxDuration = 60;

const sha256 =(s: string) => createHash("sha256").update(s).digest();

/**
 * 驗證 `Authorization: Bearer <CRON_SECRET>`。
 * 回傳 null 代表通過,否則回傳要直接送出的錯誤 Response。
 */
function authorize(request: Request): Response | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // 未設定密鑰時一律拒絕(fail closed),避免變成開放寄信
    return Response.json(
      { ok: false, error: "伺服器未設定 CRON_SECRET" },
      { status: 500 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  // 先雜湊成固定長度再用 timingSafeEqual 比對,避免時間差洩漏資訊
  if (!timingSafeEqual(sha256(token), sha256(secret))) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// cron-job.org 預設用 GET,也可改成 POST;兩種都支援,都需要密鑰
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  // 不等待:驗證通過就先回應 cron-job.org,實際工作交給 after() 在回應送出後繼續執行
  after(async () => {
    try {
      await runJob();
    } catch (e) {
      // 回應已送出,錯誤無法再回傳給呼叫端,只能記在伺服器 log
      console.error("[send-email] 背景寄信失敗:", e);
    }
  });

  return Response.json(
    { ok: true, message: "已受理,寄信作業在背景執行" },
    { status: 202 },
  );
}

/** 抓資料 → AI 統整 → 寄信 → 存 MongoDB。在背景執行,結果只寫 log。 */
async function runJob() {
  // 由伺服器重新產生晨報再寄出
  const digest = await buildDigest();
  if (!digest.ai) {
    console.error("[send-email] AI 晨報產生失敗,未寄出:", digest.errors);
    return;
  }

  const sent = await sendDigestEmail(digest);
  console.log(`[send-email] 已寄出 to=${sent.to} resendId=${sent.id}`);

  // 信已經寄出,存檔失敗只記 log,不要拋出
  try {
    await connectDB();
    const log = await EmailLog.create({
      from: sent.from,
      to: sent.to,
      subject: sent.subject,
      resendId: sent.id,
      date: digest.date,
      weather: digest.weather,
      stock: digest.stock,
      news: digest.news,
      ai: digest.ai,
      errors: digest.errors ?? null,
    });
    console.log(`[send-email] 已存入 MongoDB logId=${log._id}`);
  } catch (e) {
    console.error("[send-email] 寫入 MongoDB 失敗:", e);
  }
}

import { connectDB } from "../../../lib/mongodb";
import type { EmailLogItem } from "../../../lib/types";
import { EmailLog } from "../../../models/EmailLog";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit")) || 20, 1),
      50,
    );

    await connectDB();
    const docs = await EmailLog.find().sort({ sentAt: -1 }).limit(limit).lean();

    // 只回傳畫面需要的欄位(不含 from、resendId 等內部資訊)
    const logs: EmailLogItem[] = docs.map((d) => ({
      id: String(d._id),
      subject: d.subject,
      to: d.to,
      sentAt: d.sentAt.toISOString(),
      date: d.date,
      weather: d.weather ?? null,
      stock: d.stock ?? null,
      news: d.news ?? null,
      ai: d.ai?.summary
        ? { summary: d.ai.summary, encouragement: d.ai.encouragement ?? "" }
        : null,
      ...(d.errors && { errors: d.errors }),
    }));

    return Response.json({ ok: true, logs });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

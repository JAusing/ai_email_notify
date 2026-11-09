import { buildDigest } from "../../../lib/digest";

export async function GET() {
  const digest = await buildDigest();
  return Response.json(digest, { status: digest.ai ? 200 : 502 });
}

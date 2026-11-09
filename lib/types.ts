import type { Digest } from "./digest";

/** /api/email-logs 回傳的單筆寄信紀錄 */
export type EmailLogItem = Digest & {
  id: string;
  subject: string;
  to: string;
  sentAt: string; // ISO 字串
};

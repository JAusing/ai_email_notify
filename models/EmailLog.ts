import mongoose, { InferSchemaType, Model } from "mongoose";

const emailLogSchema = new mongoose.Schema(
  {
    // 寄信資訊
    from: { type: String, required: true },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    resendId: { type: String },
    sentAt: { type: Date, required: true, default: Date.now },

    // 晨報資料(寄出當下的快照)
    date: { type: String, required: true }, // YYYY-MM-DD(台北時區)
    weather: { type: mongoose.Schema.Types.Mixed, default: null },
    stock: { type: mongoose.Schema.Types.Mixed, default: null },
    news: { type: mongoose.Schema.Types.Mixed, default: null },
    ai: {
      type: new mongoose.Schema(
        { summary: String, encouragement: String },
        { _id: false },
      ),
      default: null,
    },
    errors: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

export type EmailLogDoc = InferSchemaType<typeof emailLogSchema>;

// 避免 HMR 時重複編譯 model
export const EmailLog: Model<EmailLogDoc> =
  (mongoose.models.EmailLog as Model<EmailLogDoc>) ||
  mongoose.model<EmailLogDoc>("EmailLog", emailLogSchema);

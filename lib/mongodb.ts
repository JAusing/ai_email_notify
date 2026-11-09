import mongoose from "mongoose";

// 開發模式下 HMR 會重新載入模組,把連線快取在 globalThis 避免重複建立連線
const globalForMongoose = globalThis as unknown as {
  mongooseConn?: Promise<typeof mongoose>;
};

export function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("缺少 MONGODB_URI");

  if (!globalForMongoose.mongooseConn) {
    globalForMongoose.mongooseConn = mongoose.connect(uri).catch((e) => {
      // 連線失敗時清掉快取,下次請求才能重試
      globalForMongoose.mongooseConn = undefined;
      throw e;
    });
  }
  return globalForMongoose.mongooseConn;
}

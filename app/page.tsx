"use client";

import { useEffect, useState } from "react";
import type { Digest } from "../lib/digest";

function Card({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/15 dark:bg-zinc-900 ${className}`}
    >
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Unavailable({ message }: { message?: string }) {
  return (
    <p className="text-sm text-red-600 dark:text-red-400">
      資料取得失敗{message ? `:${message}` : ""}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-base font-medium">{value}</dd>
    </div>
  );
}

const fmt = (n: number | null, digits = 2) =>
  n == null ? "-" : n.toLocaleString("zh-TW", { maximumFractionDigits: digits });

export default function Home() {
  const [data, setData] = useState<Digest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // 初始 loading 為 true;重新整理時由 refresh() 設定,effect 內只在回呼裡 setState
    fetch("/api/daily-digest", { cache: "no-store" })
      .then((res) => res.json() as Promise<Digest>)
      // 部分資料失敗時 API 仍會回傳可用內容,所以不論狀態碼都顯示
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refresh = () => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  };

  const errors = data?.errors ?? {};

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10 font-sans dark:bg-black">
      <main className="w-full max-w-3xl space-y-5">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">每日晨報</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {data?.date ?? "載入中…"}
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-full bg-foreground px-4 py-2 text-sm text-background transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {loading ? "載入中…" : "重新整理"}
          </button>
        </header>

        {error && (
          <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            無法連線到 API:{error}
          </p>
        )}

        {loading && !data && (
          <p className="py-20 text-center text-zinc-500">
            正在整理今天的資訊,約需 5~15 秒…
          </p>
        )}

        {data && (
          <div className={loading ? "space-y-5 opacity-60" : "space-y-5"}>
            <Card title="AI 晨報摘要">
              {data.ai ? (
                <p className="leading-7">{data.ai.summary}</p>
              ) : (
                <Unavailable message={errors.ai} />
              )}
            </Card>

            <Card
              title="給你的一句話"
              className="bg-amber-50 dark:bg-amber-950/40"
            >
              {data.ai ? (
                <p className="leading-7">{data.ai.encouragement}</p>
              ) : (
                <Unavailable message={errors.ai} />
              )}
            </Card>

            <div className="grid gap-5 sm:grid-cols-2">
              <Card title={`今日天氣${data.weather ? ` · ${data.weather.city}` : ""}`}>
                {data.weather ? (
                  <>
                    <p className="text-3xl font-semibold">
                      {data.weather.currentTemp}°C
                      <span className="ml-2 text-base font-normal text-zinc-500 dark:text-zinc-400">
                        {data.weather.condition}
                      </span>
                    </p>
                    <dl className="mt-4 grid grid-cols-3 gap-3">
                      <Stat label="最高" value={`${data.weather.maxTemp}°C`} />
                      <Stat label="最低" value={`${data.weather.minTemp}°C`} />
                      <Stat
                        label="降雨機率"
                        value={`${data.weather.rainProbability}%`}
                      />
                    </dl>
                  </>
                ) : (
                  <Unavailable message={errors.weather} />
                )}
              </Card>

              <Card
                title={`${data.stock?.name ?? "台積電"}昨日股價${data.stock ? ` · ${data.stock.symbol}` : ""}`}
              >
                {data.stock ? (
                  <>
                    <p className="text-3xl font-semibold">
                      {fmt(data.stock.close)}
                      {data.stock.change != null && (
                        // 台股習慣:紅漲綠跌
                        <span
                          className={`ml-2 text-base font-normal ${
                            data.stock.change >= 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-600 dark:text-green-400"
                          }`}
                        >
                          {data.stock.change >= 0 ? "▲" : "▼"}{" "}
                          {fmt(Math.abs(data.stock.change))} (
                          {fmt(Math.abs(data.stock.changePercent ?? 0))}%)
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      交易日 {data.stock.date}
                    </p>
                    <dl className="mt-4 grid grid-cols-2 gap-3">
                      <Stat label="開盤" value={fmt(data.stock.open)} />
                      <Stat label="最高" value={fmt(data.stock.high)} />
                      <Stat label="最低" value={fmt(data.stock.low)} />
                      <Stat
                        label="成交量(股)"
                        value={fmt(data.stock.volume, 0)}
                      />
                    </dl>
                  </>
                ) : (
                  <Unavailable message={errors.stock} />
                )}
              </Card>
            </div>

            <Card title="今日科技新聞">
              {data.news ? (
                <ul className="divide-y divide-black/10 dark:divide-white/15">
                  {data.news.map((n) => (
                    <li key={n.link} className="py-3 first:pt-0 last:pb-0">
                      <a
                        href={n.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline"
                      >
                        {n.title}
                      </a>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {new Date(n.pubDate).toLocaleString("zh-TW", {
                          timeZone: "Asia/Taipei",
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <Unavailable message={errors.news} />
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

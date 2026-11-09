const TZ = "Asia/Taipei";

// 台北座標
const LAT = 25.033;
const LON = 121.565;

const WEATHER_CODES: Record<number, string> = {
  0: "晴朗",
  1: "大致晴朗",
  2: "多雲",
  3: "陰天",
  45: "有霧",
  48: "霧凇",
  51: "毛毛雨",
  53: "毛毛雨",
  55: "濃毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  80: "陣雨",
  81: "陣雨",
  82: "強陣雨",
  95: "雷雨",
  96: "雷雨夾冰雹",
  99: "強雷雨夾冰雹",
};

export type Weather = {
  city: string;
  date: string;
  condition: string;
  currentTemp: number;
  maxTemp: number;
  minTemp: number;
  rainProbability: number;
};

export type Stock = {
  symbol: string;
  name: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  change: number | null;
  changePercent: number | null;
};

export type NewsItem = { title: string; link: string; pubDate: string };

export type Digest = {
  date: string;
  weather: Weather | null;
  stock: Stock | null;
  news: NewsItem[] | null;
  ai: { summary: string; encouragement: string } | null;
  errors?: Record<string, string>;
};

export function dateInTaipei(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
}

async function getWeather(): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=${encodeURIComponent(TZ)}&forecast_days=1`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = await res.json();
  const code = data.daily.weather_code[0] as number;
  return {
    city: "台北",
    date: data.daily.time[0] as string,
    condition: WEATHER_CODES[code] ?? `天氣代碼 ${code}`,
    currentTemp: data.current.temperature_2m as number,
    maxTemp: data.daily.temperature_2m_max[0] as number,
    minTemp: data.daily.temperature_2m_min[0] as number,
    rainProbability: data.daily.precipitation_probability_max[0] as number,
  };
}

async function getTsmcStock(): Promise<Stock> {
  const url =
    "https://query1.finance.yahoo.com/v8/finance/chart/2330.TW?range=10d&interval=1d";
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`);
  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error("Yahoo Finance: 無資料");

  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators.quote[0];
  const today = dateInTaipei(new Date());

  // 取「今天以前」最後一個交易日(昨天若休市則為最近一個交易日)
  const rows = timestamps
    .map((t, i) => ({
      date: dateInTaipei(new Date(t * 1000)),
      open: quote.open[i] as number | null,
      high: quote.high[i] as number | null,
      low: quote.low[i] as number | null,
      close: quote.close[i] as number | null,
      volume: quote.volume[i] as number | null,
    }))
    .filter((r) => r.close != null && r.date < today);

  const last = rows.at(-1);
  if (!last) throw new Error("找不到昨日股價");
  const prev = rows.at(-2);
  const change = prev ? last.close! - prev.close! : null;

  return {
    symbol: "2330.TW",
    name: "台積電",
    date: last.date,
    open: last.open,
    high: last.high,
    low: last.low,
    close: last.close,
    volume: last.volume,
    change: change != null ? Number(change.toFixed(2)) : null,
    changePercent:
      change != null && prev
        ? Number(((change / prev.close!) * 100).toFixed(2))
        : null,
  };
}

function decodeXml(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "’")
    .trim();
}

function tag(block: string, name: string) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decodeXml(m[1]) : "";
}

async function getTechNews(): Promise<NewsItem[]> {
  const res = await fetch("https://technews.tw/feed/", { cache: "no-store" });
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  const xml = await res.text();

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => ({
    title: tag(m[1], "title"),
    link: tag(m[1], "link"),
    pubDate: tag(m[1], "pubDate"),
  }));

  const today = dateInTaipei(new Date());
  const todays = items.filter(
    (i) => i.pubDate && dateInTaipei(new Date(i.pubDate)) === today,
  );
  // 今天還沒有新聞時,退回最新幾則
  return (todays.length > 0 ? todays : items).slice(0, 8);
}

async function generateAi(context: {
  weather: Weather | null;
  stock: Stock | null;
  news: NewsItem[] | null;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("缺少 OPENAI_API_KEY");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是一位溫暖的每日晨間助理。請用繁體中文,根據使用者提供的天氣、台積電昨日股價與今日科技新聞資料整理晨報。" +
            "只能使用提供的資料,資料為 null 代表取得失敗,請略過不要編造。" +
            '請只回傳 JSON,格式為 {"summary": string, "encouragement": string}。' +
            "summary 是整合三項資訊的簡短晨報(約 100~200 字);encouragement 是一段真誠、貼近今天情境的鼓勵話語(約 50~100 字)。",
        },
        { role: "user", content: JSON.stringify(context) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content) as {
    summary: string;
    encouragement: string;
  };
}

/** 抓取天氣、股價、新聞,並用 OpenAI 統整。單項失敗不會中斷,失敗原因記在 errors。 */
export async function buildDigest(): Promise<Digest> {
  const [weatherR, stockR, newsR] = await Promise.allSettled([
    getWeather(),
    getTsmcStock(),
    getTechNews(),
  ]);

  const weather = weatherR.status === "fulfilled" ? weatherR.value : null;
  const stock = stockR.status === "fulfilled" ? stockR.value : null;
  const news = newsR.status === "fulfilled" ? newsR.value : null;

  const errors: Record<string, string> = {};
  if (weatherR.status === "rejected") errors.weather = String(weatherR.reason);
  if (stockR.status === "rejected") errors.stock = String(stockR.reason);
  if (newsR.status === "rejected") errors.news = String(newsR.reason);

  let ai: Digest["ai"] = null;
  try {
    ai = await generateAi({ weather, stock, news });
  } catch (e) {
    errors.ai = String(e);
  }

  return {
    date: dateInTaipei(new Date()),
    weather,
    stock,
    news,
    ai,
    ...(Object.keys(errors).length > 0 && { errors }),
  };
}

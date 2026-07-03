const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://dedsis.vercel.app",
];

const corsOptions = {
    origin(origin, callback) {
        console.log("Origin:", origin);

        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("CORS engellendi: " + origin));
        }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json({ limit: "10mb" }));
const API_URL = process.env.API_URL;
const TOKEN = process.env.API_TOKEN;

const PAGE_SIZE = 100;
const CHUNK_DAYS = 1;
const API_DELAY_MS = 300;
const CACHE_TTL_MS = 1000 * 60 * 10;

const requestCache = new Map();

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWithRetry(url, body, options, retries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await axios.post(url, body, options);
        } catch (error) {
            lastError = error;

            const retryable =
                error.code === "ECONNRESET" ||
                error.code === "ETIMEDOUT" ||
                error.code === "ECONNABORTED" ||
                error.response?.status === 429 ||
                error.response?.status >= 500;

            if (!retryable || attempt === retries) {
                throw error;
            }

            console.log(
                `🔁 Retry ${attempt}/${retries} - ${error.code || error.message}`
            );

            await sleep(1000 * attempt);
        }
    }

    throw lastError;
}

function extractArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.Data)) return data.Data;
    if (Array.isArray(data?.result)) return data.result;
    if (Array.isArray(data?.items)) return data.items;
    return [];
}

function splitDateRange(startDateStr, endDateStr, chunkDays = 1) {
    const ranges = [];

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    let currentStart = new Date(start);

    while (currentStart <= end) {
        const currentEnd = new Date(currentStart);
        currentEnd.setDate(currentEnd.getDate() + chunkDays - 1);

        if (currentEnd > end) {
            currentEnd.setTime(end.getTime());
        }

        ranges.push({
            startDate: new Date(currentStart).toISOString().slice(0, 19),
            endDate: new Date(currentEnd).toISOString().slice(0, 19),
        });

        currentStart = new Date(currentEnd);
        currentStart.setDate(currentStart.getDate() + 1);
    }

    return ranges;
}

function getCacheKey({ startDate, endDate, userId, page, pageSize }) {
    return JSON.stringify({ startDate, endDate, userId, page, pageSize });
}

function cleanupOldCache() {
    const now = Date.now();

    for (const [key, value] of requestCache.entries()) {
        if (!value?.createdAt || now - value.createdAt > CACHE_TTL_MS) {
            requestCache.delete(key);
        }
    }
}

app.get("/", (req, res) => {
    res.send("Backend çalışıyor");
});

app.get("/api/test", (req, res) => {
    res.json({
        ok: true,
        message: "CORS çalışıyor",
        apiUrlExists: !!API_URL,
        tokenExists: !!TOKEN,
    });
});

app.post("/api/get-data-day", async (req, res) => {
    try {
        console.log("📤 Günlük req.body:", req.body);
        console.log("API_URL:", API_URL);
        console.log("TOKEN VAR MI:", !!TOKEN);

        if (!API_URL) {
            return res.status(500).json({ error: "API_URL tanımlı değil" });
        }

        if (!TOKEN) {
            return res.status(500).json({ error: "API_TOKEN tanımlı değil" });
        }

        const { startDate, endDate, userId } = req.body || {};

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: "startDate ve endDate zorunlu",
            });
        }

        const response = await postWithRetry(
            API_URL,
            {
                startDate,
                endDate,
                userId,
            },
            {
                headers: {
                    Authorization: `Bearer ${TOKEN}`,
                    "Content-Type": "application/json",
                },
                timeout: 120000,
                maxContentLength: 50 * 1024 * 1024,
                maxBodyLength: 50 * 1024 * 1024,
            },
            3
        );

        const items = extractArray(response.data);

        console.log("✅ Günlük kayıt sayısı:", items.length);

        return res.status(200).json({
            items,
            count: items.length,
        });
    } catch (error) {
        console.error("❌ GET DATA DAY ERROR");
        console.error("message:", error.message);
        console.error("code:", error.code);
        console.error("status:", error.response?.status);
        console.error("data:", error.response?.data);

        return res.status(500).json({
            error: "API error",
            message: error.message,
            code: error.code || null,
            status: error.response?.status || null,
            detail: error.response?.data || null,
        });
    }
});

app.post("/api/get-data", async (req, res) => {
    cleanupOldCache();

    try {
        console.log("📤 req.body:", req.body);
        console.log("API_URL:", API_URL);
        console.log("TOKEN VAR MI:", !!TOKEN);

        if (!API_URL) {
            return res.status(500).json({ error: "API_URL tanımlı değil" });
        }

        if (!TOKEN) {
            return res.status(500).json({ error: "API_TOKEN tanımlı değil" });
        }

        const {
            startDate,
            endDate,
            userId,
            page = 1,
            pageSize = PAGE_SIZE,
        } = req.body || {};

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: "startDate ve endDate zorunlu",
            });
        }

        const safePage = Math.max(Number(page) || 1, 1);
        const safePageSize = Math.min(
            Math.max(Number(pageSize) || PAGE_SIZE, 1),
            1000
        );

        const cacheKey = getCacheKey({
            startDate,
            endDate,
            userId,
            page: safePage,
            pageSize: safePageSize,
        });

        const cached = requestCache.get(cacheKey);

        if (cached) {
            console.log("⚡ Cache kullanıldı:", cacheKey);
            return res.status(200).json(cached.response);
        }

        const chunks = splitDateRange(startDate, endDate, CHUNK_DAYS);
        console.log("🧩 Parça sayısı:", chunks.length);

        const startIndex = (safePage - 1) * safePageSize;
        const endIndex = startIndex + safePageSize;

        let totalCount = 0;
        let pageData = [];
        let reachedRequestedPage = false;

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            const chunkBody = {
                startDate: chunk.startDate,
                endDate: chunk.endDate,
                userId,
            };

            console.log(`⏳ Parça ${i + 1}/${chunks.length} başlıyor`, chunkBody);

            const response = await postWithRetry(
                API_URL,
                chunkBody,
                {
                    headers: {
                        Authorization: `Bearer ${TOKEN}`,
                        "Content-Type": "application/json",
                    },
                    timeout: 120000,
                    maxContentLength: 50 * 1024 * 1024,
                    maxBodyLength: 50 * 1024 * 1024,
                },
                3
            );

            console.log(`✅ Parça ${i + 1}/${chunks.length} cevap verdi`);

            const partData = extractArray(response.data);
            const partLength = partData.length;

            console.log(`📦 Parça ${i + 1} kayıt sayısı:`, partLength);

            const partStartGlobalIndex = totalCount;
            const partEndGlobalIndex = totalCount + partLength;

            if (partEndGlobalIndex > startIndex && partStartGlobalIndex < endIndex) {
                const localStart = Math.max(0, startIndex - partStartGlobalIndex);
                const localEnd = Math.min(partLength, endIndex - partStartGlobalIndex);

                pageData = pageData.concat(partData.slice(localStart, localEnd));
            }

            totalCount += partLength;

            if (pageData.length >= safePageSize) {
                reachedRequestedPage = true;
            }

            if (reachedRequestedPage) {
                const nextPageProbeIndex = endIndex;

                if (totalCount > nextPageProbeIndex) {
                    break;
                }
            }

            await sleep(API_DELAY_MS);
        }

        const hasNextPage = totalCount > endIndex;

        const responseBody = {
            items: pageData,
            pagination: {
                page: safePage,
                pageSize: safePageSize,
                returnedCount: pageData.length,
                hasNextPage,
            },
        };

        requestCache.set(cacheKey, {
            createdAt: Date.now(),
            response: responseBody,
        });

        const responseSizeMb = JSON.stringify(responseBody).length / 1024 / 1024;

        console.log(
            `📄 Sayfa dönülüyor: ${safePage} - ${pageData.length} kayıt - ${responseSizeMb.toFixed(
                2
            )} MB`
        );

        return res.status(200).json(responseBody);
    } catch (error) {
        console.error("❌ PROXY ERROR");
        console.error("message:", error.message);
        console.error("code:", error.code);
        console.error("status:", error.response?.status);
        console.error("data:", error.response?.data);

        return res.status(500).json({
            error: "API error",
            message: error.message,
            code: error.code || null,
            status: error.response?.status || null,
            detail: error.response?.data || null,
        });
    }
});

app.use((err, req, res, next) => {
    console.error("🔥 GLOBAL ERROR:", err.message);
    console.error(err.stack);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({
        error: "Sunucu hatası",
        message: err.message,
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Proxy server çalışıyor: http://localhost:${PORT}`);
});
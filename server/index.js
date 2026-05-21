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
    origin: function (origin, callback) {
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
app.use(express.json({ limit: "10mb" }));

const API_URL = process.env.API_URL;
const TOKEN = process.env.API_TOKEN;

const PAGE_SIZE = 5000;
const CHUNK_DAYS = 1;

// Sadece sayfa cache'i tutuyoruz, tüm ayı değil
const requestCache = new Map();

function extractArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.Data)) return data.Data;
    if (Array.isArray(data?.result)) return data.result;
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

function getCacheKey({ startDate, endDate, userId, page }) {
    return JSON.stringify({ startDate, endDate, userId, page });
}

function cleanupOldCache(maxAgeMs = 1000 * 60 * 10) {
    const now = Date.now();

    for (const [key, value] of requestCache.entries()) {
        if (!value?.createdAt || now - value.createdAt > maxAgeMs) {
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

        const { startDate, endDate, userId, page = 1 } = req.body || {};

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: "startDate ve endDate zorunlu",
            });
        }

        const safePage = Math.max(Number(page) || 1, 1);
        const cacheKey = getCacheKey({ startDate, endDate, userId, page: safePage });

        const cached = requestCache.get(cacheKey);

        if (cached) {
            console.log("⚡ Cache kullanıldı:", cacheKey);
            return res.status(200).json(cached.response);
        }

        const chunks = splitDateRange(startDate, endDate, CHUNK_DAYS);
        console.log("🧩 Parça sayısı:", chunks.length);

        const startIndex = (safePage - 1) * PAGE_SIZE;
        const endIndex = startIndex + PAGE_SIZE;

        let totalCount = 0;
        let pageData = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            const chunkBody = {
                startDate: chunk.startDate,
                endDate: chunk.endDate,
                userId,
            };

            console.log(`⏳ Parça ${i + 1}/${chunks.length} başlıyor`, chunkBody);

            const response = await axios.post(API_URL, chunkBody, {
                headers: {
                    Authorization: `Bearer ${TOKEN}`,
                    "Content-Type": "application/json",
                },
                timeout: 120000,
                maxContentLength: 50 * 1024 * 1024,
                maxBodyLength: 50 * 1024 * 1024,
            });

            console.log(`✅ Parça ${i + 1}/${chunks.length} cevap verdi`);

            const partData = extractArray(response.data);
            const partLength = partData.length;

            console.log(`📦 Parça ${i + 1} kayıt sayısı:`, partLength);

            const partStartGlobalIndex = totalCount;
            const partEndGlobalIndex = totalCount + partLength;

            if (partEndGlobalIndex > startIndex && partStartGlobalIndex < endIndex) {
                const localStart = Math.max(0, startIndex - partStartGlobalIndex);
                const localEnd = Math.min(partLength, endIndex - partStartGlobalIndex);

                pageData.push(...partData.slice(localStart, localEnd));
            }

            totalCount += partLength;
        }

        const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

        const responseBody = {
            items: pageData,
            pagination: {
                page: safePage,
                pageSize: PAGE_SIZE,
                totalCount,
                totalPages,
                hasNextPage: safePage < totalPages,
            },
        };

        requestCache.set(cacheKey, {
            createdAt: Date.now(),
            response: responseBody,
        });

        console.log(
            `📄 Sayfa dönülüyor: ${safePage}/${totalPages} - ${pageData.length} kayıt`
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
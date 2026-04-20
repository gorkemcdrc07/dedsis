const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001", // 👈 EKLE
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

// basit geçici bellek cache
const requestCache = new Map();

function extractArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.Data)) return data.Data;
    if (Array.isArray(data?.result)) return data.result;
    return [];
}

function splitDateRange(startDateStr, endDateStr, chunkDays = 5) {
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

        const startIso = new Date(currentStart).toISOString().slice(0, 19);
        const endIso = new Date(currentEnd).toISOString().slice(0, 19);

        ranges.push({
            startDate: startIso,
            endDate: endIso,
        });

        currentStart = new Date(currentEnd);
        currentStart.setDate(currentStart.getDate() + 1);
    }

    return ranges;
}

function getCacheKey({ startDate, endDate, userId }) {
    return JSON.stringify({ startDate, endDate, userId });
}

function cleanupOldCache(maxAgeMs = 1000 * 60 * 30) {
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
            return res.status(500).json({
                error: "API_URL tanımlı değil",
            });
        }

        if (!TOKEN) {
            return res.status(500).json({
                error: "API_TOKEN tanımlı değil",
            });
        }

        const { startDate, endDate, userId, page = 1 } = req.body || {};

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: "startDate ve endDate zorunlu",
            });
        }

        const cacheKey = getCacheKey({ startDate, endDate, userId });

        let cached = requestCache.get(cacheKey);

        if (!cached) {
            const chunks = splitDateRange(startDate, endDate, 5);
            console.log("🧩 Parça sayısı:", chunks.length, chunks);

            let allData = [];

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];

                const chunkBody = {
                    startDate: chunk.startDate,
                    endDate: chunk.endDate,
                    userId,
                };

                try {
                    console.log(`⏳ Parça ${i + 1}/${chunks.length} başlıyor`, chunkBody);

                    const response = await axios.post(API_URL, chunkBody, {
                        headers: {
                            Authorization: `Bearer ${TOKEN}`,
                            "Content-Type": "application/json",
                        },
                        timeout: 0,
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity,
                    });

                    console.log(`✅ Parça ${i + 1}/${chunks.length} cevap verdi`);

                    const partData = extractArray(response.data);

                    console.log(`📦 Parça ${i + 1} kayıt sayısı:`, partData.length);

                    allData = allData.concat(partData);
                } catch (chunkError) {
                    console.error(`❌ Parça ${i + 1}/${chunks.length} patladı`);
                    console.error("chunk body:", chunkBody);
                    console.error("message:", chunkError.message);
                    console.error("code:", chunkError.code);
                    console.error("status:", chunkError.response?.status);
                    console.error("data:", chunkError.response?.data);

                    throw chunkError;
                }
            }

            console.log("📊 TOPLAM ARRAY LENGTH:", allData.length);

            cached = {
                createdAt: Date.now(),
                data: allData,
            };

            requestCache.set(cacheKey, cached);
        } else {
            console.log("⚡ Cache kullanıldı:", cacheKey);
        }

        const totalCount = cached.data.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
        const safePage = Math.min(Math.max(Number(page) || 1, 1), totalPages);

        const startIndex = (safePage - 1) * PAGE_SIZE;
        const endIndex = startIndex + PAGE_SIZE;
        const pageData = cached.data.slice(startIndex, endIndex);

        console.log(
            `📄 Sayfa dönülüyor: ${safePage}/${totalPages} - kayıt ${startIndex}..${endIndex - 1}`
        );

        return res.status(200).json({
            items: pageData,
            pagination: {
                page: safePage,
                pageSize: PAGE_SIZE,
                totalCount,
                totalPages,
                hasNextPage: safePage < totalPages,
            },
        });
    } catch (error) {
        console.error("❌ PROXY ERROR");
        console.error("message:", error.message);
        console.error("code:", error.code);
        console.error("status:", error.response?.status);
        console.error("data:", error.response?.data);
        console.error("API_URL:", API_URL);
        console.error("TOKEN VAR MI:", !!TOKEN);

        res.status(500).json({
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
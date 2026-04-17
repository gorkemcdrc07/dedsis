const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

const allowedOrigins = [
    "http://localhost:3000",
    "https://dedsis.vercel.app",
];

const corsOptions = {
    origin: function (origin, callback) {
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
app.use(cors(corsOptions));
app.use(express.json());

const API_URL = process.env.API_URL;
const TOKEN = process.env.API_TOKEN;

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

        const response = await axios.post(API_URL, req.body, {
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
            },
            timeout: 0, // sınırsız bekle
        });

        console.log("📥 RAW RESPONSE:", response.data);

        let data = response.data;

        if (Array.isArray(data)) {
            console.log("✅ Direkt array geldi");
        } else if (Array.isArray(data?.data)) {
            console.log("✅ data.data kullanıldı");
            data = data.data;
        } else if (Array.isArray(data?.Data)) {
            console.log("✅ data.Data kullanıldı");
            data = data.Data;
        } else if (Array.isArray(data?.result)) {
            console.log("✅ data.result kullanıldı");
            data = data.result;
        } else {
            console.log("⚠️ ARRAY BULUNAMADI:", data);
            data = [];
        }

        console.log("📊 FINAL ARRAY LENGTH:", data.length);

        res.status(200).json(data);
    } catch (error) {
        console.error("❌ PROXY ERROR");
        console.error("message:", error.message);
        console.error("status:", error.response?.status);
        console.error("data:", error.response?.data);
        console.error("API_URL:", API_URL);
        console.error("TOKEN VAR MI:", !!TOKEN);

        res.status(500).json({
            error: "API error",
            message: error.message,
            status: error.response?.status || null,
            detail: error.response?.data || null,
        });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Proxy server çalışıyor: http://localhost:${PORT}`);
});
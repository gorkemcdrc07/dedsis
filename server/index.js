const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

const corsOptions = {
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());

const API_URL = process.env.API_URL;
const TOKEN = process.env.API_TOKEN;

app.get("/", (req, res) => {
    res.send("Backend çalışıyor");
});

app.get("/api/test", (req, res) => {
    res.json({ ok: true, message: "CORS çalışıyor" });
});

app.post("/api/get-data", async (req, res) => {
    try {
        console.log("📤 GİDEN REQUEST:", req.body);
        console.log("API_URL:", API_URL ? "var" : "yok");
        console.log("TOKEN:", TOKEN ? "var" : "yok");

        const response = await axios.post(API_URL, req.body, {
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
            },
            timeout: 30000,
        });

        console.log("📥 RAW RESPONSE:", response.data);

        let data = response.data;

        if (Array.isArray(data)) {
            console.log("✅ Direkt array geldi");
        } else if (Array.isArray(data?.data)) {
            data = data.data;
        } else if (Array.isArray(data?.Data)) {
            data = data.Data;
        } else if (Array.isArray(data?.result)) {
            data = data.result;
        } else {
            console.log("⚠️ ARRAY BULUNAMADI:", data);
            data = [];
        }

        res.status(200).json(data);
    } catch (error) {
        console.error("❌ PROXY ERROR:", error.response?.data || error.message);

        res.status(500).json({
            error: "API error",
            detail: error.response?.data || error.message,
        });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Proxy server çalışıyor: http://localhost:${PORT}`);
});
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

const API_URL = process.env.API_URL;
const TOKEN = process.env.API_TOKEN;

app.get("/", (req, res) => {
    res.send("Backend çalışıyor");
});

app.post("/api/get-data", async (req, res) => {
    try {
        console.log("📤 GİDEN REQUEST:", req.body);

        const response = await axios.post(API_URL, req.body, {
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
            },
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

        res.json(data);
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
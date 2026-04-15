const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

const API_URL =
    "https://api.odaklojistik.com.tr/api/tmsdespatchincomeexpenses/getall";

const TOKEN =
    "49223653afa4b7e22c3659762c835dcdef9725a401e928fd46f697be8ea2597273bf4479cf9d0f7e5b8b03907c2a0b4d58625692c3e30629ac01fc477774de75";

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

        // 🔥 EN ÖNEMLİ KISIM
        let data = response.data;

        // API farklı format dönebilir → normalize et
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

app.listen(5000, () => {
    console.log("🚀 Proxy server çalışıyor: http://localhost:5000");
});
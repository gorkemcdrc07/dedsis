import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import AnaYerlesim from "./yerlesim/AnaYerlesim";
import LoginSayfasi from "./Login";
import AnaPanelSayfasi from "./sayfalar/AnaPanel";
import MuhasebeKarlilikSayfasi from "./sayfalar/MuhasebeKarlilik";
import InsanKaynaklariSayfasi from "./sayfalar/InsanKaynaklari";
import ProjeOperasyonSayfasi from "./sayfalar/ProjeOperasyon";
import KullaniciYetkileriSayfasi from "./sayfalar/KullaniciYetkileri";

export default function App() {
    const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

    useEffect(() => {
        document.body.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "light" ? "dark" : "light"));
    };

    return (
        <Routes>
            <Route path="/login" element={<LoginSayfasi theme={theme} toggleTheme={toggleTheme} />} />

            <Route
                path="/"
                element={<AnaYerlesim theme={theme} toggleTheme={toggleTheme} />}
            >
                <Route index element={<Navigate to="/ana-panel" replace />} />
                <Route path="ana-panel" element={<AnaPanelSayfasi />} />
                <Route path="muhasebe-karlilik" element={<MuhasebeKarlilikSayfasi />} />
                <Route path="insan-kaynaklari" element={<InsanKaynaklariSayfasi />} />
                <Route path="proje-operasyon" element={<ProjeOperasyonSayfasi />} />
                <Route path="kullanici-yetkileri" element={<KullaniciYetkileriSayfasi />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import AnaYerlesim from "./yerlesim/AnaYerlesim";
import LoginSayfasi from "./Login";
import AnaPanelSayfasi from "./sayfalar/AnaPanel";
import YonetimPaneliSayfasi from "./sayfalar/YonetimPaneli";
import MuhasebeKarlilikSayfasi from "./sayfalar/MuhasebeKarlilik";
import InsanKaynaklariSayfasi from "./sayfalar/InsanKaynaklari";
import ProjeOperasyonSayfasi from "./sayfalar/ProjeOperasyon";
import KullaniciYetkileriSayfasi from "./sayfalar/KullaniciYetkileri";
import Evidea from "./sayfalar/MusteriEkranlari/Evidea";
import Basbug from "./sayfalar/MusteriEkranlari/Basbug";

export default function App() {
    const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem("token"));

    const kullanici = JSON.parse(localStorage.getItem("user") || "{}");

    const kullaniciText = `${kullanici.kullanici_adi || ""} ${kullanici.kullanici || ""}`
        .toLowerCase()
        .trim();

    const evideaKullanicisi = kullaniciText.includes("evidea");

    const basbugKullanicisi =
        kullaniciText.includes("basbug") ||
        kullaniciText.includes("baþbug") ||
        kullaniciText.includes("baþbuð");

    const musteriKullanicisi = evideaKullanicisi || basbugKullanicisi;

    const baslangicSayfasi = evideaKullanicisi
        ? "/evidea"
        : basbugKullanicisi
            ? "/basbug"
            : "/ana-panel";

    useEffect(() => {
        document.body.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "light" ? "dark" : "light"));
    };

    const sadeceAdmin = (element) => {
        return musteriKullanicisi ? (
            <Navigate to={baslangicSayfasi} replace />
        ) : (
            element
        );
    };

    return (
        <Routes>
            <Route
                path="/login"
                element={
                    isAuthenticated ? (
                        <Navigate to={baslangicSayfasi} replace />
                    ) : (
                        <LoginSayfasi
                            theme={theme}
                            toggleTheme={toggleTheme}
                            setIsAuthenticated={setIsAuthenticated}
                        />
                    )
                }
            />

            <Route
                path="/"
                element={
                    isAuthenticated ? (
                        <AnaYerlesim
                            theme={theme}
                            toggleTheme={toggleTheme}
                            setIsAuthenticated={setIsAuthenticated}
                        />
                    ) : (
                        <Navigate to="/login" replace />
                    )
                }
            >
                <Route index element={<Navigate to={baslangicSayfasi} replace />} />

                <Route path="ana-panel" element={sadeceAdmin(<AnaPanelSayfasi />)} />
                <Route path="yonetim-paneli" element={sadeceAdmin(<YonetimPaneliSayfasi />)} />
                <Route path="muhasebe-karlilik" element={sadeceAdmin(<MuhasebeKarlilikSayfasi />)} />
                <Route path="insan-kaynaklari" element={sadeceAdmin(<InsanKaynaklariSayfasi />)} />
                <Route path="proje-operasyon" element={sadeceAdmin(<ProjeOperasyonSayfasi />)} />
                <Route path="kullanici-yetkileri" element={sadeceAdmin(<KullaniciYetkileriSayfasi />)} />

                <Route
                    path="evidea"
                    element={
                        basbugKullanicisi ? (
                            <Navigate to="/basbug" replace />
                        ) : (
                            <Evidea />
                        )
                    }
                />

                <Route
                    path="basbug"
                    element={
                        evideaKullanicisi ? (
                            <Navigate to="/evidea" replace />
                        ) : (
                            <Basbug />
                        )
                    }
                />
            </Route>

            <Route
                path="*"
                element={
                    isAuthenticated ? (
                        <Navigate to={baslangicSayfasi} replace />
                    ) : (
                        <Navigate to="/login" replace />
                    )
                }
            />
        </Routes>
    );
}
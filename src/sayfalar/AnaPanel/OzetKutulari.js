import { useMemo } from "react";
import { paraBicimlendir } from "./araclar";
import "./OzetKutulari.css";

function OzetKart({ label, value, className = "", accent = "" }) {
    return (
        <div className={`ozet-kart ${accent}`}>
            <div className="ozet-kart__ust">
                <div className="ozet-kart__etiket">{label}</div>
            </div>

            <div className={`ozet-kart__deger ${className}`}>
                {value}
            </div>
        </div>
    );
}

export default function OzetKutulari({ rows = [], projects = [] }) {
    const guvenliRows = Array.isArray(rows) ? rows : [];
    const guvenliProjects = Array.isArray(projects) ? projects : [];

    const veriler = useMemo(() => {
        const toplamAlis = guvenliRows.reduce(
            (toplam, satir) => toplam + (satir.PurchaseInvoiceIncome || 0),
            0
        );

        const toplamSatis = guvenliRows.reduce(
            (toplam, satir) => toplam + (satir.SalesInvoceIncome || 0),
            0
        );

        const toplamKar = toplamSatis - toplamAlis;

        const plakaSayisi = new Set(
            guvenliRows.map((satir) => satir.PlateNumber || "-")
        ).size;

        return {
            toplamAlis,
            toplamSatis,
            toplamKar,
            projeSayisi: guvenliProjects.length,
            plakaSayisi,
        };
    }, [guvenliRows, guvenliProjects]);

    const kutular = [
        {
            label: "Toplam Alış",
            value: paraBicimlendir(veriler.toplamAlis, true),
            accent: "accent-blue",
        },
        {
            label: "Toplam Satış",
            value: paraBicimlendir(veriler.toplamSatis, true),
            accent: "accent-indigo",
        },
        {
            label: "Net Kar / Zarar",
            value: paraBicimlendir(veriler.toplamKar, true),
            className: veriler.toplamKar >= 0 ? "pozitif" : "negatif",
            accent: veriler.toplamKar >= 0 ? "accent-green" : "accent-red",
        },
        {
            label: "Toplam Proje",
            value: veriler.projeSayisi,
            accent: "accent-amber",
        },
        {
            label: "Toplam Plaka",
            value: veriler.plakaSayisi,
            accent: "accent-slate",
        },
    ];

    return (
        <section className="ozet-kutulari-alani">
            <div className="ozet-kutulari-baslik">
                <div>
                    <div className="ozet-kutulari-kicker">Genel Bakış</div>
                    <h2 className="ozet-kutulari-title">Özet Kutuları</h2>
                </div>
            </div>

            <div className="ana-ust-kutular">
                {kutular.map((kutu) => (
                    <OzetKart
                        key={kutu.label}
                        label={kutu.label}
                        value={kutu.value}
                        className={kutu.className || ""}
                        accent={kutu.accent || ""}
                    />
                ))}
            </div>
        </section>
    );
}
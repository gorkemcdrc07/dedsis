import React, { useEffect, useMemo, useRef, useState } from "react";
import "./YapayZekaAnalizi.css";
import { fmt, norm, aggregatePlateSummary, aggregateServiceSummary } from "./helpers";

export const ALLOWED_PROJECTS = [
    "KEMERBURGAZ MNG DEDİKE",
    "MNG BAKIRKÖY DEDİKE",
    "MNG TRAKYA DEDİKE",
    "MNG TRAKYA FTL",
    "MNG BURSA DEDİKE",
    "MNG İZMİR DEDİKE",
    "MNG ADANA FTL",
    "EVİDEA DEDİKE",
    "BİOTA DEDİKE FTL",
    "ES GLOBAL DEDİKE",
    "BAŞBUĞ FTL",
    "BAŞBUĞ ŞEKERPINAR DEDİKE",
    "BAŞBUĞ BURSA DEDİKE",
    "KALE KİLİT DEDİKE FTL",
    "MNG ASYA",
    "MNG GEBZE DEDİKE RİNG",
    "MNG MARMARA DEDİKE",
];

function answerFromData(question, projects, rows) {
    const q = norm(question);

    const totalPurchase = rows.reduce((a, r) => a + (r.PurchaseInvoiceIncome || 0), 0);
    const totalSales = rows.reduce((a, r) => a + (r.SalesInvoceIncome || 0), 0);
    const totalProfit = totalSales - totalPurchase;

    const sortedProjects = [...projects].sort((a, b) => (b.profit || 0) - (a.profit || 0));
    const profitableProjects = projects.filter((p) => (p.profit || 0) > 0);
    const lossProjects = [...projects]
        .filter((p) => (p.profit || 0) < 0)
        .sort((a, b) => (a.profit || 0) - (b.profit || 0));

    const bestProject = sortedProjects[0];
    const worstProject = [...projects].sort((a, b) => (a.profit || 0) - (b.profit || 0))[0];

    const plates = aggregatePlateSummary(rows).sort((a, b) => (b.profit || 0) - (a.profit || 0));
    const services = aggregateServiceSummary(rows).sort((a, b) => (b.profit || 0) - (a.profit || 0));

    const bestPlate = plates[0];
    const worstPlate = [...plates].sort((a, b) => (a.profit || 0) - (b.profit || 0))[0];
    const bestService = services[0];
    const worstService = [...services].sort((a, b) => (a.profit || 0) - (b.profit || 0))[0];

    const projectMention = projects.find((p) => q.includes(norm(p.projectName)));
    const plateMention = plates.find((p) => q.includes(norm(p.plate)));

    if (rows.length === 0) {
        return "Henüz analiz edilecek veri yok. Önce tarih aralığı seçip veri yüklemelisin.";
    }

    if (projectMention) {
        return `${projectMention.projectName} projesinde alış ${fmt(projectMention.purchaseTotal, true)}, satış ${fmt(projectMention.salesTotal, true)}, net sonuç ${fmt(projectMention.profit, true)}. Bu projede ${projectMention.plateCount} farklı plaka var.`;
    }

    if (plateMention) {
        return `${plateMention.plate} plakasında alış ${fmt(plateMention.p, true)}, satış ${fmt(plateMention.s, true)}, net sonuç ${fmt(plateMention.profit, true)}. ${plateMention.projects?.size || 0} projede ve ${plateMention.services?.size || 0} hizmet türünde işlem görünüyor.`;
    }

    if (
        q.includes("genel özet") ||
        q.includes("özet") ||
        q.includes("genel durum") ||
        q.includes("toplam")
    ) {
        return `Genel özet:
• Toplam alış: ${fmt(totalPurchase, true)}
• Toplam satış: ${fmt(totalSales, true)}
• Net kâr: ${fmt(totalProfit, true)}
• Toplam proje: ${projects.length}
• Karlı proje: ${profitableProjects.length}
• Zararlı proje: ${lossProjects.length}
• Toplam plaka: ${plates.length}`;
    }

    if (q.includes("en karlı proje") || q.includes("hangi proje en karlı") || q.includes("en iyi proje")) {
        return bestProject
            ? `En karlı proje ${bestProject.projectName}. Alış ${fmt(bestProject.purchaseTotal, true)}, satış ${fmt(bestProject.salesTotal, true)}, net kâr ${fmt(bestProject.profit, true)}.`
            : "Proje verisi bulunamadı.";
    }

    if (q.includes("zararlı proje") || q.includes("en kötü proje") || q.includes("en düşük proje")) {
        return worstProject
            ? `En düşük performanslı proje ${worstProject.projectName}. Alış ${fmt(worstProject.purchaseTotal, true)}, satış ${fmt(worstProject.salesTotal, true)}, net sonuç ${fmt(worstProject.profit, true)}.`
            : "Zararlı proje bulunamadı.";
    }

    if (q.includes("en iyi plaka") || q.includes("en karlı plaka")) {
        return bestPlate
            ? `En güçlü plaka ${bestPlate.plate}. Alış ${fmt(bestPlate.p, true)}, satış ${fmt(bestPlate.s, true)}, net kâr ${fmt(bestPlate.profit, true)}.`
            : "Plaka verisi bulunamadı.";
    }

    if (q.includes("en kötü plaka") || q.includes("zararlı plaka")) {
        return worstPlate
            ? `En zayıf plaka ${worstPlate.plate}. Alış ${fmt(worstPlate.p, true)}, satış ${fmt(worstPlate.s, true)}, net sonuç ${fmt(worstPlate.profit, true)}.`
            : "Zararlı plaka bulunamadı.";
    }

    if (q.includes("hizmet") || q.includes("masraf")) {
        const top3 = services.slice(0, 3);
        return `Hizmet bazında öne çıkan alanlar:
${top3
                .map(
                    (s, i) =>
                        `${i + 1}. ${s.name} → alış ${fmt(s.p, true)}, satış ${fmt(s.s, true)}, net ${fmt(s.profit, true)}`
                )
                .join("\n")}
${bestService ? `En güçlü hizmet: ${bestService.name} (${fmt(bestService.profit, true)}).` : ""}
${worstService ? ` En zayıf hizmet: ${worstService.name} (${fmt(worstService.profit, true)}).` : ""}`;
    }

    if (q.includes("öneri") || q.includes("aksiyon") || q.includes("ne yapalım") || q.includes("ne önerirsin")) {
        const rec = [];

        if (lossProjects.length > 0) {
            rec.push(`• İlk odak noktası zarar eden proje: ${lossProjects[0].projectName}.`);
        }
        if (worstPlate && (worstPlate.profit || 0) < 0) {
            rec.push(`• Zarar eden plaka ${worstPlate.plate} için hizmet ve maliyet kırılımı detaylı incelenmeli.`);
        }
        if (worstService && (worstService.profit || 0) < 0) {
            rec.push(`• Zarar üreten hizmet kalemi ${worstService.name}; fiyatlama ve tedarikçi tarafı gözden geçirilmeli.`);
        }
        if (bestProject) {
            rec.push(`• En karlı proje ${bestProject.projectName}; operasyon modeli diğer projelere örnek alınabilir.`);
        }

        return rec.length > 0
            ? `Önerilen aksiyonlar:\n${rec.join("\n")}`
            : "Şu an belirgin bir sorun görünmüyor. Daha detaylı analiz için proje veya plaka bazında soru sorabilirsin.";
    }

    if (q.includes("hangi projeler iyi") || q.includes("iyi projeler")) {
        const top3 = sortedProjects.slice(0, 3);
        if (top3.length === 0) return "Proje verisi bulunamadı.";
        return `En iyi projeler:
${top3.map((p, i) => `${i + 1}. ${p.projectName} → ${fmt(p.profit, true)}`).join("\n")}`;
    }

    return `Şu anki filtrelenmiş veriye göre kısa özet:
• Toplam alış: ${fmt(totalPurchase, true)}
• Toplam satış: ${fmt(totalSales, true)}
• Net kâr: ${fmt(totalProfit, true)}
• En karlı proje: ${bestProject?.projectName || "-"}
• En iyi plaka: ${bestPlate?.plate || "-"}
• En güçlü hizmet: ${bestService?.name || "-"}

Daha net bir soru sorarsan proje, plaka, hizmet veya aksiyon bazında detay verebilirim.`;
}

function QuickStat({ label, value, tone = "default", compact = false }) {
    return (
        <div className={`ai-stat ai-stat--${tone} ${compact ? "compact" : ""}`}>
            <div className="ai-stat__label">{label}</div>
            <div className="ai-stat__value">{value}</div>
        </div>
    );
}

export default function YapayZekaAnalizi({ projects = [], rows = [] }) {
    const [messages, setMessages] = useState([
        {
            role: "ai",
            text:
                "Merhaba. Yalnızca izin verilen projeler üzerinden analiz yapıyorum. Karlı ve zararlı projeler, plaka performansı, hizmet bazlı etkiler ve aksiyon önerileri sorabilirsin.",
        },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const endRef = useRef(null);

    const allowedProjectSet = useMemo(() => new Set(ALLOWED_PROJECTS), []);

    const filteredProjects = useMemo(() => {
        return (Array.isArray(projects) ? projects : []).filter((p) =>
            allowedProjectSet.has(p.projectName)
        );
    }, [projects, allowedProjectSet]);

    const filteredRows = useMemo(() => {
        return (Array.isArray(rows) ? rows : []).filter((r) =>
            allowedProjectSet.has(r.ProjectName)
        );
    }, [rows, allowedProjectSet]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    const summary = useMemo(() => {
        const totalP = filteredRows.reduce((a, r) => a + (r.PurchaseInvoiceIncome || 0), 0);
        const totalS = filteredRows.reduce((a, r) => a + (r.SalesInvoceIncome || 0), 0);
        const totalProfit = totalS - totalP;

        const bestProject = [...filteredProjects].sort((a, b) => (b.profit || 0) - (a.profit || 0))[0];
        const worstProject = [...filteredProjects].sort((a, b) => (a.profit || 0) - (b.profit || 0))[0];
        const bestPlate = aggregatePlateSummary(filteredRows).sort((a, b) => (b.profit || 0) - (a.profit || 0))[0];
        const bestService = aggregateServiceSummary(filteredRows).sort((a, b) => (b.profit || 0) - (a.profit || 0))[0];

        return {
            totalP,
            totalS,
            totalProfit,
            bestProject,
            worstProject,
            bestPlate,
            bestService,
        };
    }, [filteredProjects, filteredRows]);

    const quickQuestions = [
        "Genel özet ver",
        "En karlı proje hangisi?",
        "Zarar eden projeleri sırala",
        "En iyi plaka hangisi?",
        "En kötü plaka hangisi?",
        "Hizmet bazlı analiz yap",
        "Hangi projeler iyi gidiyor?",
        "Aksiyon önerisi ver",
        `En karlı proje ile en zararlı projeyi karşılaştır`,
        `${ALLOWED_PROJECTS[0]} projesini özetle`,
        `${ALLOWED_PROJECTS[1]} projesinde durum nasıl?`,
        "Maliyet baskısı oluşturan hizmetleri söyle",
    ];

    const ask = (text) => {
        setInput(text);
    };

    const send = () => {
        if (!input.trim()) return;

        const question = input.trim();

        setMessages((prev) => [...prev, { role: "user", text: question }]);
        setInput("");
        setLoading(true);

        setTimeout(() => {
            const answer = answerFromData(question, filteredProjects, filteredRows);
            setMessages((prev) => [...prev, { role: "ai", text: answer }]);
            setLoading(false);
        }, 500);
    };

    return (
        <div className="ai-page">
            <div className="ai-shell">
                <div className="ai-hero">
                    <div className="ai-hero__content">
                        <div className="ai-hero__kicker">AI Copilot</div>
                        <h2 className="ai-hero__title">Veriyi sor, net cevabı anında al</h2>
                        <p className="ai-hero__desc">
                            Bu alan yalnızca tanımlı proje listesi üzerinden çalışır. Proje, plaka,
                            hizmet, kârlılık ve aksiyon önerileri için hızlı soru-cevap yapabilirsin.
                        </p>
                    </div>

                    <div className="ai-hero__badge">
                        <span className="ai-hero__badge-label">Filtreli Proje</span>
                        <span className="ai-hero__badge-value">{ALLOWED_PROJECTS.length}</span>
                    </div>
                </div>

                <div className="ai-wrap">
                    <div className="ai-main">
                        <div className="ai-head">
                            <div>
                                <div className="ai-title">Yapay Zeka Analizi</div>
                                <div className="ai-sub">Filtrelenmiş proje verisi üzerinden soru-cevap</div>
                            </div>
                        </div>

                        <div className="ai-chips">
                            {quickQuestions.map((chip) => (
                                <button key={chip} className="ai-chip" onClick={() => ask(chip)}>
                                    {chip}
                                </button>
                            ))}
                        </div>

                        <div className="ai-msgs">
                            {messages.map((m, i) => (
                                <div key={i} className={`ai-msg ${m.role === "user" ? "user" : ""}`}>
                                    <div className={`ai-av ${m.role === "user" ? "user" : "ai"}`}>
                                        {m.role === "user" ? "S" : "AI"}
                                    </div>

                                    <div className={`ai-bub ${m.role === "user" ? "user" : "ai"}`}>
                                        {m.text}
                                    </div>
                                </div>
                            ))}

                            {loading && (
                                <div className="ai-msg">
                                    <div className="ai-av ai">AI</div>
                                    <div className="ai-bub ai">
                                        <div className="typing">
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={endRef} />
                        </div>

                        <div className="ai-bar">
                            <textarea
                                className="ai-inp"
                                rows={2}
                                value={input}
                                placeholder="Örn: En karlı proje hangisi?"
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        send();
                                    }
                                }}
                            />
                            <button
                                className="ai-send"
                                onClick={send}
                                disabled={loading || !input.trim()}
                            >
                                Gönder
                            </button>
                        </div>
                    </div>

                    <div className="ai-side">
                        <div className="ai-side-card">
                            <div className="ai-side-head">
                                <div>
                                    <div className="ai-side-title">Hızlı Durum</div>
                                    <div className="ai-side-sub">Anlık filtrelenmiş özet</div>
                                </div>
                            </div>

                            <div className="ai-side-grid">
                                <QuickStat label="Toplam Alış" value={fmt(summary.totalP, true)} tone="slate" />
                                <QuickStat label="Toplam Satış" value={fmt(summary.totalS, true)} tone="blue" />
                                <QuickStat
                                    label="Net Kâr"
                                    value={fmt(summary.totalProfit, true)}
                                    tone={summary.totalProfit >= 0 ? "green" : "red"}
                                />
                                <QuickStat
                                    label="En Karlı Proje"
                                    value={summary.bestProject?.projectName || "-"}
                                    tone="violet"
                                    compact
                                />
                                <QuickStat
                                    label="En Zayıf Proje"
                                    value={summary.worstProject?.projectName || "-"}
                                    tone="rose"
                                    compact
                                />
                                <QuickStat
                                    label="En İyi Plaka"
                                    value={summary.bestPlate?.plate || "-"}
                                    tone="amber"
                                    compact
                                />
                                <QuickStat
                                    label="En Güçlü Hizmet"
                                    value={summary.bestService?.name || "-"}
                                    tone="cyan"
                                    compact
                                />
                            </div>
                        </div>

                        <div className="ai-side-card">
                            <div className="ai-side-head">
                                <div>
                                    <div className="ai-side-title">Kapsam</div>
                                    <div className="ai-side-sub">Sadece izin verilen projeler</div>
                                </div>
                            </div>

                            <div className="ai-project-list">
                                {ALLOWED_PROJECTS.map((project) => (
                                    <div key={project} className="ai-project-pill" title={project}>
                                        {project}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
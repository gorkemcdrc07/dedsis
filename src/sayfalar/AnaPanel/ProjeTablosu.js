import React, { useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import "./ProjeTablosu.css";
import { fmt, norm } from "./helpers";
import PlateDetailModal from "./PlakaDetayPenceresi";

const EXCLUDED_SERVICE_NAMES = ["HAKEDİŞ FARKI BEDELİ"];

// ProjeTablosu.jsx içindeki ServiceBreakdown fonksiyonunu tamamen bu ile değiştirin
const IK_KEYWORDS = ["ik", "personel", "maaş", "sgk", "işçi", "çalışan", "prim"];
const MUH_KEYWORDS = ["muhasebe", "vergi", "kdv", "stopaj", "mali", "denetim", "fatura"];

function ServiceBreakdown({
    details,
    onPlateClick,
    projeDagilimRows = [],
    selectedMonth,
}) {
    const [svcF, setSvcF] = useState("");
    const [plateSearch, setPlateSearch] = useState("");
    const [openCats, setOpenCats] = useState({});

    const toggleCat = (key) =>
        setOpenCats((prev) => ({ ...prev, [key]: !prev[key] }));

    const filteredDetails = useMemo(() => {
        return (details || []).filter((d) => {
            const serviceName = norm(d.ServiceExpenseName || d.ServiceExpense || "");
            return !EXCLUDED_SERVICE_NAMES.some((name) => serviceName === norm(name));
        });
    }, [details]);

    const monthlyDagilim = useMemo(() => {
        const filtered = (projeDagilimRows || []).filter(
            (row) =>
                !selectedMonth ||
                Number(row.donem_ay || 0) === Number(selectedMonth)
        );

        const grouped = new Map();
        filtered.forEach((row) => {
            const hesapAdi = row.hesap_adi || "-";
            const altKalem = row.alt_kalem || "-";
            const kullaniciAdi = row.kullanici_adi || "-";
            const kategori = String(row.kategori || "").toLowerCase().trim();

            const key = `${hesapAdi}__${altKalem}__${kullaniciAdi}__${kategori}`.toLocaleLowerCase("tr-TR");

            if (!grouped.has(key)) {
                grouped.set(key, {
                    id: row.kayit_id || key,
                    kullanici_adi: kullaniciAdi,
                    hesap_adi: hesapAdi,
                    alt_kalem: altKalem,
                    tutar: 0,
                    donem_ay: row.donem_ay || "",
                    dagilim_orani: Number(row.dagilim_orani || 0),
                    kategori,
                });
            }

            const current = grouped.get(key);
            current.tutar += Number(row.tutar || 0);
            current.dagilim_orani = Number(row.dagilim_orani || 0);
        });
        return [...grouped.values()].sort((a, b) => b.tutar - a.tutar);
    }, [projeDagilimRows, selectedMonth]);

    // Kategori sınıflandırma

    const categorize = React.useCallback((item) => {
        const text = `${item.hesap_adi} ${item.alt_kalem}`.toLowerCase();
        const kat = String(item.kategori || "").toLowerCase().trim();

        if (kat === "ik") return "ik";
        if (kat === "muhasebe") return "muhasebe";

        if (IK_KEYWORDS.some((k) => text.includes(k))) return "ik";
        if (MUH_KEYWORDS.some((k) => text.includes(k))) return "muhasebe";

        return "diger";
    }, []);
    const categorized = useMemo(() => {
        const groups = { ik: [], muhasebe: [], diger: [] };
        monthlyDagilim.forEach((item) => {
            groups[categorize(item)].push(item);
        });
        return groups;
    }, [monthlyDagilim, categorize]);

    const CAT_CONFIG = [
        { key: "ik", label: "İK", color: "#7F77DD" },
        { key: "muhasebe", label: "Muhasebe", color: "#1D9E75" },
        { key: "diger", label: "Diğer", color: "#888780" },
    ];

    const svcOpts = useMemo(
        () =>
            [...new Set(
                filteredDetails
                    .map((d) => d.ServiceExpenseName || d.ServiceExpense)
                    .filter((x) => x && x !== "-"),
            )].sort((a, b) => a.localeCompare(b, "tr")),
        [filteredDetails]
    );

    const filtered = useMemo(() => {
        if (!svcF) return filteredDetails;
        return filteredDetails.filter((d) => {
            const serviceName = d.ServiceExpenseName || d.ServiceExpense || "";
            return norm(serviceName) === norm(svcF);
        });
    }, [filteredDetails, svcF]);

    const bySvc = useMemo(() => {
        const map = new Map();
        filtered.forEach((d) => {
            const key = d.ServiceExpenseName || d.ServiceExpense || "-";
            if (!map.has(key)) map.set(key, { name: key, p: 0, s: 0 });
            const g = map.get(key);
            g.p += Number(d.PurchaseInvoiceIncome || 0);
            g.s += Number(d.SalesInvoceIncome || 0);
        });
        return [...map.values()].sort((a, b) => b.p - a.p);
    }, [filtered]);

    const byPlate = useMemo(() => {
        const unique = new Set();
        filtered.forEach((d) => {
            const plate = d.PlateNumber || "-";
            if (norm(plate).includes(norm(plateSearch))) unique.add(plate);
        });
        return [...unique].sort((a, b) => a.localeCompare(b, "tr"));
    }, [filtered, plateSearch]);

    return (
        <div className="xp-inner">
            <div className="detail-toolbar">
                <select
                    className="f-sel"
                    value={svcF}
                    onChange={(e) => setSvcF(e.target.value)}
                >
                    <option value="">Tüm hizmetler</option>
                    {svcOpts.map((o) => (
                        <option key={o} value={o}>{o}</option>
                    ))}
                </select>

                <input
                    className="f-inp"
                    placeholder="Plaka filtrele..."
                    value={plateSearch}
                    onChange={(e) => setPlateSearch(e.target.value)}
                />
            </div>

            <div className="detail-grid">
                {/* SOL: Hizmet / Masraf */}
                <section className="detail-panel detail-panel-services">
                    <div className="sec-lbl">Hizmet / Masraf ({bySvc.length})</div>

                    {bySvc.length === 0 ? (
                        <div className="detail-empty">Veri yok</div>
                    ) : (
                        <div className="dagilim-detail-list">
                            {bySvc.map((s) => {
                                const showSales = s.s !== 0;
                                const showPurchase = s.p !== 0;
                                return (
                                    <div className="dagilim-detail-row compact-row" key={s.name}>
                                        <div className="dagilim-detail-main">
                                            <div className="dagilim-detail-title">{s.name}</div>
                                        </div>
                                        <div className="dagilim-detail-fields">
                                            {showSales && (
                                                <div className="dagilim-field">
                                                    <span>Satış</span>
                                                    {fmt(s.s, true)}
                                                </div>
                                            )}
                                            {showPurchase && (
                                                <div className="dagilim-field">
                                                    <span>Alış</span>
                                                    {fmt(s.p, true)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* SAĞ: Genel Dağılım Maliyetleri - Kategorili */}
                <section className="detail-panel detail-panel-costs">
                    <div className="sec-lbl">
                        Genel Dağılım Maliyetleri ({monthlyDagilim.length})
                    </div>

                    {monthlyDagilim.length === 0 ? (
                        <div className="detail-empty">Dağılım verisi yok</div>
                    ) : (
                        <div className="dagilim-detail-list">
                            {CAT_CONFIG.map(({ key, label, color }) => {
                                const items = categorized[key];
                                if (items.length === 0) return null;
                                const total = items.reduce((s, i) => s + i.tutar, 0);
                                const isOpen = !!openCats[key];
                                return (
                                    <div key={key}>
                                        {/* Kategori başlığı */}
                                        <div
                                            className={`cat-group-header${isOpen ? " open" : ""}`}
                                            onClick={() => toggleCat(key)}
                                        >
                                            <div className="cat-group-left">
                                                <span
                                                    className="cat-dot-indicator"
                                                    style={{ background: color }}
                                                />
                                                <span className="cat-group-name">{label}</span>
                                                <span className="cat-group-count">{items.length} kalem</span>
                                            </div>
                                            <div className="cat-group-right">
                                                <span className="cat-group-total">{fmt(total, true)}</span>
                                                <span className="cat-group-chev">
                                                    {isOpen ? "▲" : "▼"}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Detay satırlar */}
                                        {isOpen && (
                                            <div className="cat-group-body">
                                                {items.map((item) => (
                                                    <div
                                                        className="cat-group-item"
                                                        key={item.id || `${item.hesap_adi}-${item.alt_kalem}`}
                                                    >
                                                        <div className="cat-item-main">
                                                            <div className="cat-item-title">
                                                                {String(item.hesap_adi).toUpperCase()}
                                                            </div>
                                                            <div className="cat-item-sub">
                                                                {item.alt_kalem}
                                                            </div>
                                                        </div>
                                                        <div className="cat-item-tutar">
                                                            {fmt(item.tutar, true)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Plakalar */}
                <section className="detail-panel detail-panel-plates">
                    <div className="sec-lbl">Plaka ({byPlate.length})</div>
                    {byPlate.length === 0 ? (
                        <div className="detail-empty">Veri yok</div>
                    ) : (
                        <div className="plate-chip-list">
                            {byPlate.map((plate) => (
                                <button
                                    key={plate}
                                    type="button"
                                    className="plate-chip"
                                    onClick={() => onPlateClick?.(plate)}
                                    title={plate}
                                >
                                    {plate}
                                </button>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
const CURRENCY_FORMAT = '#,##0.00 [$₺-tr-TR]';
const PERCENT_FORMAT = '0.00%';

function money(v) {
    return Number(v || 0);
}

function percent(v) {
    return Number(v || 0);
}

function setThinBorder(cell, color = "D9E2F2") {
    cell.border = {
        top: { style: "thin", color: { argb: color } },
        left: { style: "thin", color: { argb: color } },
        bottom: { style: "thin", color: { argb: color } },
        right: { style: "thin", color: { argb: color } },
    };
}

function styleCell(cell, opts = {}) {
    const {
        bold = false,
        size,
        color,
        bg,
        align = "left",
        valign = "middle",
        numFmt,
        border = true,
        wrap = false,
    } = opts;

    cell.font = {
        name: "Aptos",
        size: size || 11,
        bold,
        color: color ? { argb: color } : undefined,
    };

    if (bg) {
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: bg },
        };
    }

    cell.alignment = {
        horizontal: align,
        vertical: valign,
        wrapText: wrap,
    };

    if (numFmt) {
        cell.numFmt = numFmt;
    }

    if (border) {
        setThinBorder(cell);
    }
}

function mergeAndStyle(ws, range, value, opts = {}) {
    ws.mergeCells(range);
    const cell = ws.getCell(range.split(":")[0]);
    cell.value = value;
    styleCell(cell, opts);
    return cell;
}

function addSpacerRow(ws, height = 8) {
    const row = ws.addRow([]);
    row.height = height;
    return row;
}

function addSectionTitle(ws, rowIndex, title) {
    mergeAndStyle(ws, `A${rowIndex}:H${rowIndex}`, title, {
        bold: true,
        size: 13,
        color: "1E3A8A",
        bg: "EAF2FF",
        align: "left",
    });
    ws.getRow(rowIndex).height = 22;
}

function addTableHeader(ws, rowIndex, headers) {
    const row = ws.getRow(rowIndex);
    headers.forEach((header, idx) => {
        const cell = row.getCell(idx + 1);
        cell.value = header;
        styleCell(cell, {
            bold: true,
            size: 10,
            color: "5B6B83",
            bg: "F3F7FD",
            align: idx === 0 || idx === 1 ? "left" : "center",
        });
    });
    row.height = 20;
}

function addDataRow(ws, values, config = {}) {
    const row = ws.addRow(values);

    row.eachCell((cell, colNumber) => {
        styleCell(cell, {
            size: 10.5,
            color: "1F2937",
            align: colNumber <= (config.leftCols || 2) ? "left" : "right",
            wrap: !!config.wrap,
        });
    });

    if (config.currencyCols) {
        config.currencyCols.forEach((col) => {
            row.getCell(col).numFmt = CURRENCY_FORMAT;
        });
    }

    if (config.percentCols) {
        config.percentCols.forEach((col) => {
            row.getCell(col).numFmt = PERCENT_FORMAT;
        });
    }

    if (config.highlightProfitCol) {
        const cell = row.getCell(config.highlightProfitCol);
        const val = Number(cell.value || 0);

        cell.font = {
            ...(cell.font || {}),
            bold: true,
            color: { argb: val >= 0 ? "15803D" : "B91C1C" },
        };
    }

    if (config.fill) {
        row.eachCell((cell) => {
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: config.fill },
            };
        });
    }

    return row;
}

function addInfoCardRow(ws, rowIndex, startCol, title, value, opts = {}) {
    const titleCell = ws.getCell(rowIndex, startCol);
    const valueCell = ws.getCell(rowIndex + 1, startCol);

    ws.mergeCells(rowIndex, startCol, rowIndex, startCol + 1);
    ws.mergeCells(rowIndex + 1, startCol, rowIndex + 1, startCol + 1);

    titleCell.value = title;
    styleCell(titleCell, {
        bold: true,
        size: 10,
        color: "64748B",
        bg: "F8FBFF",
        align: "left",
    });

    valueCell.value = value;
    styleCell(valueCell, {
        bold: true,
        size: 14,
        color: opts.valueColor || "0F172A",
        bg: "FFFFFF",
        align: "left",
        numFmt: opts.numFmt,
    });

    ws.getRow(rowIndex).height = 18;
    ws.getRow(rowIndex + 1).height = 24;
}

export default function ProjeTablosu({
    projects = [],
    allRows = [],
    projeDagilimRows = [],
    selectedMonth,
}) {
    const [expanded, setExpanded] = useState(null);
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("profit");
    const [selPlate, setSelPlate] = useState(null);

    const filteredDagilimRows = useMemo(() => {
        if (!selectedMonth) return projeDagilimRows || [];

        return (projeDagilimRows || []).filter(
            (row) => Number(row.donem_ay || 0) === Number(selectedMonth)
        );
    }, [projeDagilimRows, selectedMonth]);

    const monthlyDagilimTotal = useMemo(() => {
        return filteredDagilimRows.reduce(
            (sum, row) => sum + Number(row.tutar || 0),
            0
        );
    }, [filteredDagilimRows]);
    const enrichedProjects = useMemo(() => {
        return projects.map((project) => {
            const projectDagilim = filteredDagilimRows.filter(
                (row) =>
                    norm(row.reel_proje_adi || row.proje_adi) === norm(project.projectName)
            );

            const dagitimToplamAlis = projectDagilim.reduce(
                (sum, row) => sum + Number(row.tutar || 0),
                0
            );
            const yeniAlis = Number(project.purchaseTotal || 0) + dagitimToplamAlis;
            const yeniKar = Number(project.salesTotal || 0) - yeniAlis;

            return {
                ...project,
                dagitimToplamAlis,
                purchaseTotalWithDagilim: yeniAlis,
                profitWithDagilim: yeniKar,
            };
        });
    }, [projects, filteredDagilimRows]);
    const filtered = useMemo(() => {
        const s = [...enrichedProjects].filter((p) =>
            norm(p.projectName).includes(norm(search))
        );

        s.sort((a, b) =>
            sort === "profit"
                ? b.profitWithDagilim - a.profitWithDagilim
                : sort === "purchase"
                    ? b.purchaseTotalWithDagilim - a.purchaseTotalWithDagilim
                    : sort === "sales"
                        ? b.salesTotal - a.salesTotal
                        : b.plateCount - a.plateCount
        );

        return s;
    }, [enrichedProjects, search, sort]);

    const totals = useMemo(() => {
        const projectTotals = filtered.reduce(
            (a, p) => ({
                p: a.p + Number(p.purchaseTotalWithDagilim || 0),
                s: a.s + Number(p.salesTotal || 0),
                plates: a.plates + Number(p.plateCount || 0),
            }),
            { p: 0, s: 0, plates: 0 }
        );

        return {
            ...projectTotals,
            p: projectTotals.p,
        };
    }, [filtered]);
    const totalProfit = totals.s - totals.p;
    const totalProfitability = totals.s > 0 ? totalProfit / totals.s : 0;

    const getProfitability = (project) => {
        if (!project.salesTotal) return 0;
        return Number(project.profitWithDagilim || 0) / Number(project.salesTotal || 0);
    };

    const formatPercent = (value) => `%${(value * 100).toFixed(1)}`;

    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "OpenAI";
        workbook.lastModifiedBy = "OpenAI";
        workbook.created = new Date();
        workbook.modified = new Date();

        const ws = workbook.addWorksheet("Rapor", {
            properties: { defaultRowHeight: 20 },
            views: [{ state: "frozen", ySplit: 6 }],
        });

        ws.columns = [
            { key: "a", width: 28 },
            { key: "b", width: 18 },
            { key: "c", width: 18 },
            { key: "d", width: 18 },
            { key: "e", width: 18 },
            { key: "f", width: 18 },
            { key: "g", width: 18 },
            { key: "h", width: 18 },
        ];

        mergeAndStyle(ws, "A1:H1", "PROJE KARLILIK RAPORU", {
            bold: true,
            size: 18,
            color: "FFFFFF",
            bg: "1D4ED8",
            align: "center",
        });

        mergeAndStyle(
            ws,
            "A2:H2",
            `Rapor Dönemi: ${selectedMonth || "Tümü"}  •  Oluşturulma: ${new Date().toLocaleString("tr-TR")}`,
            {
                bold: false,
                size: 10,
                color: "475569",
                bg: "F8FBFF",
                align: "center",
            }
        );

        addSpacerRow(ws, 8);

        addInfoCardRow(ws, 4, 1, "Toplam Proje", filtered.length, {});
        addInfoCardRow(ws, 4, 3, "Toplam Satış", money(totals.s), {
            numFmt: CURRENCY_FORMAT,
            valueColor: "0F172A",
        });
        addInfoCardRow(ws, 4, 5, "Toplam Alış", money(totals.p), {
            numFmt: CURRENCY_FORMAT,
            valueColor: "0F172A",
        });
        addInfoCardRow(ws, 4, 7, "Toplam Kâr", money(totalProfit), {
            numFmt: CURRENCY_FORMAT,
            valueColor: totalProfit >= 0 ? "15803D" : "B91C1C",
        });

        const profitabilityTitle = ws.getCell("G4");
        const profitabilityValue = ws.getCell("G5");
        profitabilityTitle.value = "Toplam Karlılık";
        profitabilityValue.value = percent(totalProfitability);
        profitabilityValue.numFmt = PERCENT_FORMAT;
        profitabilityValue.font = {
            name: "Aptos",
            size: 14,
            bold: true,
            color: { argb: totalProfitability >= 0 ? "15803D" : "B91C1C" },
        };

        addSpacerRow(ws, 10);

        let rowIndex = 7;
        addSectionTitle(ws, rowIndex, "GENEL PROJE ÖZETİ");
        rowIndex += 1;

        addTableHeader(ws, rowIndex, [
            "Proje Adı",
            "Plaka Sayısı",
            "Satış",
            "Alış",
            "Genel Dağılım",
            "Toplam Alış",
            "Kâr / Zarar",
            "Karlılık",
        ]);
        rowIndex += 1;

        filtered.forEach((p) => {
            const profitability = getProfitability(p);

            const row = addDataRow(
                ws,
                [
                    p.projectName,
                    Number(p.plateCount || 0),
                    money(p.salesTotal),
                    money(p.purchaseTotal),
                    0,
                    money(p.purchaseTotalWithDagilim),
                    money(p.profitWithDagilim),
                    percent(profitability),
                ],
                {
                    leftCols: 1,
                    currencyCols: [3, 4, 5, 6, 7],
                    percentCols: [8],
                    highlightProfitCol: 7,
                }
            );

            row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
            row.getCell(8).font = {
                name: "Aptos",
                size: 10.5,
                bold: true,
                color: { argb: profitability >= 0 ? "15803D" : "B91C1C" },
            };
            rowIndex += 1;
        });

        const totalRow = addDataRow(
            ws,
            [
                "Genel Toplam",
                "",
                money(totals.s),
                money(totals.p),
                money(monthlyDagilimTotal),
                money(totalProfit),
                percent(totalProfitability),
                "",
            ],
            {
                leftCols: 1,
                currencyCols: [3, 4, 5, 6],
                percentCols: [7],
                highlightProfitCol: 6,
                fill: "F8FBFF",
            }
        );

        totalRow.eachCell((cell) => {
            cell.font = {
                name: "Aptos",
                size: 11,
                bold: true,
                color: { argb: "0F172A" },
            };
        });

        rowIndex += 2;

        filtered.forEach((project, index) => {
            const profitability = getProfitability(project);

            addSectionTitle(
                ws,
                rowIndex,
                `${index + 1}. PROJE DETAYI — ${project.projectName}`
            );
            rowIndex += 1;

            addTableHeader(ws, rowIndex, [
                "Proje",
                "Plaka",
                "Satış",
                "Alış",
                "Toplam Alış",
                "Kâr / Zarar",
                "Karlılık",
                "Not",
            ]);
            rowIndex += 1;

            addDataRow(
                ws,
                [
                    project.projectName,
                    Number(project.plateCount || 0),
                    money(project.salesTotal),
                    money(project.purchaseTotal),
                    money(project.purchaseTotalWithDagilim),
                    money(project.profitWithDagilim),
                    percent(profitability),
                    selectedMonth || "Tümü",
                ],
                {
                    leftCols: 1,
                    currencyCols: [3, 4, 5, 6],
                    percentCols: [7],
                    highlightProfitCol: 6,
                }
            );
            rowIndex += 1;

            const serviceMap = new Map();
            (project.details || []).forEach((d) => {
                const key = d.ServiceExpenseName || d.ServiceExpense || "-";
                if (!serviceMap.has(key)) {
                    serviceMap.set(key, { service: key, sales: 0, purchase: 0 });
                }
                const item = serviceMap.get(key);
                item.sales += Number(d.SalesInvoceIncome || 0);
                item.purchase += Number(d.PurchaseInvoiceIncome || 0);
            });

            const serviceRows = [...serviceMap.values()]
                .map((s) => ({
                    ...s,
                    profit: s.sales - s.purchase,
                }))
                .sort((a, b) => b.purchase - a.purchase);

            rowIndex += 1;
            addSectionTitle(ws, rowIndex, "HİZMET / MASRAF ÖZETİ");
            rowIndex += 1;
            addTableHeader(ws, rowIndex, [
                "Hizmet / Masraf",
                "Satış",
                "Alış",
                "Kâr",
                "",
                "",
                "",
                "",
            ]);
            rowIndex += 1;

            if (serviceRows.length === 0) {
                const emptyRow = ws.addRow(["Veri yok"]);
                ws.mergeCells(`A${rowIndex}:H${rowIndex}`);
                styleCell(emptyRow.getCell(1), {
                    color: "94A3B8",
                    align: "center",
                    bg: "FCFDFF",
                });
                rowIndex += 1;
            } else {
                serviceRows.forEach((s) => {
                    addDataRow(
                        ws,
                        [s.service, money(s.sales), money(s.purchase), money(s.profit), "", "", "", ""],
                        {
                            leftCols: 1,
                            currencyCols: [2, 3, 4],
                            highlightProfitCol: 4,
                        }
                    );
                    rowIndex += 1;
                });
            }

            const monthlyDagilim = filteredDagilimRows
                .filter(
                    (row) =>
                        norm(row.reel_proje_adi || row.proje_adi) === norm(project.projectName)
                )
                .map((row) => ({
                    kullanici_adi: row.kullanici_adi || "-",
                    hesap_adi: row.hesap_adi || "-",
                    alt_kalem: row.alt_kalem || "-",
                    tutar: Number(row.tutar || 0),
                    donem_ay: row.donem_ay || "",
                }))
                .sort((a, b) => b.tutar - a.tutar);
            rowIndex += 1;
            addSectionTitle(ws, rowIndex, "GENEL DAĞILIM MALİYETLERİ");
            rowIndex += 1;
            addTableHeader(ws, rowIndex, [
                "Kullanıcı",
                "Hesap",
                "Alt Kalem",
                "Tutar",
                "Dönem",
                "",
                "",
                "",
            ]);
            rowIndex += 1;

            if (monthlyDagilim.length === 0) {
                const emptyRow = ws.addRow(["Dağılım verisi yok"]);
                ws.mergeCells(`A${rowIndex}:H${rowIndex}`);
                styleCell(emptyRow.getCell(1), {
                    color: "94A3B8",
                    align: "center",
                    bg: "FCFDFF",
                });
                rowIndex += 1;
            } else {
                monthlyDagilim.forEach((item) => {
                    addDataRow(
                        ws,
                        [
                            item.kullanici_adi,
                            item.hesap_adi,
                            item.alt_kalem,
                            money(item.tutar),
                            item.donem_ay,
                            "",
                            "",
                            "",
                        ],
                        {
                            leftCols: 3,
                            currencyCols: [4],
                        }
                    );
                    rowIndex += 1;
                });
            }

            const plates = [
                ...new Set((project.details || []).map((d) => d.PlateNumber || "-")),
            ].sort((a, b) => String(a).localeCompare(String(b), "tr"));

            rowIndex += 1;
            addSectionTitle(ws, rowIndex, "PLAKALAR");
            rowIndex += 1;
            addTableHeader(ws, rowIndex, [
                "Plaka",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
            ]);
            rowIndex += 1;

            if (plates.length === 0) {
                const emptyRow = ws.addRow(["Veri yok"]);
                ws.mergeCells(`A${rowIndex}:H${rowIndex}`);
                styleCell(emptyRow.getCell(1), {
                    color: "94A3B8",
                    align: "center",
                    bg: "FCFDFF",
                });
                rowIndex += 1;
            } else {
                plates.forEach((plate) => {
                    const row = ws.addRow([plate]);
                    ws.mergeCells(`A${rowIndex}:H${rowIndex}`);
                    const cell = row.getCell(1);
                    styleCell(cell, {
                        bold: true,
                        size: 10.5,
                        color: "1D4ED8",
                        bg: "F8FBFF",
                        align: "left",
                    });
                    rowIndex += 1;
                });
            }

            rowIndex += 1;
        });

        ws.eachRow((row) => {
            row.eachCell((cell) => {
                if (!cell.alignment) {
                    cell.alignment = { vertical: "middle" };
                }
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const fileData = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        saveAs(fileData, `proje-raporu-modern-${selectedMonth || "tum-aylar"}.xlsx`);
    };

    return (
        <div className="page">
            <PlateDetailModal
                plateNumber={selPlate}
                allRows={allRows}
                onClose={() => setSelPlate(null)}
            />

            <div className="card">
                <div className="card-head">
                    <div className="toolbar-top">
                        <div className="toolbar-left">
                            <div className="sb-search-wrap">
                                <span className="sb-icon">⌕</span>
                                <input
                                    className="sb-search"
                                    placeholder="Proje ara..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            <select
                                className="f-sel"
                                value={sort}
                                onChange={(e) => setSort(e.target.value)}
                            >
                                <option value="profit">Kâra göre</option>
                                <option value="purchase">Alışa göre</option>
                                <option value="sales">Satışa göre</option>
                                <option value="plates">Plaka sayısına göre</option>
                            </select>
                        </div>

                        <div className="toolbar-right">
                            <button
                                type="button"
                                className="excel-btn"
                                onClick={handleExportExcel}
                                title="Modern Excel raporu oluştur"
                            >
                                <span className="excel-btn-icon">⬇</span>
                                Excel’e Aktar
                            </button>
                        </div>
                    </div>

                    <div className="toolbar-bottom">
                        <span className="f-tag">{filtered.length} proje</span>
                        <span className="f-tag">Ay: {selectedMonth || "Tümü"}</span>
                        <span className="f-tag">
                            Genel Dağılım: {fmt(monthlyDagilimTotal, true)}
                        </span>
                    </div>
                </div>

                <div className="tbl-wrap">
                    <table className="project-table">
                        <thead>
                            <tr>
                                <th style={{ width: 44 }}></th>
                                <th className="col-project">Proje Adı</th>
                                <th className="c col-plate">Sefer Plaka</th>
                                <th className="r col-money">Satış</th>
                                <th className="r col-money">Alış</th>
                                <th className="r col-money">Kâr / Zarar</th>
                                <th className="r col-profitability">Karlılık</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7}>
                                        <div className="empty">Proje bulunamadı.</div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((project) => {
                                    const isOpen = expanded === project.key;
                                    const profitability = getProfitability(project);

                                    return (
                                        <React.Fragment key={project.key}>
                                            <tr
                                                className={`clk ${isOpen ? "xpnd" : ""}`}
                                                onClick={() =>
                                                    setExpanded((prev) =>
                                                        prev === project.key ? null : project.key
                                                    )
                                                }
                                            >
                                                <td>
                                                    <span className="chev">
                                                        {isOpen ? "▲" : "▼"}
                                                    </span>
                                                </td>

                                                <td className="project-name-cell">
                                                    {project.projectName}
                                                </td>

                                                <td className="c">
                                                    <span className="b b-gr">
                                                        {project.plateCount}
                                                    </span>
                                                </td>

                                                <td className="r compact-money">
                                                    {fmt(project.salesTotal, true)}
                                                </td>

                                                <td className="r muted compact-money">
                                                    {fmt(project.purchaseTotalWithDagilim, true)}
                                                </td>

                                                <td className="r compact-money">
                                                    <strong>{fmt(project.profitWithDagilim, true)}</strong>
                                                </td>

                                                <td className="r">
                                                    <span
                                                        className={`ratio-pill ${profitability >= 0 ? "pos" : "neg"}`}
                                                        title="Kâr / Satış"
                                                    >
                                                        {formatPercent(profitability)}
                                                    </span>
                                                </td>
                                            </tr>

                                            {isOpen && (
                                                <tr>
                                                    <td colSpan={7} className="xp-td">
                                                        <ServiceBreakdown
                                                            details={project.details}
                                                            onPlateClick={setSelPlate}
                                                            projeDagilimRows={filteredDagilimRows.filter(
                                                                (row) =>
                                                                    norm(row.reel_proje_adi || row.proje_adi) === norm(project.projectName)
                                                            )}
                                                            selectedMonth={selectedMonth}
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>

                        <tfoot>
                            <tr>
                                <td></td>
                                <td className="tfoot-label">Genel Toplam</td>

                                <td className="c">
                                    <span className="b b-gr">{totals.plates}</span>
                                </td>

                                <td className="r">{fmt(totals.s, true)}</td>
                                <td className="r">{fmt(totals.p, true)}</td>
                                <td className="r">{fmt(totalProfit, true)}</td>
                                <td className="r">
                                    <span
                                        className={`ratio-pill ${totalProfitability >= 0 ? "pos" : "neg"}`}
                                    >
                                        {formatPercent(totalProfitability)}
                                    </span>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
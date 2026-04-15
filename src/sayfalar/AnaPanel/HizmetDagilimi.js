import { useMemo, useState } from "react";
import KarRozeti from "./KarRozeti";
import { norm, paraBicimlendir } from "./araclar";

export default function HizmetDagilimi({ details = [], onPlateClick }) {
    const [seciliHizmet, setSeciliHizmet] = useState("");
    const [plakaSearch, setPlakaSearch] = useState("");

    const hizmetSecenekleri = useMemo(
        () =>
            [...new Set(details.map((d) => d.ServiceExpense).filter((x) => x && x !== "-"))]
                .sort((a, b) => a.localeCompare(b, "tr")),
        [details]
    );

    const filtreli = useMemo(
        () => (seciliHizmet ? details.filter((d) => norm(d.ServiceExpense) === norm(seciliHizmet)) : details),
        [details, seciliHizmet]
    );

    const hizmeteGore = useMemo(() => {
        const map = new Map();

        filtreli.forEach((d) => {
            const key = d.ServiceExpenseName || "-";
            if (!map.has(key)) map.set(key, { name: key, p: 0, s: 0 });
            const g = map.get(key);
            g.p += d.PurchaseInvoiceIncome;
            g.s += d.SalesInvoceIncome;
        });

        return [...map.values()]
            .map((x) => ({ ...x, profit: x.s - x.p }))
            .sort((a, b) => b.profit - a.profit);
    }, [filtreli]);

    const plakayaGore = useMemo(() => {
        const map = new Map();

        filtreli.forEach((d) => {
            const key = d.PlateNumber || "-";
            if (!map.has(key)) map.set(key, { plate: key, p: 0, s: 0 });
            const g = map.get(key);
            g.p += d.PurchaseInvoiceIncome;
            g.s += d.SalesInvoceIncome;
        });

        return [...map.values()]
            .map((x) => ({ ...x, profit: x.s - x.p }))
            .filter((p) => norm(p.plate).includes(norm(plakaSearch)))
            .sort((a, b) => b.profit - a.profit);
    }, [filtreli, plakaSearch]);

    return (
        <div className="xp-inner">
            <div className="f-row" style={{ marginBottom: 12 }}>
                <select className="f-sel" value={seciliHizmet} onChange={(e) => setSeciliHizmet(e.target.value)}>
                    <option value="">Tüm hizmetler</option>
                    {hizmetSecenekleri.map((o) => (
                        <option key={o} value={o}>
                            {o}
                        </option>
                    ))}
                </select>

                <input
                    className="f-inp"
                    placeholder="Plaka filtrele..."
                    value={plakaSearch}
                    onChange={(e) => setPlakaSearch(e.target.value)}
                />
            </div>

            <div className="xp-grid">
                <div>
                    <div className="sec-lbl">Hizmet / Masraf ({hizmeteGore.length})</div>
                    <div className="mini-tbl">
                        <div className="mini-tbl-body">
                            <table>
                                <thead>
                                    <tr>
                                        <th>ÝSÝM</th>
                                        <th className="r">ALIÞ</th>
                                        <th className="r">SATIÞ</th>
                                        <th className="r">KAR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hizmeteGore.length === 0 ? (
                                        <tr>
                                            <td colSpan={4}><div className="empty">Veri yok</div></td>
                                        </tr>
                                    ) : (
                                        hizmeteGore.map((s) => (
                                            <tr key={s.name}>
                                                <td
                                                    style={{
                                                        maxWidth: 220,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        fontWeight: 800,
                                                    }}
                                                    title={s.name}
                                                >
                                                    {s.name}
                                                </td>
                                                <td className="r" style={{ color: "var(--text2)" }}>
                                                    {paraBicimlendir(s.p, true)}
                                                </td>
                                                <td className="r" style={{ fontWeight: 800 }}>
                                                    {paraBicimlendir(s.s, true)}
                                                </td>
                                                <td className="r">
                                                    <KarRozeti value={s.profit} />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div>
                    <div className="sec-lbl">Plaka ({plakayaGore.length})</div>
                    <div className="mini-tbl">
                        <div className="mini-tbl-body">
                            <table>
                                <thead>
                                    <tr>
                                        <th>PLAKA</th>
                                        <th className="r">ALIÞ</th>
                                        <th className="r">SATIÞ</th>
                                        <th className="r">KAR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plakayaGore.length === 0 ? (
                                        <tr>
                                            <td colSpan={4}><div className="empty">Veri yok</div></td>
                                        </tr>
                                    ) : (
                                        plakayaGore.map((p) => (
                                            <tr key={p.plate} className="clk" onClick={() => onPlateClick?.(p.plate)}>
                                                <td style={{ fontWeight: 900 }}>{p.plate}</td>
                                                <td className="r" style={{ color: "var(--text2)" }}>
                                                    {paraBicimlendir(p.p, true)}
                                                </td>
                                                <td className="r" style={{ fontWeight: 800 }}>
                                                    {paraBicimlendir(p.s, true)}
                                                </td>
                                                <td className="r">
                                                    <KarRozeti value={p.profit} />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
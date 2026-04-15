export function paraBicimlendir(value, short = false) {
    const n = Number(value || 0);

    if (short) {
        if (Math.abs(n) >= 1_000_000) {
            return (n / 1_000_000).toFixed(1).replace(".", ",") + "M ₺";
        }
        if (Math.abs(n) >= 1_000) {
            return (n / 1_000).toFixed(0) + "K ₺";
        }
        return n.toLocaleString("tr-TR") + " ₺";
    }

    return n.toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}

export function sayiCoz(value) {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;

    let str = String(value).trim();

    if (str.includes(",") && str.includes(".")) {
        str = str.replace(/\./g, "").replace(",", ".");
    } else if (str.includes(",")) {
        str = str.replace(",", ".");
    }

    const parsed = Number(str);
    return Number.isNaN(parsed) ? 0 : parsed;
}

export function norm(value) {
    return String(value || "").trim().toLocaleLowerCase("tr-TR");
}

export function ayEtiketi(start, end) {
    if (!start || !end) return "-";

    const s = new Date(start);
    const e = new Date(end);

    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "-";

    const ayniAy =
        s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();

    if (ayniAy) {
        return s.toLocaleDateString("tr-TR", {
            month: "long",
            year: "numeric",
        });
    }

    return `${s.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "short",
    })} - ${e.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    })}`;
}

export function satirlariNormalizeEt(data) {
    return (data || []).map((item, index) => ({
        id: item.id || item.TMSDespatchesId || `row-${index}`,
        Tipi: item.Tipi || item.Type || "-",
        TMSDespatchesId: item.TMSDespatchesId || `despatch-${index}`,
        TMSDespatchesDocumentNo:
            item.TMSDespatchesDocumentNo || item.DocumentNo || "-",
        TMSDespatchesDespatchDate: item.TMSDespatchesDespatchDate || null,
        SupplierName: item.SupplierName || "-",
        CurrentAccountsName: item.CurrentAccountsName || "-",
        ServiceExpense: item.ServiceExpense || "-",
        ServiceExpenseName: item.ServiceExpenseName || "-",
        PlateNumber: item.PlateNumber || "-",
        SubServiceName: item.SubServiceName || "-",
        ProjectName: item.ProjectName || "PROJESİZ",
        GivenVehicleTypeName: item.GivenVehicleTypeName || "-",
        VehicleWorkingTypeId: item.VehicleWorkingTypeId || "-",
        VehicleMasterGroupName: item.VehicleMasterGroupName || "-",
        SpecialGroupName: item.SpecialGroupName || "-",
        PurchaseInvoiceIncome: sayiCoz(item.PurchaseInvoiceIncome),
        SalesInvoceIncome: sayiCoz(item.SalesInvoceIncome),
        CreatedByName: item.CreatedByName || "-",
        CreatedDate: item.CreatedDate || null,
    }));
}

export function projeyeGoreTopla(rows) {
    const map = new Map();

    (rows || []).forEach((satir) => {
        const key = satir.ProjectName || "PROJESİZ";

        if (!map.has(key)) {
            map.set(key, {
                key,
                projectName: key,
                purchaseTotal: 0,
                salesTotal: 0,
                profit: 0,
                details: [],
            });
        }

        const item = map.get(key);
        item.purchaseTotal += Number(satir.PurchaseInvoiceIncome || 0);
        item.salesTotal += Number(satir.SalesInvoceIncome || 0);
        item.profit = item.salesTotal - item.purchaseTotal;
        item.details.push(satir);
    });

    return [...map.values()]
        .map((item) => ({
            ...item,
            plateCount: new Set(item.details.map((x) => x.PlateNumber || "-")).size,
        }))
        .sort((a, b) => b.profit - a.profit);
}

export function plakayaGoreTopla(rows) {
    const map = new Map();

    (rows || []).forEach((satir) => {
        const key = satir.PlateNumber || "-";

        if (!map.has(key)) {
            map.set(key, {
                plate: key,
                p: 0,
                s: 0,
                projects: new Set(),
                services: new Set(),
                rows: 0,
            });
        }

        const item = map.get(key);
        item.p += Number(satir.PurchaseInvoiceIncome || 0);
        item.s += Number(satir.SalesInvoceIncome || 0);
        item.rows += 1;

        if (satir.ProjectName) item.projects.add(satir.ProjectName);
        if (satir.ServiceExpenseName && satir.ServiceExpenseName !== "-") {
            item.services.add(satir.ServiceExpenseName);
        }
    });

    return [...map.values()].map((x) => ({
        ...x,
        profit: x.s - x.p,
    }));
}

export function hizmeteGoreTopla(rows) {
    const map = new Map();

    (rows || []).forEach((satir) => {
        const key = satir.ServiceExpenseName || "-";

        if (!map.has(key)) {
            map.set(key, {
                name: key,
                p: 0,
                s: 0,
                count: 0,
            });
        }

        const item = map.get(key);
        item.p += Number(satir.PurchaseInvoiceIncome || 0);
        item.s += Number(satir.SalesInvoceIncome || 0);
        item.count += 1;
    });

    return [...map.values()].map((x) => ({
        ...x,
        profit: x.s - x.p,
    }));
}

export function veriyeGoreCevapUret(question, projects = [], rows = []) {
    const q = norm(question);

    const totalPurchase = rows.reduce((a, r) => a + Number(r.PurchaseInvoiceIncome || 0), 0);
    const totalSales = rows.reduce((a, r) => a + Number(r.SalesInvoceIncome || 0), 0);
    const totalProfit = totalSales - totalPurchase;

    const sortedProjects = [...projects].sort((a, b) => b.profit - a.profit);
    const profitableProjects = projects.filter((p) => p.profit > 0);
    const lossProjects = [...projects]
        .filter((p) => p.profit < 0)
        .sort((a, b) => a.profit - b.profit);

    const bestProject = sortedProjects[0];
    const worstProject = [...projects].sort((a, b) => a.profit - b.profit)[0];

    const plates = plakayaGoreTopla(rows).sort((a, b) => b.profit - a.profit);
    const services = hizmeteGoreTopla(rows).sort((a, b) => b.profit - a.profit);

    const bestPlate = plates[0];
    const worstPlate = [...plates].sort((a, b) => a.profit - b.profit)[0];
    const bestService = services[0];
    const worstService = [...services].sort((a, b) => a.profit - b.profit)[0];

    const projectMention = projects.find((p) => q.includes(norm(p.projectName)));
    const plateMention = plates.find((p) => q.includes(norm(p.plate)));

    if (rows.length === 0) {
        return "Henüz analiz edilecek veri yok. Önce tarih aralığı seçip veri yüklemelisin.";
    }

    if (projectMention) {
        return `${projectMention.projectName} projesinde alış ${paraBicimlendir(projectMention.purchaseTotal)}, satış ${paraBicimlendir(projectMention.salesTotal)}, net sonuç ${paraBicimlendir(projectMention.profit)}. Bu projede ${projectMention.plateCount} farklı plaka var.`;
    }

    if (plateMention) {
        return `${plateMention.plate} plakasında alış ${paraBicimlendir(plateMention.p)}, satış ${paraBicimlendir(plateMention.s)}, net sonuç ${paraBicimlendir(plateMention.profit)}. ${plateMention.projects.size} projede ve ${plateMention.services.size} hizmet türünde işlem görünüyor.`;
    }

    if (q.includes("özet") || q.includes("genel durum") || q.includes("toplam")) {
        return `Genel özet şöyle:
• Toplam alış: ${paraBicimlendir(totalPurchase)}
• Toplam satış: ${paraBicimlendir(totalSales)}
• Net kar: ${paraBicimlendir(totalProfit)}
• Toplam proje: ${projects.length}
• Karlı proje: ${profitableProjects.length}
• Zararlı proje: ${lossProjects.length}
• Toplam plaka: ${plates.length}`;
    }

    if (q.includes("en karlı proje") || q.includes("hangi proje en karlı") || q.includes("en iyi proje")) {
        return bestProject
            ? `En karlı proje ${bestProject.projectName}. Alış ${paraBicimlendir(bestProject.purchaseTotal)}, satış ${paraBicimlendir(bestProject.salesTotal)}, net kar ${paraBicimlendir(bestProject.profit)}.`
            : "Proje verisi bulunamadı.";
    }

    if (q.includes("zararlı proje") || q.includes("en kötü proje")) {
        return worstProject
            ? `En düşük performanslı proje ${worstProject.projectName}. Alış ${paraBicimlendir(worstProject.purchaseTotal)}, satış ${paraBicimlendir(worstProject.salesTotal)}, net sonuç ${paraBicimlendir(worstProject.profit)}.`
            : "Zararlı proje bulunamadı.";
    }

    if (q.includes("en iyi plaka") || q.includes("en karlı plaka")) {
        return bestPlate
            ? `En iyi plaka ${bestPlate.plate}. Alış ${paraBicimlendir(bestPlate.p)}, satış ${paraBicimlendir(bestPlate.s)}, net kar ${paraBicimlendir(bestPlate.profit)}.`
            : "Plaka verisi bulunamadı.";
    }

    if (q.includes("en kötü plaka") || q.includes("zararlı plaka")) {
        return worstPlate
            ? `En zayıf plaka ${worstPlate.plate}. Alış ${paraBicimlendir(worstPlate.p)}, satış ${paraBicimlendir(worstPlate.s)}, net sonuç ${paraBicimlendir(worstPlate.profit)}.`
            : "Zararlı plaka bulunamadı.";
    }

    if (q.includes("hizmet") || q.includes("masraf")) {
        const top3 = services.slice(0, 3);
        return `Hizmet bazında en güçlü alanlar:
${top3
                .map(
                    (s, i) =>
                        `${i + 1}. ${s.name} → alış ${paraBicimlendir(s.p)}, satış ${paraBicimlendir(s.s)}, net ${paraBicimlendir(s.profit)}`
                )
                .join("\n")}
${worstService ? `En zayıf hizmet alanı ise ${worstService.name}; net sonuç ${paraBicimlendir(worstService.profit)}.` : ""}`;
    }

    if (q.includes("öneri") || q.includes("ne yapalım") || q.includes("aksiyon")) {
        const rec = [];
        if (lossProjects.length > 0) {
            rec.push(`Zararlı projeler içinde ilk odak noktası: ${lossProjects[0].projectName}.`);
        }
        if (worstPlate && worstPlate.profit < 0) {
            rec.push(`Zarar eden plaka ${worstPlate.plate} için hizmet bazlı maliyet kırılımı incelenmeli.`);
        }
        if (worstService && worstService.profit < 0) {
            rec.push(`Zarar üreten hizmet kalemi ${worstService.name}; fiyatlama ve tedarikçi tarafı gözden geçirilmeli.`);
        }
        if (bestProject) {
            rec.push(`En karlı proje ${bestProject.projectName}; benzer operasyon modeli diğer projelerde referans alınabilir.`);
        }
        return rec.join("\n");
    }

    return `Bu soruya mevcut proje tablosundaki veriye göre cevap veriyorum:
• Toplam alış: ${paraBicimlendir(totalPurchase)}
• Toplam satış: ${paraBicimlendir(totalSales)}
• Net kar: ${paraBicimlendir(totalProfit)}
• En karlı proje: ${bestProject?.projectName || "-"}
• En iyi plaka: ${bestPlate?.plate || "-"}
Daha net bir soru sorarsan proje, plaka veya hizmet bazında detay verebilirim.`;
}

/* Eski importları bozmamak için alias exportlar */
export const fmt = paraBicimlendir;
export const parseNumber = sayiCoz;
export const monthLabel = ayEtiketi;
export const normalizeRows = satirlariNormalizeEt;
export const aggregateByProject = projeyeGoreTopla;
export const aggregatePlateSummary = plakayaGoreTopla;
export const aggregateServiceSummary = hizmeteGoreTopla;
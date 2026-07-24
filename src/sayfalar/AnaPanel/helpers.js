export function fmt(value, short = false) {
    const n = Number(value || 0);

    if (short) {
        return (
            n.toLocaleString("tr-TR", {
                maximumFractionDigits: 0,
            }) + " ₺"
        );
    }

    return n.toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0,
    });
}

export function parseNumber(value) {
    if (value === null || value === undefined || value === "") {
        return 0;
    }

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }

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
    return String(value || "")
        .toLocaleLowerCase("tr-TR")
        .replace(/ı/g, "i")
        .replace(/ş/g, "s")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[_\s]+/g, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

export function monthLabel(start, end) {
    if (!start || !end) return "-";

    const s = new Date(start);
    const e = new Date(end);

    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
        return "-";
    }

    const sameMonth =
        s.getFullYear() === e.getFullYear() &&
        s.getMonth() === e.getMonth();

    if (sameMonth) {
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

function getRowIncome(row) {
    const tipi = norm(row.Tipi);

    if (tipi !== "gelir") {
        return 0;
    }

    return parseNumber(row.SalesInvoceIncome);
}

function getRowExpense(row) {
    const tipi = norm(row.Tipi);

    if (tipi !== "gider") {
        return 0;
    }

    return parseNumber(row.PurchaseInvoiceIncome);
}

export function normalizeRows(data) {
    if (!Array.isArray(data)) {
        return [];
    }

    return data.map((item, index) => {
        const row = {
            ...item,

            id:
                item.id ||
                item.TMSDespatchIncomeExpenseId ||
                item.TMSDespatchesId ||
                `row-${index}`,

            Tipi:
                item.Tipi ||
                item.Type ||
                "-",

            TMSDespatchesId:
                item.TMSDespatchesId ||
                `despatch-${index}`,

            TMSDespatchIncomeExpenseId:
                item.TMSDespatchIncomeExpenseId ||
                null,

            TMSDespatchesDocumentNo:
                item.TMSDespatchesDocumentNo ||
                item.DocumentNo ||
                "-",

            TMSDespatchesDespatchDate:
                item.TMSDespatchesDespatchDate ||
                null,

            SupplierName:
                item.SupplierName ||
                "-",

            CurrentAccountsName:
                item.CurrentAccountsName ||
                "-",

            ServiceExpense:
                item.ServiceExpense ||
                "-",

            ServiceExpenseName:
                item.ServiceExpenseName ||
                "-",

            PlateNumber:
                item.PlateNumber ||
                "-",

            SubServiceName:
                item.SubServiceName ||
                "-",

            ProjectName:
                item.ProjectName ||
                "PROJESİZ",

            GivenVehicleTypeName:
                item.GivenVehicleTypeName ||
                "-",

            VehicleWorkingTypeId:
                item.VehicleWorkingTypeId ||
                "-",

            VehicleMasterGroupName:
                item.VehicleMasterGroupName ||
                "-",

            SpecialGroupName:
                item.SpecialGroupName ||
                "-",

            ServiceIncome:
                parseNumber(item.ServiceIncome),

            CostIncome:
                parseNumber(item.CostIncome),

            SalesInvoceIncome:
                parseNumber(item.SalesInvoceIncome),

            SalesOrderIncome:
                parseNumber(item.SalesOrderIncome),

            ServiceExpenses:
                parseNumber(item.ServiceExpenses),

            CostExpenses:
                parseNumber(item.CostExpenses),

            PurchaseInvoiceIncome:
                parseNumber(item.PurchaseInvoiceIncome),

            PurchaseOrderRevenue:
                parseNumber(item.PurchaseOrderRevenue),

            CreatedByName:
                item.CreatedByName ||
                "-",

            CreatedDate:
                item.CreatedDate ||
                null,
        };

        row.incomeTotal = getRowIncome(row);
        row.expenseTotal = getRowExpense(row);
        row.profit = row.incomeTotal - row.expenseTotal;

        return row;
    });
}

export function aggregateByProject(rows) {
    const map = new Map();

    rows.forEach((r) => {
        const key = r.ProjectName || "PROJESİZ";

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

        item.purchaseTotal += Number(r.expenseTotal || 0);
        item.salesTotal += Number(r.incomeTotal || 0);
        item.profit = item.salesTotal - item.purchaseTotal;
        item.details.push(r);
    });

    return [...map.values()]
        .map((item) => ({
            ...item,

            plateCount: new Set(
                item.details.map(
                    (x) => x.PlateNumber || "-"
                )
            ).size,
        }))
        .sort((a, b) => b.profit - a.profit);
}

export function aggregatePlateSummary(rows) {
    const map = new Map();

    rows.forEach((r) => {
        const key = r.PlateNumber || "-";

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

        item.p += Number(r.expenseTotal || 0);
        item.s += Number(r.incomeTotal || 0);
        item.rows += 1;

        if (r.ProjectName) {
            item.projects.add(r.ProjectName);
        }

        if (
            r.ServiceExpenseName &&
            r.ServiceExpenseName !== "-"
        ) {
            item.services.add(r.ServiceExpenseName);
        }
    });

    return [...map.values()].map((item) => ({
        ...item,
        profit: item.s - item.p,
    }));
}

export function aggregateServiceSummary(rows) {
    const map = new Map();

    rows.forEach((r) => {
        const key = r.ServiceExpenseName || "-";

        if (!map.has(key)) {
            map.set(key, {
                name: key,
                p: 0,
                s: 0,
                count: 0,
            });
        }

        const item = map.get(key);

        item.p += Number(r.expenseTotal || 0);
        item.s += Number(r.incomeTotal || 0);
        item.count += 1;
    });

    return [...map.values()].map((item) => ({
        ...item,
        profit: item.s - item.p,
    }));
}
import * as XLSX from "xlsx";

const HEADER_MAP = {
    "tarih": "tarih",
    "sıra": "sira",
    "y.no": "yevmiyeNo",
    "fiş tipi": "fisTipi",
    "sorumluluk merkezi kodu": "sorumlulukMerkeziKodu",
    "sorumluluk merkezi adı": "sorumlulukMerkeziAdi",
    "açıklama": "aciklama",
    "hesap kodu": "hesapKodu",
    "hesap adı": "hesapAdi",
    "borç": "borc",
    "alacak": "alacak",
    "borç bakiye": "borcBakiye",
    "alacak bakiye": "alacakBakiye",
};

function normalizeText(value) {
    return String(value ?? "")
        .replace(/\u00A0/g, " ")
        .replace(/\r/g, " ")
        .replace(/\n/g, " ")
        .replace(/\t/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeHeader(value) {
    return normalizeText(value).toLocaleLowerCase("tr-TR");
}

function excelDateToJSDate(value) {
    if (value == null || value === "") return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
    }

    if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (!parsed) return null;
        return new Date(parsed.y, parsed.m - 1, parsed.d);
    }

    const text = normalizeText(value);
    const m = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (m) {
        return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    }

    const native = new Date(text);
    return Number.isNaN(native.getTime()) ? null : native;
}

function toNumberTR(value) {
    if (value === null || value === undefined || value === "") return 0;

    if (typeof value === "number") return value;

    let text = String(value).trim();

    if (!text) return 0;

    text = text
        .replace(/\u00A0/g, "")
        .replace(/\s/g, "")
        .replace(/[₺]/g, "");

    if (text.includes(".") && text.includes(",")) {
        text = text.replace(/\./g, "").replace(",", ".");
    } else if (text.includes(",")) {
        text = text.replace(",", ".");
    }

    text = text.replace(/[^\d.-]/g, "");

    const num = Number(text);
    return Number.isNaN(num) ? 0 : num;
}

function normalizeRawRowKeys(rawRow) {
    const mapped = {};

    Object.entries(rawRow).forEach(([key, value]) => {
        mapped[normalizeHeader(key)] = value;
    });

    return mapped;
}

function hasMeaningfulData(row) {
    return Boolean(
        normalizeText(row.aciklama) ||
        normalizeText(row.hesapAdi) ||
        normalizeText(row.hesapKodu) ||
        normalizeText(row.yevmiyeNo) ||
        normalizeText(row.fisTipi) ||
        Number(row.borc) > 0 ||
        Number(row.alacak) > 0 ||
        Number(row.borcBakiye) > 0 ||
        Number(row.alacakBakiye) > 0
    );
}

function mapRawRow(rawRow, index) {
    const normalizedRow = normalizeRawRowKeys(rawRow);
    const row = {};

    Object.entries(HEADER_MAP).forEach(([excelHeader, fieldName]) => {
        row[fieldName] = normalizedRow[excelHeader] ?? "";
    });

    row.id = `${index + 1}-${Math.random().toString(36).slice(2, 9)}`;

    row.aciklama = normalizeText(row.aciklama);
    row.hesapAdi = normalizeText(row.hesapAdi);
    row.hesapKodu = normalizeText(row.hesapKodu);
    row.sorumlulukMerkeziAdi = normalizeText(row.sorumlulukMerkeziAdi);
    row.sorumlulukMerkeziKodu = normalizeText(row.sorumlulukMerkeziKodu);
    row.fisTipi = normalizeText(row.fisTipi);
    row.yevmiyeNo = normalizeText(row.yevmiyeNo);
    row.sira = normalizeText(row.sira);

    row.tarihObj = excelDateToJSDate(row.tarih);

    row.borc = toNumberTR(row.borc);
    row.alacak = toNumberTR(row.alacak);
    row.borcBakiye = toNumberTR(row.borcBakiye);
    row.alacakBakiye = toNumberTR(row.alacakBakiye);

    row.selected = false;
    row.kullaniciId = null;
    row.projeId = null;
    row.atamaTipi = "user";
    row.aktarimTipi = "full";

    row.rawText = [
        row.tarih,
        row.sira,
        row.yevmiyeNo,
        row.fisTipi,
        row.sorumlulukMerkeziKodu,
        row.sorumlulukMerkeziAdi,
        row.aciklama,
        row.hesapKodu,
        row.hesapAdi,
        row.borc,
        row.alacak,
        row.borcBakiye,
        row.alacakBakiye,
    ]
        .filter((x) => x !== null && x !== undefined && String(x).trim() !== "")
        .join(" | ");

    return row;
}

export async function parseMuhasebeExcel(file) {
    const buffer = await file.arrayBuffer();

    const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
        raw: true,
    });

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const jsonRows = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
        raw: true,
    });

    const rows = jsonRows
        .map((rawRow, index) => mapRawRow(rawRow, index))
        .filter(hasMeaningfulData);

    return {
        sheetName: firstSheetName,
        rows,
    };
}

export function formatMoney(value) {
    return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 2,
    }).format(Number(value || 0));
}

export function formatDateTR(value) {
    if (!value) return "-";

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("tr-TR").format(date);
}

export function uniqueValues(rows, key) {
    return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b), "tr")
    );
}
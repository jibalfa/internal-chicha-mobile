/**
 * Utilitas Manajemen Waktu & Tanggal Zona Waktu WIB (Asia/Jakarta, UTC+7)
 * Memastikan kalkulasi pergantian hari, filter tanggal, dan rekapitulasi kas
 * tepat dihitung dari 00:00:00 WIB sampai 23:59:59.999 WIB.
 */

export interface WIBDateRange {
  startDate: Date;
  endDate: Date;
  dateStr: string; // YYYY-MM-DD
  displayDate: string; // e.g. "22 Okt 2026"
}

/**
 * Mendapatkan rentang waktu 'Hari Ini' dalam zona waktu WIB (UTC+7)
 */
export function getWIBTodayRange(): WIBDateRange {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const dateStr = formatter.format(now); // "YYYY-MM-DD"
  const startDate = new Date(`${dateStr}T00:00:00.000+07:00`);
  const endDate = new Date(`${dateStr}T23:59:59.999+07:00`);

  const displayFormatter = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return {
    startDate,
    endDate,
    dateStr,
    displayDate: displayFormatter.format(now),
  };
}

/**
 * Mendapatkan rentang tanggal untuk berbagai preset laporan (Hari Ini, 7 Hari, Bulan Ini, Bulan Lalu, Kustom)
 * berbasis zona waktu WIB (UTC+7)
 */
export function getWIBPeriodRange(
  preset: "TODAY" | "7DAYS" | "THIS_MONTH" | "LAST_MONTH" | "CUSTOM",
  customStartDateStr?: string,
  customEndDateStr?: string
): { startDate: Date; endDate: Date; periodLabel: string } {
  const { dateStr } = getWIBTodayRange();
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1 - 12
  const day = parseInt(dayStr, 10);

  const pad = (n: number) => String(n).padStart(2, "0");

  if (preset === "TODAY") {
    const s = new Date(`${dateStr}T00:00:00.000+07:00`);
    const e = new Date(`${dateStr}T23:59:59.999+07:00`);
    return {
      startDate: s,
      endDate: e,
      periodLabel: `Hari Ini (${day} ${getMonthName(month)} ${year})`,
    };
  }

  if (preset === "7DAYS") {
    const todayStart = new Date(`${dateStr}T00:00:00.000+07:00`);
    const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
    const todayEnd = new Date(`${dateStr}T23:59:59.999+07:00`);

    const sDay = sevenDaysAgo.getUTCDate();
    const sMonth = sevenDaysAgo.getUTCMonth() + 1;

    return {
      startDate: sevenDaysAgo,
      endDate: todayEnd,
      periodLabel: `7 Hari Terakhir (${sDay} ${getMonthName(sMonth)} - ${day} ${getMonthName(month)} ${year})`,
    };
  }

  if (preset === "THIS_MONTH") {
    const startStr = `${year}-${pad(month)}-01`;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const endStr = `${year}-${pad(month)}-${pad(lastDayOfMonth)}`;

    return {
      startDate: new Date(`${startStr}T00:00:00.000+07:00`),
      endDate: new Date(`${endStr}T23:59:59.999+07:00`),
      periodLabel: `Bulan Ini (${getMonthName(month)} ${year})`,
    };
  }

  if (preset === "LAST_MONTH") {
    const lastMonthYear = month === 1 ? year - 1 : year;
    const lastMonth = month === 1 ? 12 : month - 1;
    const lastDayOfLastMonth = new Date(lastMonthYear, lastMonth, 0).getDate();

    const startStr = `${lastMonthYear}-${pad(lastMonth)}-01`;
    const endStr = `${lastMonthYear}-${pad(lastMonth)}-${pad(lastDayOfLastMonth)}`;

    return {
      startDate: new Date(`${startStr}T00:00:00.000+07:00`),
      endDate: new Date(`${endStr}T23:59:59.999+07:00`),
      periodLabel: `Bulan Lalu (${getMonthName(lastMonth)} ${lastMonthYear})`,
    };
  }

  // CUSTOM RANGE
  if (customStartDateStr && customEndDateStr) {
    const s = customStartDateStr.includes("T") ? customStartDateStr.split("T")[0] : customStartDateStr;
    const e = customEndDateStr.includes("T") ? customEndDateStr.split("T")[0] : customEndDateStr;

    return {
      startDate: new Date(`${s}T00:00:00.000+07:00`),
      endDate: new Date(`${e}T23:59:59.999+07:00`),
      periodLabel: `${formatDateDisplay(s)} s/d ${formatDateDisplay(e)}`,
    };
  }

  // Fallback to today
  const s = new Date(`${dateStr}T00:00:00.000+07:00`);
  const e = new Date(`${dateStr}T23:59:59.999+07:00`);
  return {
    startDate: s,
    endDate: e,
    periodLabel: `Hari Ini (${day} ${getMonthName(month)} ${year})`,
  };
}

function getMonthName(m: number): string {
  const names = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return names[m - 1] || "";
}

function formatDateDisplay(dStr: string): string {
  try {
    const [y, m, d] = dStr.split("-");
    return `${parseInt(d, 10)} ${getMonthName(parseInt(m, 10))} ${y}`;
  } catch {
    return dStr;
  }
}

/**
 * Format string tanggal YYYY-MM-DD saat ini dalam zona waktu WIB (UTC+7)
 */
export function getWIBDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date); // "YYYY-MM-DD"
}

/**
 * Format string jam HH:mm:ss saat ini dalam zona waktu WIB (UTC+7)
 */
export function getWIBTimeString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return formatter.format(date); // "HH:mm:ss"
}

/**
 * Membuat objek Date presisi zona waktu WIB (+07:00) dari tanggal YYYY-MM-DD dan opsional jam HH:mm atau HH:mm:ss
 */
export function createWIBDateTime(dateStr: string, timeStr?: string): Date {
  const parts = dateStr.split("-");
  const y = parts[0].padStart(4, "20");
  const m = (parts[1] || "01").padStart(2, "0");
  const d = (parts[2] || "01").padStart(2, "0");

  let hh = "12";
  let mm = "00";
  let ss = "00";

  if (timeStr && timeStr.includes(":")) {
    const tParts = timeStr.split(":");
    hh = (tParts[0] || "12").padStart(2, "0");
    mm = (tParts[1] || "00").padStart(2, "0");
    ss = (tParts[2] || "00").padStart(2, "0");
  } else {
    const [wh, wm, ws] = getWIBTimeString().split(":");
    hh = wh;
    mm = wm;
    ss = ws;
  }

  return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}.000+07:00`);
}

/**
 * Membuat rentang start & end of day presisi WIB (+07:00) dari string YYYY-MM-DD
 */
export function getWIBDayRange(dateStr: string): { startOfDay: Date; endOfDay: Date } {
  const parts = dateStr.split("-");
  const y = parts[0].padStart(4, "20");
  const m = (parts[1] || "01").padStart(2, "0");
  const d = (parts[2] || "01").padStart(2, "0");

  return {
    startOfDay: new Date(`${y}-${m}-${d}T00:00:00.000+07:00`),
    endOfDay: new Date(`${y}-${m}-${d}T23:59:59.999+07:00`),
  };
}

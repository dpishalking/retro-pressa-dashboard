/**
 * Read-only verification of GA4 Foundation sheets after production sync.
 */
import { GA4_FOUNDATION_SHEETS } from "@/config/ga4-foundation";
import { getTrafficOsSpreadsheetId } from "@/config/traffic-os";
import { readGoogleServiceAccount, readSheetValues } from "@/lib/google/sheets-client";
import { rowsFromSheet } from "@/lib/traffic-os/utils";

function quoteTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function pkFor(sheet: string, row: Record<string, string>): string {
  if (sheet === GA4_FOUNDATION_SHEETS.pageDaily) {
    return `${row.date}|${row.host_name}|${row.page_path}`;
  }
  if (sheet === GA4_FOUNDATION_SHEETS.channelDaily) {
    return `${row.date}|${row.channel_group}`;
  }
  if (sheet === GA4_FOUNDATION_SHEETS.sourceDaily) {
    return `${row.date}|${row.source}|${row.medium}`;
  }
  if (sheet === GA4_FOUNDATION_SHEETS.campaignDaily) {
    return `${row.date}|${row.campaign}|${row.source}|${row.medium}`;
  }
  if (sheet === GA4_FOUNDATION_SHEETS.landingDaily) {
    return `${row.date}|${row.host_name}|${row.landing_path}`;
  }
  if (sheet === GA4_FOUNDATION_SHEETS.eventDaily) {
    return `${row.date}|${row.event_name}`;
  }
  if (sheet === GA4_FOUNDATION_SHEETS.dataQuality) {
    return String(row.metric_id || "");
  }
  return JSON.stringify(row);
}

async function main() {
  if (!readGoogleServiceAccount()) throw new Error("SA missing");
  const spreadsheetId = getTrafficOsSpreadsheetId();
  const sheets = Object.values(GA4_FOUNDATION_SHEETS);
  const report: Array<Record<string, unknown>> = [];

  for (const sheet of sheets) {
    const values = await readSheetValues({
      spreadsheetId,
      range: `${quoteTab(sheet)}!A1:ZZ20000`
    });
    const rows = rowsFromSheet(values);
    const dates = rows
      .map((r) => String(r.date || "").trim())
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    const badDates = rows
      .map((r) => String(r.date || "").trim())
      .filter((d) => d && !/^\d{4}-\d{2}-\d{2}$/.test(d));
    const keys = new Map<string, number>();
    let dupes = 0;
    for (const row of rows) {
      const key = pkFor(sheet, row as Record<string, string>);
      const n = (keys.get(key) || 0) + 1;
      keys.set(key, n);
      if (n === 2) dupes += 1;
    }
    const propertyIds = new Set(rows.map((r) => String(r.property_id || "").trim()).filter(Boolean));
    report.push({
      sheet,
      data_rows: rows.length,
      header_cols: values[0]?.length || 0,
      unique_pks: keys.size,
      duplicate_pk_groups: dupes,
      date_min: dates[0] || null,
      date_max: dates[dates.length - 1] || null,
      bad_date_rows: badDates.length,
      property_ids: [...propertyIds],
      sample_sync_updated_at: rows[0] ? String((rows[0] as any).sync_updated_at || "") : ""
    });
  }

  // Europe/Riga: property timezone — GA4 date dimension is property-local.
  // Verify "today" in Riga is within expected window for max date.
  const rigaNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Riga" })
  );
  const rigaToday = rigaNow.toISOString().slice(0, 10);

  console.log(
    JSON.stringify(
      {
        spreadsheetId,
        verified_at_utc: new Date().toISOString(),
        europe_riga_today: rigaToday,
        timezone_note:
          "GA4 date grain is property timezone Europe/Riga (Admin API). Stored as YYYY-MM-DD from GA4 date dimension.",
        sheets: report
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import type { ShiftFeedbackReport, ShiftManagerPage } from "@/lib/shift-feedback/types";

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtMin(value: number | null) {
  if (value === null) return "—";
  if (value < 1) return "<1 мин";
  if (value < 60) return `${Math.round(value)} мин`;
  if (value < 24 * 60) return `${(value / 60).toFixed(1).replace(".", ",")} ч`;
  return `${(value / (24 * 60)).toFixed(1).replace(".", ",")} д`;
}

function fmtPct(value: number | null) {
  if (value === null) return "—";
  return `${Math.round(value)}%`;
}

function avgLabel(value: number | null) {
  if (value === null) return "—";
  return String(value).replace(".", ",");
}

function oneLine(page: ShiftManagerPage) {
  return page.headline.replace(`${page.firstName}: `, "");
}

function list(items: string[], empty: string) {
  if (!items.length) return `<p class="muted">${esc(empty)}</p>`;
  return `<ol>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ol>`;
}

function focusTable(page: ShiftManagerPage) {
  if (!page.focusLeads.length) {
    return `<p class="muted">Живых хвостов с номером лида за срез не видно.</p>`;
  }
  return `<table>
    <thead><tr><th>Лид</th><th>Почему</th><th>Что написать</th></tr></thead>
    <tbody>
      ${page.focusLeads.map((lead) => `<tr>
        <td><a href="${esc(lead.url)}">${esc(lead.title)}</a></td>
        <td>${esc(lead.note)}</td>
        <td>${esc(lead.nextStep)}</td>
      </tr>`).join("")}
    </tbody>
  </table>`;
}

function managerSheet(page: ShiftManagerPage, report: ShiftFeedbackReport) {
  return `<section class="sheet">
    <p class="kicker">Обратная связь за смену · ${esc(report.dayLabel)} · ${esc(report.shiftHours)}</p>
    <h1>${esc(page.name)}</h1>
    <p class="headline">${esc(page.headline)}</p>
    <p class="cut">${esc(report.cutLabel)}</p>
    <div class="stats">
      <div><b>${page.leadsCreated} → ${page.leadUnique}</b><span>Взял лидов / уникальные</span></div>
      <div><b>${fmtMin(page.medianReplyMin)}</b><span>Медиана ответа</span></div>
      <div><b>${fmtPct(page.shareUnder5)}</b><span>Ответы до 5 минут</span></div>
      <div><b>${page.dialogs}</b><span>Чатов в работе</span></div>
      <div><b>${avgLabel(page.avgManagerMessages)}</b><span>Сообщений на чат</span></div>
      <div><b>${page.waitingOnUs}</b><span>Клиент написал последним</span></div>
    </div>
    <p class="meta">Дубли ${page.leadDupes} · с UTM ${page.withUtm} / без ${page.withoutUtm} · позже часа ${fmtPct(page.shareOver60)}</p>
    <h2>Получилось</h2>
    ${list(page.good, "За этот срез сильных ходов в переписке не видно.")}
    <h2>Усилить</h2>
    ${list(page.better, "Держать темп: цена, один совет, вопрос на оформление.")}
    <h2>Три лида на утро</h2>
    ${focusTable(page)}
  </section>`;
}

export function renderShiftFeedbackHtml(report: ShiftFeedbackReport) {
  const teamRows = report.managers.map((page) => `<tr>
    <td>${esc(page.scheduleName || page.name)}</td>
    <td class="num">${page.leadsCreated}</td>
    <td class="num">${page.leadUnique}</td>
    <td class="num">${page.dialogs}</td>
    <td class="num">${fmtMin(page.medianReplyMin)}</td>
    <td class="num">${fmtPct(page.shareUnder5)}</td>
    <td>${esc(oneLine(page))}</td>
  </tr>`).join("");

  const unmatched = report.unmatchedSchedule.length
    ? `<p class="warn">В графике есть, в Bitrix не сопоставили: ${esc(report.unmatchedSchedule.join(", "))}.</p>`
    : "";
  const offShift = report.offShift.length
    ? `<p class="muted">Вне графика, но была работа: ${esc(report.offShift.map((row) => `${row.name} (${row.leadsCreated} лидов / ${row.dialogs} чатов)`).join("; "))}.</p>`
    : "";
  const scheduleNote = report.onShiftNames.length
    ? `На смене по графику: ${esc(report.onShiftNames.join(", "))}.`
    : "График не прочитался — в отчёт попали те, у кого сегодня были лиды или чаты.";

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Смена ${esc(report.day)}</title>
  <style>
    @page { size: A4; margin: 12mm 14mm 14mm; }
    html, body { margin: 0; padding: 0; background: #fff; color: #111; }
    body { font: 12px/1.45 "Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", serif; }
    h1 { font-size: 22px; line-height: 1.2; margin: 0 0 8px; letter-spacing: -0.02em; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; margin: 16px 0 6px; }
    p, li { font-size: 12.5px; }
    .kicker, .cut, .meta, .muted { color: #555; }
    .kicker { margin: 0 0 4px; font-size: 11px; }
    .headline { font-size: 15px; margin: 0 0 6px; }
    .cut { margin: 0 0 14px; font-size: 11px; }
    .sheet { break-after: page; padding-bottom: 8px; }
    .sheet:last-child { break-after: auto; }
    .stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 12px; margin: 0 0 10px; }
    .stats div { border-top: 1px solid #ddd; padding-top: 6px; }
    .stats b { display: block; font-size: 18px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .stats span { color: #555; font-size: 10.5px; }
    .meta { margin: 0 0 4px; font-size: 11px; }
    ol { margin: 0; padding-left: 18px; }
    li { margin: 0 0 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; vertical-align: top; padding: 5px 6px 5px 0; border-bottom: 1px solid #e6e6e6; }
    th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; font-weight: 600; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    a { color: #111; }
    .warn { color: #7a3e00; }
    .note { margin-top: 14px; }
  </style>
</head>
<body>
  <section class="sheet">
    <p class="kicker">Retro Pressa · вечерняя обратная связь</p>
    <h1>Смена ${esc(report.dayLabel)}</h1>
    <p class="headline">${esc(scheduleNote)}</p>
    <p class="cut">${esc(report.cutLabel)}</p>
    <div class="stats">
      <div><b>${report.team.created} → ${report.team.unique}</b><span>Лиды смены / уникальные</span></div>
      <div><b>${report.team.dialogs}</b><span>Чатов с активностью</span></div>
      <div><b>${report.team.waitingOnUs}</b><span>Последнее слово за клиентом</span></div>
    </div>
    <p class="meta">Дубли ${report.team.dupes} · с UTM ${report.team.withUtm} / без ${report.team.withoutUtm}. Источник: Bitrix + Open Lines, ${esc(report.timezone)}.</p>
    <h2>Кто был на смене</h2>
    <table>
      <thead><tr><th>Менеджер</th><th class="num">Лиды</th><th class="num">Уник.</th><th class="num">Чаты</th><th class="num">Ответ</th><th class="num">≤5 мин</th><th>Одна фраза</th></tr></thead>
      <tbody>${teamRows || `<tr><td colspan="7">На смене никого не нашли.</td></tr>`}</tbody>
    </table>
    ${unmatched}
    ${offShift}
    <p class="note muted">Дальше — по одной странице на человека. Это про работу с лидом за смену, не про кассу.</p>
  </section>
  ${report.managers.map((page) => managerSheet(page, report)).join("\n")}
</body>
</html>`;
}

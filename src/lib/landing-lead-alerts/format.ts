export type LandingLeadAlert = {
  landingLabel: string;
  pageUrl: string;
  id: string;
  title: string;
  name: string;
  createdAt: string;
  statusName: string;
  comment: string;
  phone: string;
  email: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  assignedName: string;
  repeat: boolean | null;
  bitrixUrl: string;
};

export function bitrixLeadUrl(leadId: string, webhookUrl: string): string {
  const portal = webhookUrl.match(/^https?:\/\/[^/]+/i)?.[0] || "https://bb-wood.bitrix24.eu";
  return `${portal}/crm/lead/details/${leadId}/`;
}

export function answersFromComment(comment: string): string {
  return comment
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^(fbclid\s*:|utm\s|email\s*:)/i.test(line))
    .join("\n");
}

export function formatRigaDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatLandingLeadAlert(lead: LandingLeadAlert): string {
  const answers = answersFromComment(lead.comment);
  const from = [lead.utmSource, lead.utmMedium].filter(Boolean).join(" / ");
  const repeat =
    lead.repeat == null ? "не проверили" : lead.repeat ? "да, телефон или email уже были" : "нет";

  const blocks = [
    [
      `${lead.landingLabel} — новый лид`,
      "",
      lead.name || "Без имени",
      `Лид ${lead.id} · ${formatRigaDateTime(lead.createdAt)} (Рига)`,
      ...(lead.bitrixUrl ? [lead.bitrixUrl] : []),
      `Стадия: ${lead.statusName || "не указана"}`,
      `Повтор: ${repeat}`,
      "",
      `Страница: ${lead.pageUrl}`,
      ...(lead.title ? [`Форма: ${lead.title}`] : [])
    ].join("\n"),
    answers ? `Заявка:\n${answers}` : "",
    [`Телефон: ${lead.phone || "нет"}`, `Email: ${lead.email || "нет"}`].join("\n"),
    [
      `Откуда: ${from || "без UTM"}`,
      lead.utmCampaign ? `Кампания: ${lead.utmCampaign}` : "",
      lead.utmContent && lead.utmContent !== lead.utmCampaign ? `Объявление: ${lead.utmContent}` : "",
      lead.utmTerm ? `Показ: ${lead.utmTerm}` : "",
      lead.assignedName ? `Ответственный: ${lead.assignedName}` : ""
    ]
      .filter(Boolean)
      .join("\n")
  ];

  return blocks.filter(Boolean).join("\n\n").slice(0, 3500);
}

export function helloMessage(labels: string[]): string {
  return [
    "Наблюдение за лендингами включено.",
    `Страницы: ${labels.join(", ")}.`,
    "Новый лид придёт в этот чат в течение пяти минут.",
    "Карточки, которые уже были в CRM на момент включения, повторно не отправляю."
  ].join("\n");
}

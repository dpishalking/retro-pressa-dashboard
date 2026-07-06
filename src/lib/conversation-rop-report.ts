import type {
  ConversationMessage,
  ConversationRopCorrelation,
  ConversationRopMetric,
  ConversationRopReport,
  PeriodKey
} from "@/types/metrics";

type DialogForReport = {
  dialogId: string;
  messages: ConversationMessage[];
  allText: string;
  clientMessages: ConversationMessage[];
  managerMessages: ConversationMessage[];
  responseTimes: number[];
  firstResponseMinutes: number | null;
  isLead: boolean;
  isRespondingLead: boolean;
  hasNormalFirstReply: boolean;
  hasWhatsappTemplateError: boolean;
  hasConcretePrice: boolean;
  hasRecipientQualification: boolean;
  hasDeliveryDeadlineQualification: boolean;
  hasVisualContent: boolean;
  hasRecommendation: boolean;
  hasDirectClosing: boolean;
  hasCheckoutMovement: boolean;
  hasCatalogHandoff: boolean;
};

const safeDiv = (num: number, den: number) => (den === 0 ? 0 : num / den);
const roundPct = (value: number) => Math.round(value * 1000) / 10;
const pp = (value: number) => `${roundPct(value)} п.п.`;

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function minutesBetween(a: string | null, b: string | null) {
  if (!a || !b) return null;
  const first = new Date(a).getTime();
  const second = new Date(b).getTime();
  if (!Number.isFinite(first) || !Number.isFinite(second) || second < first) return null;
  return (second - first) / 60000;
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function groupDialogs(messages: ConversationMessage[]) {
  const groups = new Map<string, ConversationMessage[]>();
  messages.forEach((message) => {
    groups.set(message.dialogId, [...(groups.get(message.dialogId) ?? []), message]);
  });

  return Array.from(groups.entries()).map(([dialogId, group]) => {
    const sorted = [...group].sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
    const clientMessages = sorted.filter((message) => message.senderRole === "client" || message.senderRole === "unknown");
    const managerMessages = sorted.filter((message) => message.senderRole === "manager");
    const allText = sorted.map((message) => message.text).join("\n");
    const managerText = managerMessages.map((message) => message.text).join("\n");
    const clientText = clientMessages.map((message) => message.text).join("\n");
    const responseTimes = clientMessages.flatMap((message, index) => {
      const response = sorted.slice(sorted.indexOf(message) + 1).find((next) => next.senderRole === "manager");
      const minutes = response ? minutesBetween(message.date, response.date) : null;
      return minutes === null ? [] : [minutes];
    });
    const firstClient = clientMessages[0] ?? null;
    const firstManagerAfterClient = firstClient
      ? sorted.slice(sorted.indexOf(firstClient) + 1).find((message) => message.senderRole === "manager") ?? null
      : managerMessages[0] ?? null;
    const firstResponseMinutes = firstClient && firstManagerAfterClient
      ? minutesBetween(firstClient.date, firstManagerAfterClient.date)
      : null;
    const isLead = hasAny(allText, [
      /заявк/i,
      /подбор/i,
      /подберите/i,
      /подар(ок|ка|ить)/i,
      /ищ[уе] (газет|журнал|издани)/i,
      /дата рож/i,
      /день рож/i,
      /нужн[аоы]? (газет|журнал|издани|подар)/i
    ]);
    const hasWhatsappTemplateError = hasAny(allText, [
      /system\s*wz/i,
      /whatsapp/i,
      /24-часов/i,
      /шаблон/i,
      /template/i,
      /failed|ошибк[аи] достав/i
    ]);
    const hasNormalFirstReply = firstManagerAfterClient !== null
      && firstManagerAfterClient.text.trim().length > 25
      && !hasWhatsappTemplateError;
    const hasConcretePrice = hasAny(managerText, [
      /\d{2,6}\s*(€|eur|евро|руб|₽|\$)/i,
      /(€|eur|евро|руб|₽|\$)\s*\d{2,6}/i,
      /итого\s+\d/i,
      /стоимост[ьи]\s+\d/i
    ]);
    const hasRecipientQualification = hasAny(managerText, [
      /кому/i,
      /получател/i,
      /для (мам|пап|муж|жен|дед|бабуш|сын|доч|коллег|друг)/i,
      /интерес/i,
      /увлека/i,
      /что .*нрав/i,
      /какой эффект/i
    ]);
    const hasDeliveryDeadlineQualification = hasAny(managerText, [
      /к какому числу/i,
      /когда .*нуж/i,
      /когда .*вруч/i,
      /город/i,
      /куда достав/i,
      /адрес достав/i,
      /срок достав/i
    ]);
    const hasVisualContent = hasAny(managerText, [
      /фото/i,
      /фотограф/i,
      /пример/i,
      /макет/i,
      /видео/i,
      /покаж/i,
      /прикреп/i,
      /обложк/i,
      /разворот/i
    ]);
    const hasRecommendation = hasAny(managerText, [
      /рекоменд/i,
      /я бы выбрал/i,
      /я бы выбрала/i,
      /лучше/i,
      /под ваш запрос/i,
      /подойдет|подойдёт/i,
      /оптимальн/i
    ]);
    const hasDirectClosing = hasAny(managerText, [
      /пришлите.*(имя|телефон|почт|email|адрес)/i,
      /оформ/i,
      /брониру/i,
      /перейти к оплат/i,
      /ссылк[ау] на оплат/i,
      /выставлю сч[её]т/i,
      /какой бронируем/i
    ]);
    const hasCheckoutMovement = hasDirectClosing || hasAny(allText, [
      /оплат/i,
      /ссылк[ау] на оплат/i,
      /сч[её]т/i,
      /номер заказ/i,
      /заказ .*оформ/i,
      /данные для заказ/i,
      /пришлите.*(имя|телефон|адрес)/i
    ]);
    const hasCatalogHandoff = hasAny(managerText, [
      /интернет-магазин/i,
      /на сайте/i,
      /самостоятельно/i,
      /ссылк[ау].*каталог/i,
      /посмотрите варианты/i
    ]);
    const isRespondingLead = isLead && clientMessages.length > 1 && managerMessages.length > 0;

    return {
      dialogId,
      messages: sorted,
      allText,
      clientMessages,
      managerMessages,
      responseTimes,
      firstResponseMinutes,
      isLead,
      isRespondingLead,
      hasNormalFirstReply,
      hasWhatsappTemplateError,
      hasConcretePrice,
      hasRecipientQualification,
      hasDeliveryDeadlineQualification,
      hasVisualContent,
      hasRecommendation,
      hasDirectClosing,
      hasCheckoutMovement,
      hasCatalogHandoff
    };
  });
}

function metric(name: string, value: number, unit: ConversationRopMetric["unit"], note: string): ConversationRopMetric {
  return { name, value, unit, note };
}

function correlation(
  dialogs: DialogForReport[],
  factor: string,
  predicate: (dialog: DialogForReport) => boolean,
  note: string
): ConversationRopCorrelation {
  const withFactor = dialogs.filter(predicate);
  const withoutFactor = dialogs.filter((dialog) => !predicate(dialog));
  const withFactorConversion = safeDiv(withFactor.filter((dialog) => dialog.hasCheckoutMovement).length, withFactor.length);
  const withoutFactorConversion = safeDiv(withoutFactor.filter((dialog) => dialog.hasCheckoutMovement).length, withoutFactor.length);

  return {
    factor,
    withFactorConversion,
    withoutFactorConversion,
    liftPp: withFactorConversion - withoutFactorConversion,
    dialogsWithFactor: withFactor.length,
    dialogsWithoutFactor: withoutFactor.length,
    note
  };
}

export function buildConversationRopReport(input: {
  periodKey: PeriodKey;
  messages: ConversationMessage[];
  generatedAt?: string;
}): ConversationRopReport {
  const dialogs = groupDialogs(input.messages);
  const leadDialogs = dialogs.filter((dialog) => dialog.isLead);
  const reportingDialogs = leadDialogs.length >= 20 ? leadDialogs : dialogs;
  const respondingLeadDialogs = reportingDialogs.filter((dialog) => dialog.isRespondingLead || dialog.managerMessages.length > 0);
  const responseTimes = reportingDialogs.flatMap((dialog) => dialog.responseTimes);
  const firstResponseTimes = reportingDialogs.flatMap((dialog) => dialog.firstResponseMinutes === null ? [] : [dialog.firstResponseMinutes]);
  const checkoutDialogs = reportingDialogs.filter((dialog) => dialog.hasCheckoutMovement);
  const noNormalFirstReplyShare = safeDiv(reportingDialogs.filter((dialog) => !dialog.hasNormalFirstReply).length, reportingDialogs.length);
  const whatsappErrorShare = safeDiv(reportingDialogs.filter((dialog) => dialog.hasWhatsappTemplateError).length, reportingDialogs.length);
  const over60Share = safeDiv(responseTimes.filter((minutes) => minutes >= 60).length, responseTimes.length);
  const under5Share = safeDiv(responseTimes.filter((minutes) => minutes <= 5).length, responseTimes.length);
  const noConcretePriceShare = safeDiv(respondingLeadDialogs.filter((dialog) => !dialog.hasConcretePrice).length, respondingLeadDialogs.length);
  const recipientQualificationShare = safeDiv(reportingDialogs.filter((dialog) => dialog.hasRecipientQualification).length, reportingDialogs.length);
  const deliveryDeadlineShare = safeDiv(reportingDialogs.filter((dialog) => dialog.hasDeliveryDeadlineQualification).length, reportingDialogs.length);
  const visualContentShare = safeDiv(reportingDialogs.filter((dialog) => dialog.hasVisualContent).length, reportingDialogs.length);
  const directClosingShare = safeDiv(reportingDialogs.filter((dialog) => dialog.hasDirectClosing).length, reportingDialogs.length);
  const recommendationShare = safeDiv(reportingDialogs.filter((dialog) => dialog.hasRecommendation).length, reportingDialogs.length);
  const catalogHandoffShare = safeDiv(reportingDialogs.filter((dialog) => dialog.hasCatalogHandoff).length, reportingDialogs.length);
  const checkoutMarkerShare = safeDiv(checkoutDialogs.length, reportingDialogs.length);

  const correlations = [
    correlation(
      reportingDialogs,
      "Квалификация получателя и интересов",
      (dialog) => dialog.hasRecipientQualification,
      "Показывает, насколько чаще диалог доходит до заказа/оплаты, когда менеджер выясняет, кому и зачем нужен подарок."
    ),
    correlation(
      reportingDialogs,
      "Фото, примеры или визуальные материалы",
      (dialog) => dialog.hasVisualContent,
      "Визуальное доказательство снижает неопределенность и обычно ускоряет выбор."
    ),
    correlation(
      reportingDialogs,
      "Первый ответ до 5 минут",
      (dialog) => (dialog.firstResponseMinutes ?? 9999) <= 5,
      "Сравнение быстрых первых ответов с остальными диалогами."
    ),
    correlation(
      reportingDialogs,
      "Цена названа в переписке",
      (dialog) => dialog.hasConcretePrice,
      "Цена вместе с предложением переводит подбор в конкретное решение, а не в бесконечную консультацию."
    )
  ].sort((a, b) => b.liftPp - a.liftPp);

  const metrics: ConversationRopMetric[] = [
    metric("Без нормального ответа на первый контакт", noNormalFirstReplyShare, "percent", "Доля лидов, где клиент не получил содержательный первый ответ менеджера."),
    metric("Ошибки WhatsApp-шаблонов", whatsappErrorShare, "percent", "Диалоги с признаками недоставленного или шаблонного WhatsApp-сообщения."),
    metric("Медиана ответа менеджера", median(responseTimes), "minutes", "Медианное время от сообщения клиента до ближайшего ответа менеджера."),
    metric("Ответы позже часа", over60Share, "percent", "Доля ответов менеджера после паузы 60 минут и более."),
    metric("Ответы до 5 минут", under5Share, "percent", "Доля быстрых ответов после сообщения клиента."),
    metric("Ответившие лиды без конкретной цены", noConcretePriceShare, "percent", "Лид ответил, но в переписке нет понятной цены или итоговой суммы."),
    metric("Квалификация получателя", recipientQualificationShare, "percent", "Менеджер выяснил, кому предназначен подарок и/или интересы человека."),
    metric("Квалификация срока и доставки", deliveryDeadlineShare, "percent", "Менеджер уточнил дату вручения, город или условия доставки."),
    metric("Визуальное подтверждение", visualContentShare, "percent", "Менеджер показал или предложил фото, пример, макет, видео, обложку или разворот."),
    metric("Конкретная рекомендация", recommendationShare, "percent", "Менеджер не просто перечислил варианты, а рекомендовал решение."),
    metric("Прямой переход к оформлению", directClosingShare, "percent", "В диалоге есть запрос данных, бронь, счет или ссылка на оплату."),
    metric("Движение к оплате", checkoutMarkerShare, "percent", "Прокси-конверсия: заказные данные, счет, бронь, ссылка или оплата."),
    metric("Передача в каталог/самостоятельный выбор", catalogHandoffShare, "percent", "Менеджер отправляет клиента самому разбираться на сайте или в каталоге.")
  ];

  return {
    periodKey: input.periodKey,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    analyzedMessages: input.messages.length,
    analyzedDialogs: dialogs.length,
    leadDialogs: reportingDialogs.length,
    respondingLeadDialogs: respondingLeadDialogs.length,
    caveat: "В переписках не всегда есть отдельное поле «продажа / отказ», поэтому для сравнения сценариев используется прокси движения к покупке: данные для заказа, счет, бронь, ссылка на оплату или подтверждение оплаты. Для финансовой конверсии эти признаки нужно сопоставлять с CRM.",
    mainProblem: "Менеджеры часто работают как консультанты архива, а не как продавцы подарочного решения: дают информацию и списки, но не ведут клиента к выбору, расчету и оплате.",
    typicalWeakScenario: [
      "Проверить дату и язык.",
      "Отправить длинный список газет или журналов.",
      "Спросить, какие варианты актуальны.",
      "Через паузу написать «продолжим подбор?»",
      "Отправить клиента самостоятельно смотреть сайт или каталог."
    ],
    metrics,
    correlations,
    hypotheses: [
      { title: "SLA ответа до 5 минут", current: `${roundPct(under5Share)}% быстрых ответов`, target: "80% ответов за первые 5 минут", expectedImpact: "+1–2 п.п. к конверсии за счет удержания горячих клиентов." },
      { title: "Квалификация получателя и повода", current: `${roundPct(recipientQualificationShare)}% диалогов`, target: "70%+ диалогов с вопросом кому, зачем и какой эффект нужен", expectedImpact: "+2–3 п.п. через более точные рекомендации." },
      { title: "Рекомендация вместо каталога", current: `${roundPct(recommendationShare)}% диалогов`, target: "Каждый лид получает 1 главный и 1 запасной вариант", expectedImpact: "Меньше брошенного выбора, выше движение к оформлению." },
      { title: "Цена и доставка сразу в предложении", current: `${roundPct(noConcretePriceShare)}% ответивших лидов без цены`, target: "90% предложений с ценой, доставкой, сроком и итогом", expectedImpact: "+2 п.п. за счет снятия неопределенности." },
      { title: "Фото или пример в каждом предложении", current: `${roundPct(visualContentShare)}% диалогов`, target: "70%+ предложений с визуальным подтверждением", expectedImpact: `Сейчас визуалы дают разницу ${pp(correlations.find((item) => item.factor.includes("Фото"))?.liftPp ?? 0)} по прокси-движению к покупке.` },
      { title: "Закрытие после сигнала интереса", current: `${roundPct(directClosingShare)}% диалогов`, target: "После «подходит/беру/как заказать» сразу запрос данных или ссылка на оплату", expectedImpact: "+1–2 п.п. за счет сокращения пути до оплаты." },
      { title: "Follow-up с новой ценностью", current: "Повторные касания часто выглядят как «актуально?»", target: "3 касания: рекомендация, полный расчет, честное снятие брони", expectedImpact: "Возвращает часть молчащих лидов без давления." },
      { title: "Контроль качества по менеджерам", current: "Качество видно только на уровне общего среза", target: "Воронка менеджера: ответил, квалифицировал, дал цену, показал фото, закрыл", expectedImpact: "Позволяет отделить слабые заявки от слабого сценария продажи." }
    ],
    executiveSummary: [
      `Проанализировано ${input.messages.length.toLocaleString("ru-RU")} сообщений в ${dialogs.length.toLocaleString("ru-RU")} диалогах.`,
      `Для управленческого сравнения выделено ${reportingDialogs.length.toLocaleString("ru-RU")} диалогов с признаками лида или весь доступный срез, если лидов мало.`,
      `Ключевой риск: ${roundPct(noConcretePriceShare)}% ответивших лидов не получают конкретную цену, а квалификация получателя есть только в ${roundPct(recipientQualificationShare)}% диалогов.`,
      `Лучшие корреляции с движением к оплате сейчас: ${correlations.slice(0, 2).map((item) => `${item.factor} (${pp(item.liftPp)})`).join("; ") || "пока мало данных"}.`
    ]
  };
}

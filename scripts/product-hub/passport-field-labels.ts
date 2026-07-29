/**
 * Human-readable labels for passport key/value tabs.
 * Technical `code` stays for sync; `label` + `why` explain the column to a non-technical reader.
 */

export type PassportFieldMeta = {
  /** Short Russian name (what the row is called). */
  label: string;
  /** What meaningful load this field carries — for whom / in what case to use it. */
  why: string;
};

/** Unified header for key/value passport tabs (Смыслы, Экономика, Производство, …). */
export const PASSPORT_KV_HEADER = [
  "Код",
  "Название",
  "Зачем это поле",
  "Содержание",
  "Примечание",
  "Источник",
] as const;

const META: Record<string, PassportFieldMeta> = {
  // Identity / sync
  product_id: {
    label: "ID продукта",
    why: "Служебный код продукта в системе. Нужен для синхронизации, не для разговора с клиентом.",
  },
  bitrix_name: {
    label: "Название в Bitrix",
    why: "Как продукт называется в CRM. Чтобы все говорили об одной и той же карточке заказа.",
  },
  source_tab: {
    label: "Вкладка-источник",
    why: "Откуда в книге смыслов взят этот блок. Для проверки и обновления текста.",
  },
  source_row: {
    label: "Строка-источник",
    why: "Номер строки в книге смыслов. Чтобы быстро найти оригинал формулировки.",
  },
  short_name: {
    label: "Короткое название",
    why: "Как продукт называют вслух и в материалах. Для менеджера и маркетинга.",
  },
  sources: {
    label: "Откуда собрано",
    why: "Список источников паспорта. Чтобы понимать, чему можно доверять.",
  },
  synced_at: {
    label: "Когда обновлено",
    why: "Дата последней автовыгрузки. Если данные старые — перезапустить sync.",
  },
  mapping_note: {
    label: "Важная оговорка по соответствию",
    why: "Когда название в книге смыслов и Bitrix не одно в одно. Читать до продажи.",
  },
  product_focus: {
    label: "Фокус этого паспорта",
    why: "Если training описывает линейку целиком — здесь уточнение, о каком формате речь.",
  },
  bitrix_note: {
    label: "Заметка по CRM",
    why: "Как продукт отражён в Bitrix/материалах. Для согласованности названий.",
  },
  sheet_note: {
    label: "Заметка по источникам",
    why: "Чего нет в книге смыслов и откуда тогда взяты формулировки.",
  },
  training_context_note: {
    label: "Как читать training ниже",
    why: "Поясняет, почему подтянут соседний training-текст и где граница формата.",
  },
  do_not_promise: {
    label: "Чего нельзя обещать",
    why: "Красные линии для менеджера. Чтобы не создавать ложных ожиданий у клиента.",
  },
  landing: {
    label: "Страница продукта",
    why: "Ссылка, куда отправить клиента посмотреть пример / оформить интерес.",
  },
  role_in_line: {
    label: "Роль в линейке",
    why: "Основной подарок или апселл. Понимать, когда предлагать первым, а когда допродавать.",
  },

  // Meanings framework
  what_it_is: {
    label: "Что это такое",
    why: "Простое объяснение продукта своими словами. Первая фраза для клиента и новичка в ОП.",
  },
  for_whom: {
    label: "Для кого",
    why: "Кому дарить / кто обычно покупает. Чтобы быстро понять, подходит ли запрос клиента.",
  },
  client_pain: {
    label: "Боль и потребность клиента",
    why: "Что болит у покупателя до покупки. Чтобы говорить на языке потребности, а не «про бумагу».",
  },
  key_idea: {
    label: "Ключевая идея",
    why: "Главный смысл продукта в одной мысли. Якорь для презентации и рекламы.",
  },
  why_now: {
    label: "Почему сейчас",
    why: "В каком случае и в какой момент это особенно уместно (праздник, дедлайн, сомнения).",
  },
  how_it_works: {
    label: "Как это работает",
    why: "Путь от заявки до готового подарка. Чтобы объяснить клиенту процесс и сроки.",
  },
  benefits: {
    label: "Главные выгоды для клиента",
    why: "Что получает покупатель и получатель сверх «вещи». Аргументы ценности.",
  },
  cost_from_sheet: {
    label: "Стоимость (из книги смыслов)",
    why: "Как стоимость зафиксирована в смысловой таблице. Может быть пусто — тогда смотри Экономику.",
  },
  genres: {
    label: "Доступные жанры",
    why: "Какие стили песни можно предложить клиенту при выборе.",
  },
  client_questions: {
    label: "Вопросы клиенту",
    why: "Чек-лист вопросов менеджера, чтобы собрать вводные для заказа песни.",
  },
  what_we_sell: {
    label: "Что мы на самом деле продаём",
    why: "Смысл сделки, не полиграфия. Чтобы менеджер не скатывался в «продаём бумагу».",
  },
  emotional_result: {
    label: "Эмоциональный результат",
    why: "Какую эмоцию должен получить именинник/гости. Цель подарка за столом.",
  },
  when_to_offer: {
    label: "В каком случае предлагать",
    why: "Триггерные фразы и ситуации клиента. Когда именно вытаскивать этот продукт.",
  },
  pitch_one_paragraph: {
    label: "Питч одним абзацем",
    why: "Готовый текст для объяснения клиенту в переписке или на звонке.",
  },
  pitch_short: {
    label: "Короткая формулировка",
    why: "Одна-две фразы для менеджера: быстро и в точку.",
  },
  compare_with: {
    label: "Чем отличается от соседних",
    why: "Чтобы не перепутать оригинал / репродукцию / персональное / поздравительное.",
  },
  objections: {
    label: "Возражения",
    why: "Типичные сомнения клиента и опора для ответа.",
  },
  long_form_story: {
    label: "Развёрнутый рассказ",
    why: "Полный текст для обучения и глубокого понимания продукта.",
  },
  composition: {
    label: "Из чего состоит",
    why: "Состав издания / услуги. Что входит в продукт «под ключ».",
  },
  volume_and_price: {
    label: "Объём и цена",
    why: "Минимальный объём, тариф и что входит в стоимость. Для честного разговора о деньгах.",
  },
  what_we_sell_detail: {
    label: "Что продаём (детально)",
    why: "Углублённая формулировка ценности из вторичного блока книги смыслов.",
  },
  emotional_result_detail: {
    label: "Эмоциональный результат (детально)",
    why: "Расширенное описание эмоции получателя.",
  },
  when_to_offer_detail: {
    label: "Когда предлагать (детально)",
    why: "Расширенный список ситуаций и фраз клиента.",
  },
  pricing_sense: {
    label: "Логика цены",
    why: "Как объясняется чек относительно ценности (не себестоимость).",
  },

  // Training dump
  training_product_id: {
    label: "ID в обучении",
    why: "Служебная связь с карточкой продукта в training.",
  },
  training_title: {
    label: "Название в обучении",
    why: "Как продукт назван в базе обучения менеджеров.",
  },
  training_short_description: {
    label: "Кратко (обучение)",
    why: "Короткое описание из training — для быстрого онбординга.",
  },
  training_description: {
    label: "Полное описание (обучение)",
    why: "Развёрнутый текст из biosystem/training. Читать целиком при изучении продукта.",
  },
  training_target_audience: {
    label: "Аудитория (обучение)",
    why: "Для кого продукт по версии training.",
  },
  training_client_problems: {
    label: "Проблемы клиента (обучение)",
    why: "Боли и запросы из training.",
  },
  training_emotions: {
    label: "Эмоции и выгоды (обучение)",
    why: "Эмоциональные аргументы из training.",
  },
  training_objections: {
    label: "Возражения (обучение)",
    why: "Возражения из training.",
  },
  training_presentation_guide: {
    label: "Как презентовать (обучение)",
    why: "Пошаговый гайд продажи/презентации из training.",
  },

  // Economy
  definition: {
    label: "Определение продукта",
    why: "Краткая экономическая/продуктовая идентичность рядом с ценой.",
  },
  retail_price: {
    label: "Цена для клиента",
    why: "Сколько платит покупатель (прайс), не себестоимость.",
  },
  currency: {
    label: "Валюта",
    why: "В какой валюте указана цена.",
  },
  cost_price: {
    label: "Себестоимость (COGS)",
    why: "Наши затраты на производство. Для маржи; клиенту не озвучивать как «цену».",
  },
  cogs_section: {
    label: "Блок себестоимости",
    why: "Секция COGS из финансовой модели. Править в мастер-таблице «Себестоимость по продуктам».",
  },
  cogs_source_title: {
    label: "Название в модели",
    why: "Как продукт назван в исходной «Маржинальности».",
  },
  cogs_total: {
    label: "COGS итого",
    why: "Суммарная себестоимость из модели маржинальности.",
  },
  cogs_retail_model: {
    label: "Retail модели",
    why: "Цена продажи из той же финансовой модели (может отличаться от Mint/Bitrix).",
  },
  cogs_margin_pct: {
    label: "Маржа, %",
    why: "Маржа по модели: (retail − COGS) / retail.",
  },
  cogs_note: {
    label: "Комментарий по COGS",
    why: "Оговорки финансов: расхождения моделей, что не суммировать.",
  },
  cogs_source_url: {
    label: "Таблица себестоимости",
    why: "Ссылка на мастер, где правят цифры.",
  },
  cogs_synced_at: {
    label: "COGS обновлено",
    why: "Когда себестоимость последний раз подтянули в паспорт.",
  },
  packaging_cost: {
    label: "Стоимость упаковки",
    why: "Отдельные затраты на упаковку, если считаем экономику детально.",
  },
  delivery_cost: {
    label: "Стоимость доставки",
    why: "Логистические затраты / тариф доставки.",
  },
  minimum_price: {
    label: "Минимальная цена",
    why: "Нижняя граница, ниже которой продавать нельзя (утверждает РОП/финансы).",
  },
  partner_price: {
    label: "Партнёрская цена",
    why: "Цена для партнёров/агентов, если сетка есть.",
  },
  urgent_price: {
    label: "Срочная надбавка",
    why: "Доплата за ускорение, если такой тариф утверждён.",
  },
  contribution_margin: {
    label: "Маржинальный вклад",
    why: "Прибыль после прямых затрат. Считается вручную из цены и себестоимости.",
  },
  status_note: {
    label: "Статус / блокер",
    why: "Что ещё не утверждено (цена, имя, процесс). Не фиксировать как факт.",
  },
  rule: {
    label: "Правило чтения цен",
    why: "Как правильно понимать цифры в этой вкладке (прайс vs себестоимость).",
  },
  mint_doc_url: {
    label: "Документ Mint",
    why: "Ссылка на исходный разбор производства и прайса.",
  },
  bitrix_product_id: {
    label: "ID товара в Bitrix",
    why: "Связь с карточкой в каталоге CRM.",
  },
  page_base: {
    label: "Базовый объём страниц",
    why: "С какого числа страниц считается базовый тариф журнала.",
  },
  extra_4_pages_price: {
    label: "Цена +4 страницы",
    why: "Сколько доплатить за каждые дополнительные 4 страницы.",
  },
  prepayment_pct: {
    label: "Предоплата, %",
    why: "Какой процент от базовой стоимости берут до старта работы.",
  },
  prepayment_amount_base: {
    label: "Сумма предоплаты (база)",
    why: "Деньги к оплате авансом при базовом объёме.",
  },
  extra_copies_price: {
    label: "Цена доп. экземпляров",
    why: "Сколько стоит каждый дополнительный печатный экземпляр.",
  },
  production_min_days: {
    label: "Мин. срок производства, дни",
    why: "Самый короткий реалистичный срок изготовления.",
  },
  production_recommended_weeks: {
    label: "Рекомендуемый срок, недели",
    why: "За сколько лучше принимать заказ до даты вручения.",
  },
  cost_benefit_section: {
    label: "Блок «выгоды ↔ цена»",
    why: "Маркер секции: здесь ценность для клиента рядом с ценовым якорем.",
  },
  client_benefits: {
    label: "Выгоды клиента",
    why: "За что клиент готов платить — список выгод рядом с ценой.",
  },
  cost_anchor: {
    label: "Ценовой якорь",
    why: "Ориентир по стоимости из смыслов/Mint. Для связки «сколько стоит ↔ что получает».",
  },
  value_vs_price: {
    label: "Ценность против цены",
    why: "Как объяснить, почему чек справедлив. Готовая логика для ОП.",
  },
  cost_benefit_source_url: {
    label: "Источник блока выгоды/цены",
    why: "Ссылка на книгу смыслов, откуда взят блок.",
  },
  cost_benefit_synced_at: {
    label: "Обновление блока выгоды/цены",
    why: "Когда последний раз подтянули cost–benefit.",
  },

  // Production
  product: {
    label: "Продукт",
    why: "Какой продукт описывает этот производственный процесс.",
  },
  process_start: {
    label: "Когда стартует процесс",
    why: "С какого момента команда начинает работу (обычно после оплаты).",
  },
  note: {
    label: "Заметка по производству",
    why: "Важные оговорки, исключения, риски по процессу.",
  },
};

function humanizeCode(code: string): string {
  return code
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/**
 * Resolve label/why for a field code.
 * Supports suffixes like `benefits__2`, `step_3`, `long_form_2`, `narrative_1`, `extra_block_1`.
 */
export function resolvePassportFieldMeta(code: string): PassportFieldMeta {
  const raw = String(code || "").trim();
  if (!raw) {
    return { label: "—", why: "Пустой код поля." };
  }

  if (META[raw]) return META[raw];

  const step = /^step_(\d+)$/i.exec(raw);
  if (step) {
    return {
      label: `Шаг ${step[1]}`,
      why: "Очередной этап производства. Читать по порядку, чтобы понимать цепочку до выдачи.",
    };
  }

  const dup = /^(.+?)__(\d+)$/.exec(raw);
  if (dup && META[dup[1]]) {
    const base = META[dup[1]];
    return {
      label: `${base.label} (доп. ${dup[2]})`,
      why: `${base.why} Дополнительная формулировка из другого блока источника.`,
    };
  }

  const longForm = /^long_form(?:_story)?(?:_(\d+))?$/i.exec(raw);
  if (longForm) {
    return {
      label: longForm[1] ? `Развёрнутый рассказ ${longForm[1]}` : "Развёрнутый рассказ",
      why: "Полный текст для обучения и глубокого понимания продукта.",
    };
  }

  const cogsLine = /^cogs_line_(\d+)$/i.exec(raw);
  if (cogsLine) {
    return {
      label: `Статья затрат ${cogsLine[1]}`,
      why: "Строка себестоимости (закупка, печать, конверт…). Править суммы в мастер-таблице.",
    };
  }

  const cogsNote = /^cogs_note_(\d+)$/i.exec(raw);
  if (cogsNote) {
    return {
      label: `Комментарий по COGS ${cogsNote[1]}`,
      why: "Доп. оговорка по себестоимости.",
    };
  }

  const narrative = /^narrative_(\d+)$/i.exec(raw);
  if (narrative) {
    return {
      label: `Доп. смысловой блок ${narrative[1]}`,
      why: "Дополнительный абзац из книги смыслов. Читать, если основного каркаса мало.",
    };
  }

  const extra = /^extra_block_(\d+)$/i.exec(raw);
  if (extra) {
    return {
      label: `Доп. блок ${extra[1]}`,
      why: "Дополнительный фрагмент из источника.",
    };
  }

  if (/^secondary_/i.test(raw)) {
    return {
      label: "Вторичный блок",
      why: "Доп. колонка из вторичной таблицы книги смыслов.",
    };
  }

  // Economy extras from mint often use free-form codes
  return {
    label: humanizeCode(raw),
    why: "Дополнительное поле паспорта. Смотри содержание и примечание.",
  };
}

/** Build one key/value sheet row with human columns. */
export function passportKvRow(
  code: string,
  content: string | number,
  source: string,
  note = "",
): Array<string | number> {
  const meta = resolvePassportFieldMeta(code);
  return [code, meta.label, meta.why, content, note, source];
}

export function passportKvRows(
  rows: Array<[string, string | number, string, string?]>,
): Array<Array<string | number>> {
  return [
    [...PASSPORT_KV_HEADER],
    ...rows.map((r) => passportKvRow(String(r[0]), r[1], String(r[2] ?? ""), String(r[3] ?? ""))),
  ];
}

/** Human headers for «Визуал» list table. */
export const VISUAL_TABLE_HEADER = [
  "ID источника",
  "Тип",
  "Название",
  "Описание",
  "Категория",
  "Ссылка",
  "Откуда в базе знаний",
  "Когда синхронизировано",
] as const;

export const VISUAL_TABLE_WHY_ROW = [
  "Служебный id",
  "Фото / видео / файл",
  "Как подписать визуал человеку",
  "Что на картинке и зачем показывать",
  "К какому продукту/теме относится",
  "Открыть пример",
  "client-materials или training",
  "Дата автовыгрузки",
] as const;

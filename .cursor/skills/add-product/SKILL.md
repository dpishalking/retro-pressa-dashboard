---
name: add-product
description: Adds or splits Retro Pressa products through the product hub (passport tab, training card, /cards, gifts, CRM matchers). Use when the user asks to add a product, new gift, новый продукт, новый товар, паспорт продукта, вкладку паспорта, карточку товара, /cards, training product, or to split two mixed products.
---

# Add Retro Pressa product

Единый центр — не кнопка в UI. Один продукт = паспорт + обучение + карточка + резолверы. Не закрывать задачу, пока не пройден чеклист.

## Do not invent

- Цены, COGS, сроки, Bitrix enum ID — только из брифа / Bitrix / модели маржинальности.
- Не копировать цену соседнего продукта.
- Не создавать новый Google-файл через service account (квота Drive = 0). Новые вкладки — в книге паспортов.
- Не смешивать два продукта в одном паспорте / одном training id.

## Hub IDs

| Что | Значение |
|-----|----------|
| Книга паспортов | `1NsVbsv2YZbehiYTtSP1Waf0gYf1nCnocszonQyppKAE` |
| Реестр | `scripts/product-hub/passport-registry.ts` |
| Живое обучение | `data/training/products.json` |
| Снимок `/products` | `data/product-passports/dashboard.json` |

`productId` = `PRODUCT_*`. Training id / card slug = kebab-case. Названия для людей — как скажет пользователь.

## Checklist

1. **Уточнить, что это отдельный продукт**, а не вариант существующего. Если клиент путает два смысла — два паспорта (как «Книга жизни» vs «в заголовках газет»).
2. **Мини-вкладка** в книге паспортов: seed в `scripts/product-hub/build-mini-passports.ts` (`NN_Имя`, `titleName`, `shortWhat`, цена только если известна, иначе `priceDisplay: "по запросу"`). Затем:
   `npx tsx --env-file=.env.local scripts/product-hub/build-mini-passports.ts`
3. **Полный паспорт (смыслы)**: либо отдельный spreadsheet (если пользователь дал файл и расшарил editor на `codex-pressa@…`), либо вкладки `NN_Смыслы` / `NN_Экономика` / `NN_Производство` / `NN_Визуал` в той же книге. Шаблон: `scripts/product-hub/create-life-story-passport.ts`.
4. **Реестр** `PASSPORT_REGISTRY`: `productId`, `bitrixName`, `spreadsheetId`, имена вкладок, `trainingProductId`. Если вкладки не стандартные «Смыслы» — задать `meaningsTabName`.
5. **План смыслов** в `scripts/product-hub/sync-passport-meanings.ts` (`PLANS`): `sheetNameIncludes` не должен перехватывать чужую строку (не матчить короткое имя, если оно уже занято соседним продуктом).
6. **Обучение**: объект в `data/training/products.json` **и** seed в `src/data/training-seed.ts`. Тесты: чем продукт **не** является. Cover — существующее фото, не сток, если своего нет.
7. **Карточка** `src/lib/product-cards/catalog.ts` + при необходимости `src/config/gifts-landing.ts`.
8. **База материалов** — категория в `src/components/training/client-materials.tsx` (`CLIENT_MATERIAL_CATEGORY_ORDER`). Файлы в `data/training/client-materials.json` только если пользователь дал ассеты.
9. **Резолверы** (чтобы CRM/маржа/обучение не склеивали продукты):
   - `src/lib/bitrix/gift-type-resolver.ts`
   - `src/lib/bitrix/smart-invoices.ts`
   - `src/lib/product-hub/sku-margin-catalog.ts` (`inferProductIdFromName`)
   - `src/lib/training/google-sheet-catalog.ts`
   - `src/lib/product-cards/gift-visual.ts`
   - `src/lib/partners/catalog-from-training.ts`
   - `src/lib/bitrix/metric-definitions.ts` `BITRIX_GIFT_TYPE_ENUM` — **только** если в Bitrix уже есть новый enum.
10. **Выгрузка на `/products`**:
    `npx tsx --env-file=.env.local scripts/product-hub/sync-passport-meanings.ts --product=PRODUCT_X`
    `npx tsx --env-file=.env.local scripts/product-hub/sync-passport-dashboard.ts`
11. Отдать пользователю ссылки: мини-вкладка + смыслы + `/products`.

## Surfaces (что появится где)

| Поверхность | Файл / URL |
|-------------|------------|
| Паспорт ОП | Google, книга паспортов / отдельный sheet |
| Каталог паспортов | `/products` ← `dashboard.json` |
| Обучение менеджеров | `/training` ← `products.json` |
| Публичные карточки | `/cards/[slug]` |
| Витрина подарков | `gifts-landing.ts` |
| Материалы клиенту | категория client-materials |
| Сделки Bitrix | резолверы имён, не выдуманный enum |

Knowledge-base FAQ (`data/training/knowledge-base.json`) — только явные Q&A от пользователя, не дублировать карточку продукта.

## After

Коммит релевантного кода **включая** `data/training/products.json` и `data/product-passports/dashboard.json` (это живой каталог, не снапшот CRM). Не коммитить `.env*`, остальные `data/**`. Push `origin main`.

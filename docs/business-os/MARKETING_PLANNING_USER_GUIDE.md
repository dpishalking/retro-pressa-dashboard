# Marketing Planning — User Guide

## Утром

1. Открой `20_Marketing_Planning`.
2. Смотри колонку **МЕС**: план / факт / прогноз.
3. Проверь статусы `NO_PLAN`, `BLOCKED_*`, `NOT_CONNECTED` — это не «ноль».

## Недели

- Неделя 1–5 = реальные даты месяца.
- Факт только до текущей/прошедшей недели.
- Будущие недели без факта.
- Недельный план есть только если он утверждён отдельно. Месячный план **не** делится поровну.

## Plan vs Forecast

- **План** — утверждённая цель из `02_Plan_Registry` (СВОД План/факт после проверки).
- **Прогноз** — run rate по факту на дату; не обещание и не план.
- Если плана нет — `NO_PLAN`, светофор не красит зелёным/красным.

## Paid / Organic

- Paid: `21_Paid_Planning` + строки Paid на общем листе.
- Organic: `22_Organic_Planning`.
- Meta / Google / Yandex API: **NOT_CONNECTED** — не выдуманные нули.

## Почему blocked

- Нет spend → CPL / CAC / ROAS пустые.
- Нет утверждённого плана → NO_PLAN.
- Funnel forecast без полных CR → BLOCKED.
- Нет Ads API → NOT_CONNECTED.

## Можно решать

- Где отстаёт поток (sessions → leads → payments).
- Где не хватает данных (DQ / Reconciliation).
- Какие методы в backlog подключать дальше.

## Нельзя решать на этих цифрах

- Автостоп кампаний.
- Budget changes без Ads API facts.
- «Органика бесплатная» без cost model.
- Смешивать GA4 lead events с CRM leads.

# Conversation Analytics Architecture

## Goal

Retro Pressa needs conversation analytics as a stable data product, not as a one-off upload screen. The system should:

- keep raw client conversations private and outside Git;
- build fast daily and monthly quality facts;
- show ROP-style conclusions for past months;
- connect dialogue quality with sales, traffic, and Growth Intelligence forecasts.

## Data Layers

### 1. Private Raw Archive

Location: `data/conversation-exports` on the server.

This folder stores monthly CSV/JSON exports and current-month Bitrix increments. It must be treated as private customer data and should not be committed to GitHub.

Canonical filenames:

- `retro-pressa-conversations-2026-05.csv`
- `retro-pressa-conversations-2026-06.csv`
- `retro-pressa-conversations-2026-07.csv`

JSON files can be used too. JSON is preferred when it preserves dialog/message structure better than CSV.

### 2. Parsed Messages

Parser: `src/lib/conversation-intelligence.ts`.

It normalizes raw exports into a common message shape:

- date;
- channel;
- dialog id;
- sender and role;
- text;
- manager;
- stage;
- outcome proxy;
- order amount;
- intent tags.

### 3. Aggregated Snapshots

Storage: `data/conversation-snapshots`.

Snapshots are small derived files for fast dashboard loading. They can be rebuilt from the private raw archive.

### 4. ROP Quality Report

Report builder: `src/lib/conversation-rop-report.ts`.

This layer computes management-level findings:

- first contact without a normal answer;
- WhatsApp template or delivery errors;
- median response speed;
- late answers;
- lack of concrete price;
- recipient qualification;
- delivery/deadline qualification;
- visual proof;
- recommendation;
- direct close;
- movement to payment;
- correlations between quality actions and checkout markers.

The report uses checkout/payment movement markers as a proxy when the export does not contain a reliable sale/refusal field. CRM sales data should still be used for final financial conversion.

## Daily Flow

Every morning GitHub Actions calls `/api/rop/daily-sync`.

The endpoint:

1. refreshes Bitrix sales facts;
2. refreshes Google traffic facts;
3. imports the last 3 days of Bitrix conversations;
4. deduplicates messages into the current month live store;
5. rebuilds the conversation dashboard and quality report.

The default current setting is a 3-day lookback and 250 dialogs per run. This protects against missed dialogs without duplicating old messages.

## Monthly Flow

For closed months, upload the month export once:

1. open `Инструменты РОП -> Анализ переписок`;
2. choose the period;
3. upload the May, June, or July file with the matching button;
4. the server saves the raw file privately and builds the aggregate snapshot.

After that, the ROP report is rebuilt from the saved private archive.

## Growth Intelligence Link

Growth Intelligence should not only use advertising and sales metrics. It should also consume monthly dialogue-quality indicators:

- response under 5 minutes;
- response over 60 minutes;
- recipient qualification;
- recommendation;
- visual proof;
- concrete price;
- delivery and deadline answer;
- full calculation;
- direct close;
- checkout/payment movement.

Examples:

- if the share of dialogs without a concrete gift recommendation grows, forecast order conversion risk;
- if delivery questions grow while full delivery answers fall, show risk of lost revenue;
- if paid leads grow but recipient qualification falls, flag that traffic growth may not convert into paid orders.

## Privacy Rule

Raw conversation files are customer data. Do not commit them to GitHub. Commit only code, schemas, aggregate snapshots when safe, and documentation.

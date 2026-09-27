import assert from "node:assert/strict";
import { answersFromComment, formatLandingLeadAlert } from "../lib/landing-lead-alerts/format";
import { matchLanding, pageUrlFromLead, WATCHED_LANDINGS } from "../lib/landing-lead-alerts/landings";
import { rememberIds } from "../lib/landing-lead-alerts/state";
import { DEFAULT_LANDING_LEAD_ALERT_CHAT_ID, telegramAlertConfig } from "../lib/landing-lead-alerts/run";

const life = WATCHED_LANDINGS[0]!;
const architecture = WATCHED_LANDINGS[1]!;

assert.equal(
  matchLanding(
    {
      sourceId: "UC_LFHIST",
      sourceDescription: "https://giftboost.website/lifehistory",
      title: "Заявка с сайта — сохранить историю близких",
      utmCampaign: "27_08 | lifehistory LAND"
    },
    WATCHED_LANDINGS
  )?.id,
  "lifehistory"
);

assert.equal(
  matchLanding(
    {
      sourceId: "WEB",
      sourceDescription: "https://retro-pressa.com/ru",
      title: "Заявка с сайта|retro pressa",
      utmCampaign: "18_08 | new_old RetroPressa - lead"
    },
    WATCHED_LANDINGS
  ),
  null
);

assert.equal(
  matchLanding(
    {
      sourceId: "UC_ARCHITECTURE",
      sourceDescription: "architecture / architecture-form",
      title: "Что подарить?",
      utmCampaign: "22_09 | make present | LAND"
    },
    WATCHED_LANDINGS
  )?.id,
  "architecture"
);

assert.equal(
  matchLanding(
    {
      sourceId: "UC_LTRGB",
      sourceDescription: "https://giftboost.website/letter",
      title: "Я родился — заявка на открытку",
      utmCampaign: "18_08 | pismo malish LEAD"
    },
    WATCHED_LANDINGS
  )?.id,
  "letter"
);

assert.equal(
  matchLanding(
    {
      sourceId: "UC_GIFT2MAN",
      sourceDescription: "gift2men / hero",
      title: "Журнал для мужчины",
      utmCampaign: "20_07 | present for MEN"
    },
    WATCHED_LANDINGS
  )?.id,
  "gift2man"
);

assert.equal(
  matchLanding(
    {
      sourceId: "UC_GIFT4MAN",
      sourceDescription: "https://familia-studio.com/gift_for_man",
      title: "Подарок мужчине",
      utmCampaign: ""
    },
    WATCHED_LANDINGS
  ),
  null
);

assert.equal(pageUrlFromLead(life, "https://giftboost.website/lifehistory"), "https://giftboost.website/lifehistory");
assert.equal(pageUrlFromLead(architecture, "architecture / architecture-form"), architecture.pageUrl);

const answers = answersFromComment(
  "Для кого хотят сохранить историю: Мама\nEmail: hidden@example.com\nfbclid: IwZsecret\nUTM Source: facebook"
);
assert.equal(answers, "Для кого хотят сохранить историю: Мама");

const text = formatLandingLeadAlert({
  landingLabel: "Life History",
  pageUrl: "https://giftboost.website/lifehistory",
  id: "149570",
  title: "Заявка с сайта — сохранить историю близких",
  name: "Liudmila Simpson",
  createdAt: "2026-09-27T10:03:49+03:00",
  statusName: "Новый лид / New lead",
  comment: "Для кого хотят сохранить историю: Мама\nfbclid: secret",
  phone: "+35679858569",
  email: "simpsonmalta@gmail.com",
  utmSource: "facebook",
  utmMedium: "paid_social",
  utmCampaign: "27_08 | lifehistory LAND",
  utmContent: "27_08 | lifehistory LAND",
  utmTerm: "Facebook_Mobile_Feed",
  assignedName: "Tehniskais Akkaunt",
  repeat: false
});

assert.match(text, /Life History — новый лид/);
assert.match(text, /Liudmila Simpson/);
assert.match(text, /Повтор: нет/);
assert.match(text, /Для кого хотят сохранить историю: Мама/);
assert.doesNotMatch(text, /fbclid/);
assert.match(text, /Кампания: 27_08 \| lifehistory LAND/);
assert.doesNotMatch(text, /Объявление:/);

assert.deepEqual(rememberIds(["1", "2"], ["2", "3"]), ["1", "2", "3"]);

assert.deepEqual(
  telegramAlertConfig({
    LANDING_LEAD_ALERT_BOT_TOKEN: "token",
    LANDING_LEAD_ALERT_CHAT_IDS: "10, 20",
    ADMIN_TELEGRAM_IDS: "99"
  }),
  { token: "token", chatIds: ["10", "20"] }
);

assert.deepEqual(
  telegramAlertConfig({
    TRAINER_BOT_TOKEN: "trainer",
    ADMIN_TELEGRAM_IDS: "99"
  }),
  { token: "trainer", chatIds: [DEFAULT_LANDING_LEAD_ALERT_CHAT_ID] }
);

assert.equal(DEFAULT_LANDING_LEAD_ALERT_CHAT_ID, "223071474");

console.log("landing lead alerts ok");

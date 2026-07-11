import { auditUtmTags, campaignsMatch, isCompliantUtmPair, normalizeCampaignSlug } from "@/lib/utm-standards";

if (!isCompliantUtmPair("facebook", "paid_social")) throw new Error("facebook/paid_social should be compliant");
if (isCompliantUtmPair("ig", "paid")) throw new Error("ig/paid should not be compliant");
if (normalizeCampaignSlug("2026_07_gift_lv") !== "2026_07_gift_lv") throw new Error("campaign slug failed");
if (!campaignsMatch("2026_07_gift_lv", "2026 07 gift lv")) throw new Error("campaign match failed");

const issues = auditUtmTags({ utm_source: "ig", utm_medium: "paid", utm_campaign: "test" });
if (!issues.some((issue) => issue.code === "bad_source")) throw new Error("bad source audit failed");

console.log("utm-standards tests passed");

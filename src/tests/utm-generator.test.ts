import { buildUtmUrl, campaignNameSuggestion, predictGa4Channel, slugifyUtmValue, validateUtmParams } from "@/lib/utm-generator";

const url = buildUtmUrl("retro-pressa.com/lv", {
  utm_source: "Facebook Ads",
  utm_medium: "paid_social",
  utm_campaign: "July Gift LV",
  utm_content: "Video 01",
  utm_term: "LV"
});

if (!url.includes("utm_source=facebook")) throw new Error("source slug failed");
if (!url.includes("utm_campaign=july_gift_lv")) throw new Error("campaign slug failed");
if (!url.includes("utm_content=video_01")) throw new Error("content slug failed");
if (!url.includes("utm_term=lv")) throw new Error("term slug failed");

if (slugifyUtmValue("  Hello World! ") !== "hello_world") throw new Error("slugify failed");
if (predictGa4Channel("facebook", "paid_social") !== "Paid Social") throw new Error("channel prediction failed");
if (!campaignNameSuggestion("lv", "gift").includes("_gift_lv")) throw new Error("campaign suggestion failed");

const issues = validateUtmParams("", { utm_source: "facebook", utm_medium: "paid_social", utm_campaign: "test" });
if (!issues.some((issue) => issue.level === "error")) throw new Error("validation should fail without base url");

console.log("utm-generator tests passed", url);

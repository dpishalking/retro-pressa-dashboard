import assert from "node:assert/strict";
import { conversationIntelligenceDemo, monthlyMetrics, targetScenario } from "@/data/demo-data";
import { classifyMessage, importAndAnalyzeConversations } from "@/lib/conversation-intelligence";
import { averageInvoice, averagePaidCheck, cashRoas, dailyPlan, invoiceConversion, invoiceRoas, paidCpl, revenuePerLead, revenuePlanCompletion, salesConversion, scenarioForecast, totalLeads } from "@/lib/metrics-engine";

const june = monthlyMetrics[1];

const near = (actual: number, expected: number, tolerance = 0.01) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
};

assert.equal(totalLeads(june), 2710);
near(salesConversion(june) * 100, 16.75, 0.01);
near(invoiceConversion(june) * 100, 16.97, 0.01);
near(averageInvoice(june), 89.91, 0.01);
near(averagePaidCheck(june), 74.85, 0.01);
near(paidCpl(june), 2.01, 0.01);
near(cashRoas(june) * 100, 747.16, 0.05);
near(invoiceRoas(june) * 100, 909.41, 0.05);
near(revenuePerLead(june), 12.54, 0.01);
near(revenuePlanCompletion(33981, 100000), 0.33981, 0.00001);

const forecast = scenarioForecast(targetScenario);
assert.equal(forecast.sales, 1260);
assert.equal(forecast.revenue, 100800);

const day = dailyPlan(targetScenario, [], 0);
assert.equal(day.todayLeadsPlan, 150);
assert.equal(day.todaySalesPlan, 42);

const intents = classifyMessage("Сколько стоит доставка и можно ссылку на оплату?");
assert.ok(intents.includes("price_question"));
assert.ok(intents.includes("delivery_question"));
assert.ok(intents.includes("payment_transition"));

const imported = importAndAnalyzeConversations([
  {
    filename: "dialogs.csv",
    content: `date,channel,dialog_id,sender,manager,text,outcome,amount
2026-06-01T10:00:00,Instagram,1,client,Анна,"Посоветуйте подарок на день рождения",,
2026-06-01T10:03:00,Instagram,1,Анна,Анна,"Рекомендую конкретный комплект, итого 80 евро с доставкой",invoice,80
2026-06-01T10:05:00,Instagram,1,client,Анна,"Оплачиваю",order,80`
  }
]);
assert.equal(imported.messages.length, 3);
assert.equal(imported.dialogs.length, 1);
assert.equal(imported.dashboard.totalDialogs, 1);
assert.equal(imported.dashboard.orderConversion, 1);
assert.ok(conversationIntelligenceDemo.dashboard.totalDialogs >= 4);
assert.ok(conversationIntelligenceDemo.dashboard.factors.length > 0);

console.log("metrics-engine tests passed");

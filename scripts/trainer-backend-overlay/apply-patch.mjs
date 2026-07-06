import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const giftAiRoot = process.argv[2];
if (!giftAiRoot) {
  console.error("Usage: node apply-patch.mjs /path/to/gift-ai");
  process.exit(1);
}

const overlayDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(giftAiRoot, "backend");
const botRoot = path.join(giftAiRoot, "trainer-bot");
const routesFile = path.join(backendRoot, "src/api/trainer-routes.ts");
const geminiProviderFile = path.join(backendRoot, "src/llm/gemini-provider.ts");
const geminiIntegrationFile = path.join(backendRoot, "src/integrations/ai/gemini.ts");
const trainingServiceFile = path.join(backendRoot, "src/training/training-service.ts");
const botIndexFile = path.join(botRoot, "src/index.ts");

function patchManagerSessions() {
  fs.copyFileSync(
    path.join(overlayDir, "manager-sessions.ts"),
    path.join(backendRoot, "src/training/manager-sessions.ts")
  );

  let routes = fs.readFileSync(routesFile, "utf8");

  if (!routes.includes("getManagerTrainingSessions")) {
    routes = routes.replace(
      '  listManagers,\n} from "../training/manager-service.js";',
      '  listManagers,\n} from "../training/manager-service.js";\nimport { getManagerTrainingSessions } from "../training/manager-sessions.js";'
    );
  }

  const routeBlock = `
trainerRouter.get("/managers/:externalId/sessions", async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "unauthorized" }, 401);

  try {
    const externalId = c.req.param("externalId");
    const sessions = getManagerTrainingSessions(externalId);
    return c.json({ sessions });
  } catch (e) {
    logger.error("get manager sessions error", { error: String(e) });
    return c.json({ error: String(e) }, 500);
  }
});
`;

  if (!routes.includes('"/managers/:externalId/sessions"')) {
    routes = routes.replace(
      `trainerRouter.get("/managers/:externalId/practice", (c) => {
  const externalId = c.req.param("externalId");
  const fullName = c.req.query("name")?.trim();
  const serviceTag = c.req.query("service") ?? undefined;

  const links = fullName
    ? ensureManagerPracticeLinks({ externalId, fullName, serviceTag })
    : getManagerPracticeLinks(externalId);

  if (!links) return c.json({ error: "Manager not found" }, 404);
  return c.json(links);
});`,
      `trainerRouter.get("/managers/:externalId/practice", (c) => {
  const externalId = c.req.param("externalId");
  const fullName = c.req.query("name")?.trim();
  const serviceTag = c.req.query("service") ?? undefined;

  const links = fullName
    ? ensureManagerPracticeLinks({ externalId, fullName, serviceTag })
    : getManagerPracticeLinks(externalId);

  if (!links) return c.json({ error: "Manager not found" }, 404);
  return c.json(links);
});
${routeBlock}`
    );
  }

  fs.writeFileSync(routesFile, routes);
}

function patchScenarioTemplates() {
  const patch = path.join(overlayDir, "patches", "scenario-templates.ts");
  if (!fs.existsSync(patch)) return;
  fs.copyFileSync(patch, path.join(backendRoot, "src/training/scenario-templates.ts"));
}

function patchGeminiEvaluationFix() {
  const geminiPatch = path.join(overlayDir, "patches", "gemini.ts");
  const providerPatch = path.join(overlayDir, "patches", "gemini-provider.ts");
  if (!fs.existsSync(geminiPatch) || !fs.existsSync(providerPatch)) return;

  const currentProvider = fs.readFileSync(geminiProviderFile, "utf8");
  if (
    currentProvider.includes("evaluateSession attempt failed") &&
    currentProvider.includes("generateLiveScenario")
  ) {
    return;
  }

  fs.copyFileSync(geminiPatch, geminiIntegrationFile);
  fs.copyFileSync(providerPatch, geminiProviderFile);
}

function patchGeminiClientReplyRetries() {
  let source = fs.readFileSync(geminiProviderFile, "utf8");
  const marker = "async generateClientReply(opts: GenerateClientReplyOpts): Promise<string>";
  if (source.includes("generateClientReply attempt failed")) {
    return;
  }

  source = source.replace(
    `    const user = formatHistory(history);

    const result = await callGemini({ system, user, json: false });
    return result.text.trim();
  }`,
    `    const user = formatHistory(history);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await callGemini({ system, user, json: false });
        const text = result.text.trim();
        if (text) return text;
      } catch (e) {
        logger.warn("generateClientReply attempt failed", { attempt, error: String(e) });
        if (attempt === 2) throw e;
      }
    }

    throw new Error("Gemini returned empty client reply");
  }`
  );

  fs.writeFileSync(geminiProviderFile, source);
}

function patchTrainingServiceFallbackReply() {
  let source = fs.readFileSync(trainingServiceFile, "utf8");
  if (source.includes("buildFallbackClientReply")) {
    return;
  }

  source = source.replace(
    `export async function processEmployeeMessage(
  sessionId: string,
  employeeText: string,
): Promise<ProcessMessageResult> {`,
    `function buildFallbackClientReply(employeeText: string): string {
  return "Понял вас. Давайте уточним: подарок нужен к какой дате и для кого именно? Хочу предложить формат, который лучше подойдёт.";
}

export async function processEmployeeMessage(
  sessionId: string,
  employeeText: string,
): Promise<ProcessMessageResult> {`
  );

  source = source.replace(
    `  // Generate client reply
  const clientReply = await llm.generateClientReply({
    scenario,
    history: [...history, { author: "employee", text: employeeText }],
    clientState: newState,
    lastManagerAction: classified,
    revealedFacts: newRevealedFacts,
  });`,
    `  // Generate client reply
  let clientReply: string;
  try {
    clientReply = await llm.generateClientReply({
      scenario,
      history: [...history, { author: "employee", text: employeeText }],
      clientState: newState,
      lastManagerAction: classified,
      revealedFacts: newRevealedFacts,
    });
  } catch (e) {
    logger.warn("generateClientReply failed, using fallback reply", { sessionId, error: String(e) });
    clientReply = buildFallbackClientReply(employeeText);
  }`
  );

  fs.writeFileSync(trainingServiceFile, source);
}

function patchTrainerBotErrors() {
  if (!fs.existsSync(botIndexFile)) return;

  let source = fs.readFileSync(botIndexFile, "utf8");
  if (source.includes("GEMINI_API_KEY")) {
    return;
  }

  source = source.replace(
    `    } catch (e) {
      console.error("[in session message]", e);
      const msg = e instanceof Error ? e.message : "";
      if (/timeout|503|429/i.test(msg)) {
        await ctx.reply("AI временно перегружен. Подождите 10 секунд и отправьте сообщение ещё раз.");
      } else {
        await ctx.reply("Не удалось обработать сообщение. Попробуйте ещё раз.");
      }
    }`,
    `    } catch (e) {
      console.error("[in session message]", e);
      const msg = e instanceof Error ? e.message : String(e);
      if (/GEMINI_API_KEY|не настроен/i.test(msg)) {
        await ctx.reply("Сервис AI не настроен на сервере. Сообщите администратору: нужен GEMINI_API_KEY.");
      } else if (/timeout|503|429/i.test(msg)) {
        await ctx.reply("AI временно перегружен. Подождите 10 секунд и отправьте сообщение ещё раз.");
      } else if (/404|Session not found/i.test(msg)) {
        await ctx.reply("Сессия тренировки завершилась. Нажмите /train и начните сценарий заново.");
      } else {
        await ctx.reply("Не удалось обработать сообщение. Попробуйте ещё раз через несколько секунд.");
      }
    }`
  );

  fs.writeFileSync(botIndexFile, source);
}

function patchBackendBuildPrompts() {
  const packageFile = path.join(backendRoot, "package.json");
  const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"));
  const build = String(pkg.scripts?.build ?? "");
  if (build.includes("dist/llm/prompts")) return;
  pkg.scripts.build = 'tsc && cp -R src/llm/prompts dist/llm/prompts';
  fs.writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);
}

patchManagerSessions();
patchBackendBuildPrompts();
patchScenarioTemplates();
patchGeminiEvaluationFix();
patchGeminiClientReplyRetries();
patchTrainingServiceFallbackReply();
patchTrainerBotErrors();
console.log("Trainer overlay applied");

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = process.argv[2];
if (!backendRoot) {
  console.error("Usage: node apply-patch.mjs /path/to/gift-ai/backend");
  process.exit(1);
}

const overlayDir = path.dirname(fileURLToPath(import.meta.url));
const targetService = path.join(backendRoot, "src/training/manager-sessions.ts");
const routesFile = path.join(backendRoot, "src/api/trainer-routes.ts");

fs.copyFileSync(path.join(overlayDir, "manager-sessions.ts"), targetService);

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
console.log("Trainer backend overlay applied");

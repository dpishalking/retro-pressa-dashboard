#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const FOLDER_ID = "14tKmcYa2bklT84Z4pAchdr_ZN3YhW3W_";
const LOCAL_DIR = path.join(
  process.cwd(),
  "data/tmp/drive-product-photos/06 Персонализированный журнал",
);
const FILES = [
  "forbes-vitaliy.png",
  "glamour-tatyana.png",
  "zhl-elena.png",
  "zhenschina-goda-marina.png",
  "forbes-maksim.png",
  "muzhchina-goda-igor.png",
  "forbes-adlet.png",
];

function readServiceAccount() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\n/g, "\n")
    .trim();
  if (!email || !privateKey) throw new Error("service account not configured");
  return { email, privateKey };
}

async function getAccessToken() {
  const { email, privateKey } = readServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(privateKey).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.access_token;
}

async function listChildren(token, parentId) {
  const q = `'${parentId}' in parents and trashed = false`;
  const url =
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}` +
    `&fields=files(id,name,mimeType)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.files || [];
}

async function updateContent(token, fileId, filePath) {
  const buf = fs.readFileSync(filePath);
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&supportsAllDrives=true`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "image/png",
      },
      body: buf,
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 300));
  return JSON.parse(text);
}

async function uploadNew(token, parentId, filePath) {
  const name = path.basename(filePath);
  const buf = fs.readFileSync(filePath);
  const metadata = JSON.stringify({ name, parents: [parentId] });
  const boundary = `b_${crypto.randomBytes(8).toString("hex")}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: image/png\r\n\r\n`,
    ),
    buf,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function main() {
  const token = await getAccessToken();
  const existing = await listChildren(token, FOLDER_ID);
  const byName = new Map(existing.map((f) => [f.name, f]));
  for (const file of FILES) {
    const local = path.join(LOCAL_DIR, file);
    if (!fs.existsSync(local)) {
      console.log(`SKIP ${file}`);
      continue;
    }
    const prev = byName.get(file);
    if (prev && prev.mimeType !== "application/vnd.google-apps.folder") {
      try {
        await updateContent(token, prev.id, local);
        console.log(`updated  ${file}  ${prev.id}`);
        continue;
      } catch (e) {
        console.log(`update failed ${file}: ${e.message} — trying new upload`);
      }
    }
    const altName = `3d-${file}`;
    if (byName.has(altName)) {
      await updateContent(token, byName.get(altName).id, local);
      console.log(`updated  ${altName}`);
    } else {
      const created = await uploadNew(token, FOLDER_ID, local);
      // rename via patch
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${created.id}?supportsAllDrives=true`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ name: altName }),
        },
      );
      console.log(`uploaded ${altName}  ${created.id}`);
    }
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

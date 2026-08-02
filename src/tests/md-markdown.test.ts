import assert from "node:assert/strict";
import { markdownToHtml } from "@/lib/md/markdown";

const html = markdownToHtml(`# Title

**Bold** and \`code\`

* one
* two

---

[Link](https://rp-bi.site/motivation)
`);

assert.ok(html.includes("<h1>Title</h1>"));
assert.ok(html.includes("<strong>Bold</strong>"));
assert.ok(html.includes("<code>code</code>"));
assert.ok(html.includes("<ul>"));
assert.ok(html.includes("<li>one</li>"));
assert.ok(html.includes("<hr />"));
assert.ok(html.includes('href="https://rp-bi.site/motivation"'));
assert.ok(!html.includes("<script"));

console.log("md-markdown tests passed");

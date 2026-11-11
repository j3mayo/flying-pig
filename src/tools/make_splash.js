// iOS launch images for the home-screen app: the first frame of the in-app launch animation
// (the H on the app background), one PNG per iPhone screen. Run from the repo root:
//   node src/tools/make_splash.js
// Writes splash/<w>x<h>.png and prints the <link> tags port.py embeds (it reads SPLASH below).
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "../..");
const SPLASH = require("./splash_sizes.json");
const html = fs.readFileSync(path.join(ROOT, "src/coach/flying-pig.html"), "utf8");
const svg = html.match(/<div class="spl"[^>]*>(<svg[\s\S]*?<\/svg>)<\/div>/)[1].replace(/<path class="pl"[^>]*\/>/, "");
const bg = html.match(/--bg:(#[0-9A-Fa-f]{6})/)[1];
(async () => {
  const b = await chromium.launch();
  fs.mkdirSync(path.join(ROOT, "splash"), { recursive: true });
  for (const [w, h, dpr] of SPLASH) {
    const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    await pg.setContent(`<body style="margin:0;background:${bg};display:flex;align-items:center;justify-content:center;height:100vh">${svg.replace("<svg", '<svg style="width:112px;height:112px"')}</body>`);
    await pg.screenshot({ path: path.join(ROOT, "splash", `${w * dpr}x${h * dpr}.png`) });
    await pg.close();
  }
  await b.close();
  console.log("wrote", SPLASH.length, "launch images");
})();

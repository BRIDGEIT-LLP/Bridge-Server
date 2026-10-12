const sharp = require("sharp");
const mammoth = require("mammoth");
const XLSX = require("xlsx");
const JSZip = require("jszip");
const { PDFDocument, rgb, degrees } = require("pdf-lib");

const EXCEL_PREVIEW_MAX_SHEETS = 20;
const EXCEL_PREVIEW_MAX_ROWS = 200;
const EXCEL_PREVIEW_MAX_COLS = 40;
const EXCEL_MIN_ROWS = 25;
const EXCEL_MIN_COLS = 12;
const PPTX_PREVIEW_MAX_SLIDES = 40;

function escapeHtml(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function wrapWatermarkedHtml(bodyHtml, watermarkText, extraCss = "", bodyClass = "", allowScripts = false) {
    const safeWm = escapeHtml(watermarkText);
    const svg = encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">` +
        `<text x="24" y="120" fill="#b3b3b3" fill-opacity="0.7" font-size="16" font-family="sans-serif" transform="rotate(-45 24 120)">${safeWm}</text>` +
        `</svg>`
    );
    const scriptCsp = allowScripts ? "'unsafe-inline'" : "'none'";

    return Buffer.from(
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src ${scriptCsp};" />
  <style>
    html, body { margin: 0; background: #fff; }
    body {
      font-family: Calibri, Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #222;
      padding: 32px 40px 64px;
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 9999;
      background-image: url("data:image/svg+xml,${svg}");
      background-repeat: repeat;
    }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; }
    td, th { border: 1px solid #cfcfcf; padding: 4px 8px; }
    p { margin: 0 0 8px; }
    ${extraCss}
  </style>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>${bodyHtml}</body>
</html>`,
        "utf8"
    );
}

/**
 * Convert a .docx buffer to a self-contained HTML preview with a repeating
 * watermark overlay (same viewer stamp used on PDFs/images). Browsers cannot
 * render Word bytes inline, so file-preview returns this HTML instead.
 */
async function docxToWatermarkedHtml(docxBuffer, watermarkText) {
    const { value: bodyHtml } = await mammoth.convertToHtml({ buffer: docxBuffer });
    return wrapWatermarkedHtml(bodyHtml, watermarkText);
}

function cellDisplay(cell) {
    if (!cell) return "";
    if (cell.w != null && cell.w !== "") return String(cell.w);
    if (cell.t === "b") return cell.v ? "TRUE" : "FALSE";
    if (cell.v instanceof Date) return cell.v.toISOString().slice(0, 10);
    if (cell.v == null) return "";
    return String(cell.v);
}

function colWidthPx(sheet, colIndex) {
    const col = (sheet["!cols"] || [])[colIndex];
    const chars = col && (col.wch || col.width);
    if (!chars) return 72;
    return Math.max(48, Math.min(280, Math.round(Number(chars) * 8)));
}

function mergeLookup(sheet, range) {
    const origin = new Map();
    const skip = new Set();
    for (const merge of sheet["!merges"] || []) {
        const sr = Math.max(merge.s.r, range.s.r);
        const sc = Math.max(merge.s.c, range.s.c);
        const er = Math.min(merge.e.r, range.e.r);
        const ec = Math.min(merge.e.c, range.e.c);
        if (sr > er || sc > ec) continue;
        origin.set(`${sr},${sc}`, {
            rowspan: er - sr + 1,
            colspan: ec - sc + 1
        });
        for (let r = sr; r <= er; r++) {
            for (let c = sc; c <= ec; c++) {
                if (r !== sr || c !== sc) skip.add(`${r},${c}`);
            }
        }
    }
    return { origin, skip };
}

/** Build one worksheet as an Excel-like grid (A/B/C headers, numbered rows). */
function sheetToExcelGrid(sheet) {
    const used = sheet && sheet["!ref"]
        ? XLSX.utils.decode_range(sheet["!ref"])
        : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };

    const range = {
        s: { r: 0, c: 0 },
        e: {
            r: Math.min(Math.max(used.e.r, EXCEL_MIN_ROWS - 1), EXCEL_PREVIEW_MAX_ROWS - 1),
            c: Math.min(Math.max(used.e.c, EXCEL_MIN_COLS - 1), EXCEL_PREVIEW_MAX_COLS - 1)
        }
    };

    const { origin, skip } = mergeLookup(sheet || {}, range);
    const cols = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
        cols.push(`<col style="width:${colWidthPx(sheet || {}, c)}px" />`);
    }

    const headCells = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
        headCells.push(`<th class="xl-col">${escapeHtml(XLSX.utils.encode_col(c))}</th>`);
    }

    const bodyRows = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
        const cells = [`<th class="xl-row">${r + 1}</th>`];
        for (let c = range.s.c; c <= range.e.c; c++) {
            const key = `${r},${c}`;
            if (skip.has(key)) continue;
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = sheet && sheet[addr];
            const span = origin.get(key);
            const spanAttr = span
                ? `${span.rowspan > 1 ? ` rowspan="${span.rowspan}"` : ""}${span.colspan > 1 ? ` colspan="${span.colspan}"` : ""}`
                : "";
            const numClass = cell && cell.t === "n" ? " class=\"xl-num\"" : "";
            cells.push(`<td${numClass}${spanAttr}>${escapeHtml(cellDisplay(cell))}</td>`);
        }
        bodyRows.push(`<tr>${cells.join("")}</tr>`);
    }

    return `<table class="xl-grid"><colgroup><col class="xl-row-col" />${cols.join("")}</colgroup><thead><tr><th class="xl-corner"></th>${headCells.join("")}</tr></thead><tbody>${bodyRows.join("")}</tbody></table>`;
}

function excelPreviewCss() {
    return `
      html, body.xl-body { height: 100%; }
      body.xl-body {
        padding: 0;
        overflow: hidden;
        font-family: Calibri, "Segoe UI", Arial, sans-serif;
        font-size: 11px;
        line-height: 1.2;
        background: #e6e6e6;
      }
      .xl-app {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .xl-bar {
        flex-shrink: 0;
        height: 32px;
        background: #217346;
        color: #fff;
        display: flex;
        align-items: center;
        padding: 0 12px;
        font-size: 12px;
        font-weight: 600;
      }
      .xl-formula {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        height: 28px;
        padding: 0 8px;
        background: #fff;
        border-bottom: 1px solid #d0d0d0;
      }
      .xl-name { width: 56px; text-align: center; border: 1px solid #d0d0d0; font-size: 11px; color: #444; padding: 2px 0; }
      .xl-fx { color: #888; font-style: italic; font-size: 12px; }
      .xl-fx-field { flex: 1; height: 20px; border: 1px solid #d0d0d0; background: #fafafa; }
      .xl-grid-host {
        flex: 1 1 auto;
        min-height: 240px;
        position: relative;
        background: #fff;
        overflow: hidden;
      }
      .xl-panel {
        display: none;
        position: absolute;
        inset: 0;
        overflow: auto;
      }
      .xl-panel:first-child { display: block; }
      .xl-grid-host:has(.xl-panel:target) .xl-panel:not(:target) { display: none; }
      .xl-grid-host .xl-panel:target { display: block; }
      .xl-grid { border-collapse: collapse; table-layout: fixed; min-width: 100%; font-size: 11px; }
      .xl-grid col.xl-row-col { width: 40px; }
      .xl-grid th, .xl-grid td {
        border: 1px solid #d4d4d4;
        padding: 2px 6px;
        height: 20px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-sizing: border-box;
      }
      .xl-grid thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: #f2f2f2;
        color: #5f5f5f;
        font-weight: 600;
        text-align: center;
        font-size: 11px;
      }
      .xl-grid th.xl-row {
        position: sticky;
        left: 0;
        z-index: 1;
        background: #f2f2f2;
        color: #5f5f5f;
        font-weight: 600;
        text-align: center;
        width: 40px;
      }
      .xl-grid th.xl-corner {
        position: sticky;
        top: 0;
        left: 0;
        z-index: 3;
        background: #f2f2f2;
      }
      .xl-grid td { background: #fff; color: #000; }
      .xl-grid td.xl-num { text-align: right; }
      .xl-tabs {
        flex-shrink: 0;
        display: flex;
        align-items: stretch;
        background: #f3f3f3;
        border-top: 1px solid #c6c6c6;
        height: 32px;
        padding: 0 8px;
        overflow-x: auto;
      }
      .xl-tabs a {
        display: flex;
        align-items: center;
        padding: 0 14px;
        margin: 4px 1px 0;
        border: 1px solid #d0d0d0;
        border-bottom: none;
        border-radius: 4px 4px 0 0;
        color: #444;
        font-size: 12px;
        white-space: nowrap;
        text-decoration: none;
        background: #e9e9e9;
      }
      .xl-tabs a:hover { background: #fff; }
    `;
}

/** Highlight the tab whose panel is :target (and the first tab before any click). */
function selectedTabCss({ wrapClass, panelClass, idPrefix, tabClass, count, color }) {
    const targeted = [];
    for (let i = 0; i < count; i++) {
        targeted.push(`.${wrapClass}:has(#${idPrefix}-${i}:target) .${tabClass}-${i}`);
    }
    return `
      body:not(:has(.${panelClass}:target)) .${tabClass}-0,
      ${targeted.join(",\n      ")} {
        background: #fff;
        border-bottom: 2px solid ${color};
        color: ${color};
        font-weight: 600;
      }
    `;
}

/**
 * Convert .xlsx / .xls to a watermarked HTML workbook that looks like Excel
 * (lettered columns, numbered rows, bottom sheet tabs). The selected sheet tab
 * follows the panel :target hash so it stays in sync without inline scripts.
 */
async function excelToWatermarkedHtml(excelBuffer, watermarkText) {
    const workbook = XLSX.read(excelBuffer, { type: "buffer", cellDates: true });
    const names = (workbook.SheetNames || []).slice(0, EXCEL_PREVIEW_MAX_SHEETS);
    if (!names.length) {
        return wrapWatermarkedHtml("<p>This spreadsheet is empty.</p>", watermarkText);
    }

    const panels = names
        .map((name, i) => `<div class="xl-panel" id="sheet-${i}">${sheetToExcelGrid(workbook.Sheets[name])}</div>`)
        .join("");
    const tabs = names
        .map((name, i) => `<a class="xl-tab-${i}" href="#sheet-${i}">${escapeHtml(name)}</a>`)
        .join("");

    const bodyHtml = `<div class="xl-app"><div class="xl-bar">Excel Preview</div><div class="xl-formula"><span class="xl-name">A1</span><span class="xl-fx">fx</span><span class="xl-fx-field"></span></div><div class="xl-grid-host">${panels}</div><div class="xl-tabs">${tabs}</div></div>`;

    return wrapWatermarkedHtml(
        bodyHtml,
        watermarkText,
        excelPreviewCss() + selectedTabCss({
            wrapClass: "xl-app",
            panelClass: "xl-panel",
            idPrefix: "sheet",
            tabClass: "xl-tab",
            count: names.length,
            color: "#217346"
        }),
        "xl-body"
    );
}

function decodeXmlEntities(text) {
    return String(text ?? "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}

function parseRelationshipMap(relsXml) {
    const map = {};
    const tags = relsXml.match(/<Relationship\b[^>]*>/g) || [];
    for (const tag of tags) {
        const id = /Id="([^"]+)"/.exec(tag);
        const target = /Target="([^"]+)"/.exec(tag);
        if (id && target) map[id[1]] = target[1].replace(/\\/g, "/");
    }
    return map;
}

function resolvePptPath(target, fromDir) {
    let t = String(target || "").replace(/\\/g, "/");
    if (t.startsWith("/")) return t.replace(/^\/+/, "");
    const base = fromDir.replace(/\/+$/, "");
    const parts = `${base}/${t}`.split("/");
    const out = [];
    for (const part of parts) {
        if (part === "" || part === ".") continue;
        if (part === "..") out.pop();
        else out.push(part);
    }
    return out.join("/");
}

function imageMimeFromName(name) {
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (ext === "png") return "image/png";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "gif") return "image/gif";
    if (ext === "webp") return "image/webp";
    if (ext === "svg") return "image/svg+xml";
    return null;
}

function extractSlideTexts(slideXml) {
    const texts = [];
    const re = /<a:t\b[^>]*>([^<]*)<\/a:t>/g;
    let m;
    while ((m = re.exec(slideXml))) {
        const t = decodeXmlEntities(m[1]).trim();
        if (t) texts.push(t);
    }
    return texts;
}

function extractEmbedIds(slideXml) {
    const ids = [];
    const re = /r:embed="([^"]+)"/g;
    let m;
    while ((m = re.exec(slideXml))) ids.push(m[1]);
    return [...new Set(ids)];
}

async function slideToHtml(zip, slidePath) {
    const slideFile = zip.file(slidePath);
    if (!slideFile) return "<div class=\"ppt-empty\">(empty slide)</div>";
    const slideXml = await slideFile.async("string");
    const texts = extractSlideTexts(slideXml);
    const title = texts[0] || "";
    const body = texts.slice(1);

    const relsPath = slidePath.replace(/slides\/([^/]+)$/, "slides/_rels/$1.rels");
    const relsFile = zip.file(relsPath);
    const relMap = relsFile ? parseRelationshipMap(await relsFile.async("string")) : {};
    const images = [];
    for (const embedId of extractEmbedIds(slideXml).slice(0, 8)) {
        const target = relMap[embedId];
        if (!target) continue;
        const mediaPath = resolvePptPath(target, slidePath.replace(/\/[^/]+$/, ""));
        const mime = imageMimeFromName(mediaPath);
        const mediaFile = zip.file(mediaPath);
        if (!mime || !mediaFile) continue;
        const b64 = await mediaFile.async("base64");
        images.push(`<img src="data:${mime};base64,${b64}" alt="" />`);
    }

    const titleHtml = title ? `<h2>${escapeHtml(title)}</h2>` : "";
    const bodyHtml = body.length
        ? `<ul>${body.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`
        : "";
    const mediaHtml = images.length ? `<div class="ppt-media">${images.join("")}</div>` : "";
    if (!titleHtml && !bodyHtml && !mediaHtml) {
        return "<div class=\"ppt-empty\">(empty slide)</div>";
    }
    return `${titleHtml}${bodyHtml}${mediaHtml}`;
}

async function orderedSlidePaths(zip) {
    const presFile = zip.file("ppt/presentation.xml");
    const relsFile = zip.file("ppt/_rels/presentation.xml.rels");
    if (presFile && relsFile) {
        const presXml = await presFile.async("string");
        const relMap = parseRelationshipMap(await relsFile.async("string"));
        const ids = [];
        const re = /<p:sldId\b[^>]*r:id="([^"]+)"/g;
        let m;
        while ((m = re.exec(presXml))) ids.push(m[1]);
        const paths = ids
            .map((id) => relMap[id])
            .filter(Boolean)
            .map((target) => resolvePptPath(target, "ppt"));
        if (paths.length) return paths.slice(0, PPTX_PREVIEW_MAX_SLIDES);
    }

    return Object.keys(zip.files)
        .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
        .sort((a, b) => {
            const na = Number((/slide(\d+)/i.exec(a) || [])[1] || 0);
            const nb = Number((/slide(\d+)/i.exec(b) || [])[1] || 0);
            return na - nb;
        })
        .slice(0, PPTX_PREVIEW_MAX_SLIDES);
}

function pptPreviewCss() {
    return `
      html, body.ppt-body { height: 100%; }
      body.ppt-body {
        padding: 0;
        overflow: hidden;
        font-family: Calibri, "Segoe UI", Arial, sans-serif;
        background: #3f3f3f;
      }
      .ppt-app { display: flex; flex-direction: column; height: 100%; }
      .ppt-bar {
        flex-shrink: 0; height: 32px; background: #c43e1c; color: #fff;
        display: flex; align-items: center; padding: 0 12px; font-size: 12px; font-weight: 600;
      }
      .ppt-stage {
        flex: 1 1 auto; min-height: 240px; display: flex; align-items: center; justify-content: center;
        padding: 16px; background: #2b2b2b; position: relative; overflow: hidden;
      }
      .ppt-panel {
        display: none;
        position: absolute;
        inset: 16px;
        overflow: auto;
        background: #fff;
        border-radius: 4px;
        box-shadow: 0 8px 24px rgba(0,0,0,.35);
        padding: 28px 36px;
      }
      .ppt-panel:first-child { display: block; }
      .ppt-stage:has(.ppt-panel:target) .ppt-panel:not(:target) { display: none; }
      .ppt-stage .ppt-panel:target { display: block; }
      .ppt-panel h2 { margin: 0 0 16px; font-size: 28px; color: #1a1a1a; }
      .ppt-panel ul { margin: 0; padding-left: 22px; font-size: 16px; line-height: 1.45; color: #222; }
      .ppt-panel li { margin: 0 0 8px; }
      .ppt-media { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
      .ppt-media img { max-width: 46%; max-height: 180px; object-fit: contain; }
      .ppt-empty { color: #888; font-size: 14px; }
      .ppt-tabs {
        flex-shrink: 0; display: flex; align-items: stretch; background: #ececec;
        border-top: 1px solid #c6c6c6; height: 32px; padding: 0 8px; overflow-x: auto;
      }
      .ppt-tabs a {
        display: flex; align-items: center; padding: 0 12px; margin: 4px 1px 0;
        border: 1px solid #d0d0d0; border-bottom: none; border-radius: 4px 4px 0 0;
        color: #444; font-size: 12px; white-space: nowrap; text-decoration: none; background: #e9e9e9;
      }
      .ppt-tabs a:hover { background: #fff; }
    `;
}

/**
 * Convert .pptx to a watermarked HTML slide deck. Legacy .ppt is binary and cannot
 * be parsed here — we return a short fallback page instead.
 */
async function pptToWatermarkedHtml(pptBuffer, watermarkText) {
    let zip;
    try {
        zip = await JSZip.loadAsync(pptBuffer);
    } catch {
        return wrapWatermarkedHtml(
            `<div class="ppt-fallback"><p>This legacy .ppt file can&apos;t be previewed in the browser. Download it, or share a .pptx.</p></div>`,
            watermarkText,
            `body.ppt-body { padding: 32px; background: #f7f7f7; } .ppt-fallback { font-size: 14px; color: #444; }`,
            "ppt-body"
        );
    }

    const paths = await orderedSlidePaths(zip);
    if (!paths.length) {
        return wrapWatermarkedHtml("<p>This presentation has no slides.</p>", watermarkText);
    }

    const panels = [];
    for (let i = 0; i < paths.length; i++) {
        const inner = await slideToHtml(zip, paths[i]);
        panels.push(`<div class="ppt-panel" id="slide-${i}">${inner}</div>`);
    }
    const tabs = paths
        .map((_, i) => `<a class="ppt-tab-${i}" href="#slide-${i}">Slide ${i + 1}</a>`)
        .join("");
    const bodyHtml = `<div class="ppt-app"><div class="ppt-bar">PowerPoint Preview</div><div class="ppt-stage">${panels.join("")}</div><div class="ppt-tabs">${tabs}</div></div>`;
    return wrapWatermarkedHtml(
        bodyHtml,
        watermarkText,
        pptPreviewCss() + selectedTabCss({
            wrapClass: "ppt-app",
            panelClass: "ppt-panel",
            idPrefix: "slide",
            tabClass: "ppt-tab",
            count: paths.length,
            color: "#c43e1c"
        }),
        "ppt-body"
    );
}

async function addImageWatermark(
    imageBuffer,
    watermarkText
) {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    const svg = `
        <svg width="${metadata.width}" height="${metadata.height}">
            <defs>
                <pattern
                    id="watermark"
                    width="300"
                    height="100"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(-30)"
                >
                    <text
                        x="10"
                        y="70"
                        fill="red"
                        opacity="0.6"
                        font-size="15"
                    >
                        ${watermarkText}
                    </text>
                </pattern>
            </defs>

            <rect
                width="100%"
                height="100%"
                fill="url(#watermark)"
            />
        </svg>
    `;

    return await sharp(imageBuffer)
        .composite([
            {
                input: Buffer.from(svg),
                top: 0,
                left: 0
            }
        ])
        .toBuffer();
}

async function addPdfWatermark(
    pdfBuffer,
    watermarkText
) {

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    for (const page of pages) {
        const { width, height } = page.getSize();
        for (
            let y = -200;
            y < height + 200;
            y += 150
        ) {

            for (
                let x = -200;
                x < width + 200;
                x += 250
            ) {

                page.drawText(
                    watermarkText,
                    {
                        x,
                        y,
                        size: 18,
                        rotate: degrees(45),
                        opacity: 0.7,
                        color: rgb(0.7, 0.7, 0.7)
                    }
                );
            }
        }
    }

    return Buffer.from(
        await pdfDoc.save()
    );
}

module.exports = {
    addImageWatermark,
    addPdfWatermark,
    docxToWatermarkedHtml,
    excelToWatermarkedHtml,
    pptToWatermarkedHtml
};
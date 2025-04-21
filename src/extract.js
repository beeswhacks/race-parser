#!/usr/bin/env ts-node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pdfjs_dist_1 = require("pdfjs-dist");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// ---------- CLI ----------
if (process.argv.length < 3) {
    console.error('Usage: extract <file.pdf>');
    process.exit(1);
}
const pdfPath = process.argv[2];
main(pdfPath).catch((err) => {
    console.error(err);
    process.exit(1);
});
// ---------- Main ----------
async function main(file) {
    const data = await fs_1.default.promises.readFile(file);
    const pdf = await (0, pdfjs_dist_1.getDocument)({ data }).promise;
    const rows = [];
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const txt = await page.getTextContent();
        const words = txt.items
            .map((i) => {
            const { str, transform } = i;
            const [, , , , x, y] = transform;
            return { str: str.trim(), x, y: Math.round(y) };
        })
            .filter((w) => w.str);
        // 2. bucket by Y (line), sort by X
        const lines = {};
        for (const w of words)
            (lines[w.y] ??= []).push(w);
        for (const k in lines)
            lines[k].sort((a, b) => a.x - b.x);
        // 3. process candidate lines
        for (const y of Object.keys(lines)) {
            const text = lines[+y].map((w) => w.str).join(' ');
            if (/^\d+\s+\d+\s+\S+/.test(text)) {
                const row = parseRow(text);
                if (row)
                    rows.push(row);
            }
        }
    }
    // 4. metadata
    const metaText = rows.map((r) => Object.values(r).join(' ')).join(' ');
    const doc = {
        title: /RACE.+?CLASSIFICATION/.exec(metaText)?.[0] ?? 'Race Classification',
        circuit: /(?:GP|Race Meeting).*? -/.exec(metaText)?.[0]?.replace(' -', '') ?? '',
        date: /(\d{2}\/\d{2}\/\d{4})/.exec(metaText)?.[1] ?? '',
        rows,
    };
    // 5. output
    const out = path_1.default.basename(file, path_1.default.extname(file)) + '.json';
    await fs_1.default.promises.writeFile(out, JSON.stringify(doc, null, 2));
    console.log(`✓  ${out}`);
}
// ---------- Helpers ----------
function parseRow(t) {
    /* Example:
       1 93 4 Morgan Plus 4 1991 11 12 31:35.450 2:36.239 82.94
    */
    const rx = /^(\d+)\s+(\d+)\s+(\S+)\s+(.+?)\s{2,}(.+?)\s+(\d+)\s+(\d+)\s+([\d:.]+)?\s*([\d:.]+)?\s*([\d.]+)?/;
    const m = t.match(rx);
    if (!m)
        return null;
    const [, pos, no, cls, driver, entry, bestLap, laps, gap, diff, mph] = m;
    return {
        pos: +pos,
        no,
        class: cls,
        driver,
        entry,
        bestLap: +bestLap,
        laps: +laps,
        gap,
        diff,
        mph: mph ? +mph : undefined,
    };
}

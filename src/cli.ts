#!/usr/bin/env node
import fs from 'fs/promises';
import parseRacePdf from './parseRacePdf.js';

async function main() {
  const [, , inFile, outFile] = process.argv;
  if (!inFile) return console.error('Usage: race-class-parser <pdf> [json]');
  const data = new Uint8Array(await fs.readFile(inFile));
  const rows = await parseRacePdf(data);
  const json = JSON.stringify(rows, null, 2);
  if (outFile) await fs.writeFile(outFile, json);
  else console.log(json);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
import fs from 'fs/promises';
import parseRacePdf from './parseRacePdf.js';
const HELP_TEXT = `
Usage: race-parser [options] <input.pdf> [output.json]

Options:
  -h, --help       Show this help message and exit
`;
async function main() {
    const args = process.argv.slice(2);
    if (args.includes('-h') || args.includes('--help')) {
        console.log(HELP_TEXT.trim());
        process.exit(0);
    }
    const [, , inFile, outFile] = process.argv;
    if (!inFile) {
        console.error('Error: Input file is required.');
        console.info(HELP_TEXT.trim());
        process.exit(1);
    }
    const data = new Uint8Array(await fs.readFile(inFile));
    const rows = await parseRacePdf(data);
    const json = JSON.stringify(rows, null, 2);
    if (outFile)
        await fs.writeFile(outFile, json);
    else
        console.log(json);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const src = await readFile(new URL("../../lib/talkly-ai/daily-pdf.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("daily-pdf.ts", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const names = ["concatBytes","pdfWithJpegPages"];
const functions = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text));
assert.equal(functions.length, 2);
const js = ts.transpileModule(functions.map(x => x.getText(ast)).join("\n"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { pdfWithJpegPages } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const jpeg = Uint8Array.from(Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD6pooooA//2Q==", "base64"));
const bytes = pdfWithJpegPages([jpeg,jpeg], 8, 8);
const str = Buffer.from(bytes).toString("latin1");
assert.ok(str.startsWith("%PDF-1.4"));
assert.match(str,/\/Count 2/);
assert.match(str,/\/Filter \/DCTDecode/);
assert.ok(str.endsWith("%%EOF\n"));
const doc = await getDocument({ data: bytes, useSystemFonts: true, disableFontFace: true }).promise;
assert.equal(doc.numPages,2);
const page = await doc.getPage(2);
assert.equal(page.view[2],595.28);
await doc.destroy();
console.log("PASS: generated JPEG-based two-page PDF opens in PDF.js");

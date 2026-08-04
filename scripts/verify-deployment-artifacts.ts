import { readFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const tracePath = path.join(
    process.cwd(),
    ".next/server/app/api/documents/route.js.nft.json",
  );
  const trace = JSON.parse(await readFile(tracePath, "utf8")) as { files?: string[] };
  const files = trace.files ?? [];

  function requireTracedFile(description: string, predicate: (file: string) => boolean) {
    if (!files.some(predicate)) {
      throw new Error(`Document route deployment trace is missing ${description}.`);
    }
  }

  requireTracedFile("pdf.worker.mjs", (file) =>
    file.endsWith("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
  );
  requireTracedFile("@napi-rs/canvas", (file) =>
    file.includes("node_modules/@napi-rs/canvas/"),
  );
  requireTracedFile("a platform canvas binary", (file) =>
    /node_modules\/@napi-rs\/canvas-[^/]+\/.*\.node$/.test(file),
  );

  console.log("Document deployment artifacts include PDF worker and canvas runtime.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

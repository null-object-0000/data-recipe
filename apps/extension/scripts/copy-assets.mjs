import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(root, "public");
const distDir = join(root, "dist");

await mkdir(distDir, { recursive: true });
await cp(publicDir, distDir, { recursive: true });

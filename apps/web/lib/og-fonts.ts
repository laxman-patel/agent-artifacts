import { readFile } from "node:fs/promises";

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}

export async function loadOgFonts() {
  const [geist, geistMono] = await Promise.all([
    readFile(new URL("../public/fonts/geist-font-1.7.1/Geist/webfonts/Geist-Variable.woff2", import.meta.url)),
    readFile(new URL("../public/fonts/geist-font-1.7.1/GeistMono/webfonts/GeistMono-Variable.woff2", import.meta.url))
  ]);

  return [
    {
      name: "Geist",
      data: toArrayBuffer(geist),
      style: "normal" as const,
      weight: 500 as const
    },
    {
      name: "Geist Mono",
      data: toArrayBuffer(geistMono),
      style: "normal" as const,
      weight: 500 as const
    }
  ];
}

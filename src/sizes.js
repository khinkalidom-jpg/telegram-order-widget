import { deflateSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { widgetHTML } from './widget.js';
export function checkSizes(html = widgetHTML()) {
  const raw = Buffer.byteLength(html), compressed = deflateSync(Buffer.from(html), { level: 9 }).length;
  if (raw > 32768 || compressed > 4096) throw new Error(`Widget exceeds limits: ${raw}/${compressed}`);
  return { raw, compressed };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(checkSizes());

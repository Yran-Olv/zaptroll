import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const files = [
  path.join(__dirname, '../node_modules/zapo-js/dist/client/coordinators/WaRetryCoordinator.js'),
  path.join(__dirname, '../node_modules/zapo-js/dist/esm/client/coordinators/WaRetryCoordinator.js')
];

for (const f of files) {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    if (content.includes("return 'view_once_unavailable_fanout';")) {
      content = content.replace("return 'view_once_unavailable_fanout';", "return null; // patched to allow placeholder resend of view_once");
      fs.writeFileSync(f, content, 'utf8');
      console.log(`[patch-zapo] Patched ${f}`);
    }
  }
}

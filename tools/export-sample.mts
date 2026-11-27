// 同梱のサンプル美術館を JSON ファイルとして public/samples/ に書き出す（TMS 58）。
// アプリ本体はデータ（src/data/sampleMuseum.ts）を直接使う。このファイルは「JSON を読み込む」のお手本・確認用。
// npm run release のたびに作り直すので、データと食い違わない。
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sampleMuseum } from '../src/data/sampleMuseum.ts';
import { serializeMuseum, parseMuseum } from '../src/data/museumJson.ts';

const json = serializeMuseum(sampleMuseum);
const check = parseMuseum(json);
if (!check.ok || check.warnings.length) {
  console.error('サンプル美術館が読み込みの検査を通りません', check);
  process.exit(1);
}
const dir = fileURLToPath(new URL('../public/samples/', import.meta.url));
mkdirSync(dir, { recursive: true });
writeFileSync(dir + 'sample-museum.json', json + '\n');
console.log(`✓ public/samples/sample-museum.json（${json.length} 文字、床・壁 ${sampleMuseum.objects.length}、作品 ${sampleMuseum.exhibits.length}）`);

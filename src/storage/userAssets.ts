// 利用者が追加した作品（画像・動画・音・3D・文章）を、このブラウザの IndexedDB に保存する。
// 起動時に読み込み、blob: の URL を付けて作品ライブラリ（data/library.ts）に登録する。サーバーには送らない。
import type { ExhibitAsset, ExhibitType } from '../types/museum';
import { registerOwnAsset, unregisterOwnAsset } from '../data/library';

const DB = 'museum-assets';
const STORE = 'assets';

interface Stored {
  id: string;
  meta: Omit<ExhibitAsset, 'src'>;
  blob: Blob | null; // 文章は本文を meta.body に持つので null
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = run(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function register(s: Stored) {
  registerOwnAsset({ ...s.meta, ...(s.blob ? { src: URL.createObjectURL(s.blob) } : {}) } as ExhibitAsset);
}

/** 起動時：保存してある作品をライブラリに登録する（使えない環境では何もしない） */
export async function loadOwnAssets(): Promise<number> {
  try {
    const all = await tx<Stored[]>('readonly', (s) => s.getAll() as IDBRequest<Stored[]>);
    all.forEach(register);
    return all.length;
  } catch {
    return 0;
  }
}

export async function removeOwnAsset(id: string) {
  await tx('readwrite', (s) => s.delete(id));
  unregisterOwnAsset(id);
}

// ---- ファイルから作品を作る ----
const LIMIT_MB: Record<string, number> = { image: 15, video: 80, audio: 30, glb: 50, text: 0.1 };
const COLORS = ['#8a7f73', '#6f7f86', '#9a8273', '#7a6f86', '#6f8673'];

function kindOf(file: File): ExhibitType | null {
  const name = file.name.toLowerCase();
  if (/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return 'image';
  if (/^video\/(mp4|webm)$/.test(file.type)) return 'video';
  if (/^audio\//.test(file.type) || /\.(mp3|m4a|wav|ogg)$/.test(name)) return 'audio';
  if (name.endsWith('.glb')) return 'glb';
  if (file.type === 'text/plain' || /\.(txt|md)$/.test(name)) return 'text';
  return null;
}

/** 長い辺を max m にした幅・高さ */
function fit(w: number, h: number, max: number): [number, number] {
  const r = w / h;
  return r >= 1 ? [max, round(max / r)] : [round(max * r), max];
}
const round = (v: number) => Math.round(v * 100) / 100;

function imageSize(blob: Blob): Promise<[number, number]> {
  return createImageBitmap(blob).then((b) => {
    const s: [number, number] = [b.width, b.height];
    b.close();
    return s;
  });
}

function videoSize(blob: Blob): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(blob);
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => {
      resolve([v.videoWidth || 16, v.videoHeight || 9]);
      URL.revokeObjectURL(url);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('動画を読めませんでした'));
    };
    v.src = url;
  });
}

/**
 * GLB は中身だけで完結しているものに限る（外部のファイル・URL を読みに行く glTF は受け付けない）。
 * ヘッダー（glTF・版 2）と JSON 部分の buffers / images の uri を確かめる。
 */
async function checkGlb(blob: Blob): Promise<void> {
  const head = new DataView(await blob.slice(0, 20).arrayBuffer());
  if (head.getUint32(0, true) !== 0x46546c67 || head.getUint32(4, true) !== 2) throw new Error('GLB（glTF 2.0 のバイナリ）ではありません');
  const jsonLen = head.getUint32(12, true);
  if (head.getUint32(16, true) !== 0x4e4f534a) throw new Error('GLB の形式が正しくありません');
  const json = JSON.parse(await blob.slice(20, 20 + jsonLen).text()) as { buffers?: { uri?: string }[]; images?: { uri?: string }[] };
  const external = [...(json.buffers ?? []), ...(json.images ?? [])].some((x) => x.uri && !x.uri.startsWith('data:'));
  if (external) throw new Error('外部のファイルを読み込む 3D モデルは使えません（ひとつの .glb にまとめてください）');
}

/**
 * ファイルを確かめて作品にし、保存してライブラリに登録する。作った作品の id を返す。
 * asObject：.glb を置き物（台座なし）として登録する。大きさは呼び出し側（main.ts）が three.js で測って渡す
 */
export async function addOwnAsset(
  file: File,
  asObject?: { size: [number, number]; footprint: [number, number] },
): Promise<{ ok: true; id: string; title: string } | { ok: false; error: string }> {
  const type = asObject ? (file.name.toLowerCase().endsWith('.glb') ? 'glb' : null) : kindOf(file);
  if (!type) return { ok: false, error: asObject ? '.glb を選んでください' : '画像・動画・音・3D（.glb）・文章（.txt）を選んでください' };
  if (file.size > LIMIT_MB[type] * 1024 * 1024) return { ok: false, error: `大きすぎます（${LIMIT_MB[type] >= 1 ? `${LIMIT_MB[type]}MB` : '100KB'} まで）` };
  const title = file.name.replace(/\.[^.]+$/, '').slice(0, 60) || '無題';
  const id = `own-${crypto.randomUUID().slice(0, 8)}`;
  const base = { id, type, author: '', description: '', title, placeholderColor: COLORS[Math.floor(Math.random() * COLORS.length)] };
  let meta: Omit<ExhibitAsset, 'src'>;
  let blob: Blob | null = file;
  try {
    if (type === 'image') {
      const size = fit(...(await imageSize(file)), 1.4);
      meta = { ...base, mount: 'wall', size, frameSize: [round(size[0] + 0.12), round(size[1] + 0.12)] };
    } else if (type === 'video') {
      const size = fit(...(await videoSize(file)), 1.6);
      meta = { ...base, mount: 'wall', size, frameSize: [round(size[0] + 0.1), round(size[1] + 0.1)] };
    } else if (type === 'audio') {
      meta = { ...base, mount: 'wall', size: [0.8, 0.8], placeholderColor: '#3b3530' };
    } else if (type === 'glb' && asObject) {
      await checkGlb(file);
      meta = { ...base, type: 'object', mount: 'floor', size: asObject.size, footprint: asObject.footprint };
    } else if (type === 'glb') {
      await checkGlb(file);
      meta = { ...base, mount: 'floor', size: [0.9, 1.0] };
    } else {
      meta = { ...base, mount: 'wall', size: [1.0, 1.25], frameSize: [1.04, 1.29], body: (await file.text()).slice(0, 1500), placeholderColor: '#f4efe6' };
      blob = null;
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '読み込めませんでした' };
  }
  try {
    await tx('readwrite', (s) => s.put({ id, meta, blob } satisfies Stored));
  } catch {
    return { ok: false, error: 'このブラウザに保存できませんでした（容量・プライベートブラウズ）' };
  }
  register({ id, meta, blob });
  return { ok: true, id, title };
}

/** 自分の作品の名前を変える（ライブラリと保存の両方） */
export async function renameOwnAsset(id: string, title: string) {
  const s = await tx<Stored | undefined>('readonly', (st) => st.get(id) as IDBRequest<Stored | undefined>);
  if (!s) return;
  s.meta = { ...s.meta, title };
  await tx('readwrite', (st) => st.put(s));
  unregisterOwnAsset(id);
  register(s);
}

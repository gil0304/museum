// 自分の美術館（複数）をこのブラウザの localStorage に保存する。
// 一覧 museum.list.v1 = [{ id, title, updatedAt }]、中身 museum.doc.<id> = 美術館データの JSON（書き出しと同じ形）。
// 読むときは JSON の読み込みと同じ検査（parseMuseum）を通す。
import type { MuseumDocument } from '../types/museum';
import { parseMuseum, serializeMuseum } from '../data/museumJson';

export interface MuseumEntry {
  id: string;
  title: string;
  updatedAt: number;
}

const LIST = 'museum.list.v1';
const DOC = (id: string) => `museum.doc.${id}`;
const LEGACY = 'museum.autosave.v1'; // TMS 57 の 1 つだけの保存

export function newMuseumId() {
  return `m-${crypto.randomUUID().slice(0, 8)}`;
}

export function listMuseums(): MuseumEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LIST) ?? '[]') as MuseumEntry[];
    return Array.isArray(raw) ? raw.filter((m) => m && typeof m.id === 'string').sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

function writeList(list: MuseumEntry[]) {
  localStorage.setItem(LIST, JSON.stringify(list));
}

export function loadMuseum(id: string): MuseumDocument | null {
  try {
    const raw = localStorage.getItem(DOC(id));
    if (!raw) return null;
    const r = parseMuseum(raw);
    return r.ok ? { ...r.doc, id } : null;
  } catch {
    return null;
  }
}

/** 保存する（一覧の名前・更新日時も直す）。保存できなければ false */
export function saveMuseum(doc: MuseumDocument): boolean {
  try {
    localStorage.setItem(DOC(doc.id), serializeMuseum(doc));
    const list = listMuseums().filter((m) => m.id !== doc.id);
    writeList([{ id: doc.id, title: doc.title, updatedAt: Date.now() }, ...list]);
    return true;
  } catch {
    return false;
  }
}

export function removeMuseum(id: string) {
  try {
    localStorage.removeItem(DOC(id));
    writeList(listMuseums().filter((m) => m.id !== id));
  } catch {
    /* 保存領域が使えない */
  }
}

/** 前の版の 1 つだけの保存（museum.autosave.v1）を、自分の美術館の 1 つとして引き継ぐ */
export function migrateLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY);
    if (!raw) return;
    const r = parseMuseum(raw);
    if (r.ok) saveMuseum({ ...r.doc, id: newMuseumId() });
    localStorage.removeItem(LEGACY);
  } catch {
    /* 何もしない */
  }
}

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { historyChapters } from './jrc';

const numerals = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV'];
const years = [2009,2010,2012,2013,2014,2015,2016,2017,2018,2019,2023,2024,2025,2026];
const themes = ['Jatim Robot Contest pertama','Resmi menjadi Java Robot Contest','Kembali setelah satu tahun jeda','Rescue','Play','Surabaya — Sinau Robot lan Budaya','Aerospace','Marine — Maritim for Indonesia','Zamrud Katulistiwa','Fourth Industrial Revolution — FUSION','SWASA — Spectacular of Pewayangan Indonesia','Ranger — Robot Antargalaksi Menjelajahi Negeri Baru','TECHNOCARNIVAL','Imperium Machina'];

describe('JRC history archive', () => {
  it('publishes exactly fourteen sequential, fact-matched editions', () => {
    expect(historyChapters.map(({ numeral }) => numeral)).toEqual(numerals);
    expect(historyChapters.map(({ year }) => year)).toEqual(years);
    expect(historyChapters.map(({ theme }) => theme)).toEqual(themes);
  });
  it('maps every edition to distinct existing desktop and mobile assets', () => {
    const paths = historyChapters.flatMap(({ image }) => [image.src, image.srcMobile]);
    expect(new Set(paths).size).toBe(28);
    historyChapters.forEach((chapter, index) => {
      const prefix = `/assets/history-archive/jrc-${String(index + 1).padStart(2, '0')}-`;
      expect(chapter.image.src.startsWith(prefix)).toBe(true);
      expect(chapter.image.srcMobile.startsWith(prefix)).toBe(true);
      expect(existsSync(join(process.cwd(), 'public', chapter.image.src))).toBe(true);
      expect(existsSync(join(process.cwd(), 'public', chapter.image.srcMobile))).toBe(true);
    });
  });
  it('labels XIV as artwork and records XIII provenance', () => {
    expect(historyChapters[13].image.caption).toBe('Identitas visual JRC XIV · 2026');
    expect(historyChapters[13].image.caption).not.toContain('Dokumentasi');
    const provenance = join(process.cwd(), 'public/assets/history-archive/PROVENANCE.md');
    expect(existsSync(provenance)).toBe(true);
  });
});

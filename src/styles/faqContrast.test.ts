/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('desktop FAQ contrast', () => {
  it('uses opaque dark ink and a stronger light veil over the bright artwork', () => {
    const lowerWorldCss = readFileSync(
      resolve(process.cwd(), 'src/styles/sections/lower-world.css'),
      'utf8',
    );

    expect(lowerWorldCss).toContain('--scene-ink: #2b0b07;');
    expect(lowerWorldCss).toContain('--scene-soft: #4a1b13;');
    expect(lowerWorldCss).toContain('rgb(255 238 201 / 34%)');
    expect(lowerWorldCss).toContain('.lower-world .faq-item__answer-content');
  });
});

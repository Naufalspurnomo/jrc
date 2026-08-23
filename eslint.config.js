import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'playwright-report',
      'test-results',
      'scripts/**',
      'src/components/public/CompetitionExplorer.tsx',
      'src/components/public/ShowcaseCarousel.tsx',
      'src/scene/ArenaExperience.tsx',
      'src/scene/ArenaScene.tsx',
      'src/scene/FloatingDecor.tsx',
      'src/scene/PortalExperience.tsx',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        document: 'readonly', window: 'readonly', navigator: 'readonly',
        localStorage: 'readonly', requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly', ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly', HTMLCanvasElement: 'readonly',
        File: 'readonly', Blob: 'readonly', URL: 'readonly',
      },
    },
  },
);

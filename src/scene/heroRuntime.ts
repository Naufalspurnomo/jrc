export const HERO_ASSETS = {
  background: '/assets/hero-rome-wide.webp',
  backgroundAvif: '/assets/hero-rome-wide.avif',
  backgroundMobile: '/assets/hero-rome-wide-mobile.webp',
  backgroundDepth: '/assets/hero-rome-depth.png',
  foreground: '/assets/brand/jrc14-gladiator-mascot.webp',
  foregroundMedium: '/assets/brand/jrc14-gladiator-mascot.webp',
  foregroundSmall: '/assets/brand/jrc14-gladiator-mascot.webp',
  foregroundFallback: '/assets/brand/jrc14-gladiator-mascot.png',
  foregroundVideo: '/assets/mascot/jrc14-gladiator-alpha.webm',
  foregroundDepth: '/assets/batu-knight-depth.png',
} as const;

export interface HeroCanvasProps {
  active: boolean;
  maxDpr?: number;
  onError?: () => void;
  onReady?: () => void;
}
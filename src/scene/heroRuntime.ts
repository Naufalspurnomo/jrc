export const HERO_ASSETS = {
  background: '/assets/hero-rome-wide.webp',
  backgroundAvif: '/assets/hero-rome-wide.avif',
  backgroundMobile: '/assets/hero-rome-wide-mobile.webp',
  backgroundDepth: '/assets/hero-rome-depth.png',
  foreground: '/assets/mascot/jrc14-gladiator-framekey-v2-poster.webp',
  foregroundMedium: '/assets/mascot/jrc14-gladiator-framekey-v2-poster.webp',
  foregroundSmall: '/assets/mascot/jrc14-gladiator-framekey-v2-poster.webp',
  foregroundFallback: '/assets/mascot/jrc14-gladiator-framekey-v2-poster.png',
  foregroundVideo: '/assets/mascot/jrc14-gladiator-framekey-v2-alpha.webm',
  foregroundDepth: '/assets/batu-knight-depth.png',
} as const;

export interface HeroCanvasProps {
  active: boolean;
  maxDpr?: number;
  onError?: () => void;
  onReady?: () => void;
}
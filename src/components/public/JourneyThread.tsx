import { useLayoutEffect, useRef } from 'react';

type JourneySide = 'left' | 'right' | 'center';

interface JourneyPoint {
  x: number;
  y: number;
}

const edge = (value: number, width: number) => Math.min(Math.max(value, 18), width - 18);

function pointForAnchor(
  anchor: HTMLElement,
  root: HTMLElement,
  rootWidth: number,
  compact: boolean,
): JourneyPoint {
  let left = 0;
  let top = 0;
  let element: HTMLElement | null = anchor;

  while (element && element !== root) {
    left += element.offsetLeft;
    top += element.offsetTop;
    element = element.offsetParent as HTMLElement | null;
  }

  const side = (anchor.dataset.journeySide ?? 'center') as JourneySide;
  const gap = Math.min(Math.max(rootWidth * 0.025, 22), 48);

  if (compact) {
    return {
      x: rootWidth - 14,
      y: top + anchor.offsetHeight * 0.5,
    };
  }

  const x = side === 'left'
    ? left - gap
    : side === 'right'
      ? left + anchor.offsetWidth + gap
      : left + anchor.offsetWidth * 0.5;

  return {
    x: edge(x, rootWidth),
    y: top + anchor.offsetHeight * 0.5,
  };
}

function routeForPoints(points: JourneyPoint[], height: number) {
  if (!points.length) return '';

  const first = points[0];
  let route = `M ${first.x} ${Math.max(0, first.y - 84)}`;
  let previous = first;

  points.forEach((point, index) => {
    if (index === 0) {
      route += ` L ${point.x} ${point.y}`;
    } else {
      const distance = Math.max(point.y - previous.y, 0);
      const curve = Math.max(58, Math.min(distance * 0.46, 240));
      route += ` C ${previous.x} ${previous.y + curve}, ${point.x} ${point.y - curve}, ${point.x} ${point.y}`;
    }
    previous = point;
  });

  return `${route} C ${previous.x} ${previous.y + 64}, ${previous.x} ${Math.max(previous.y + 96, height - 32)}, ${previous.x} ${height + 8}`;
}

/**
 * A single unobtrusive route for the lower-world narrative. Its geometry is
 * recalculated from real text positions, so each art-directed crop keeps a
 * route that follows the reading order instead of a fixed, brittle rail.
 */
export function JourneyThread() {
  const svgRef = useRef<SVGSVGElement>(null);
  const guideRef = useRef<SVGPathElement>(null);
  const progressRef = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    const guide = guideRef.current;
    const progress = progressRef.current;
    const root = svg?.closest<HTMLElement>('.lower-world');
    if (!svg || !guide || !progress || !root) return undefined;

    let frame = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sync = () => {
      frame = 0;
      const width = root.clientWidth;
      const height = root.scrollHeight;
      const compact = window.matchMedia('(max-width: 48rem)').matches;
      const anchors = Array.from(root.querySelectorAll<HTMLElement>('[data-journey-anchor]'));
      const points = anchors
        .map((anchor) => pointForAnchor(anchor, root, width, compact))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

      const route = routeForPoints(points, height);
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      guide.setAttribute('d', route);
      progress.setAttribute('d', route);
    };

    const syncProgress = () => {
      if (reducedMotion) {
        progress.style.strokeDashoffset = '0';
        return;
      }
      const rootRect = root.getBoundingClientRect();
      const start = window.innerHeight * 0.76;
      const end = window.innerHeight * 0.3 - root.scrollHeight;
      const progressValue = Math.min(Math.max((start - rootRect.top) / (start - end), 0), 1);
      progress.style.strokeDashoffset = String(1 - progressValue);
    };

    const scheduleSync = () => {
      if (!frame) frame = window.requestAnimationFrame(sync);
    };

    const scheduleProgress = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          syncProgress();
        });
      }
    };

    sync();
    syncProgress();
    window.addEventListener('resize', scheduleSync, { passive: true });
    if (!reducedMotion) window.addEventListener('scroll', scheduleProgress, { passive: true });

    const observer = typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(scheduleSync);
    observer?.observe(root);
    root.querySelectorAll<HTMLElement>('[data-journey-anchor]').forEach((anchor) => observer?.observe(anchor));
    void document.fonts?.ready?.then(scheduleSync);

    return () => {
      window.removeEventListener('resize', scheduleSync);
      window.removeEventListener('scroll', scheduleProgress);
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <svg className="journey-thread" ref={svgRef} aria-hidden="true" focusable="false">
      <path className="journey-thread__guide" ref={guideRef} pathLength="1" />
      <path className="journey-thread__progress" ref={progressRef} pathLength="1" />
    </svg>
  );
}

import { describe, expect, it, vi } from 'vitest';

import {
  createCinematicMotionController,
  type CinematicMotionDependencies,
} from './useCinematicMotion';

function createDependencies() {
  const lenis = {
    raf: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    scrollTo: vi.fn(),
    destroy: vi.fn(),
  };
  const update = vi.fn();
  const refresh = vi.fn();
  const tickerAdd = vi.fn();
  const tickerRemove = vi.fn();

  const dependencies: CinematicMotionDependencies = {
    createLenis: vi.fn(() => lenis),
    scrollTrigger: { update, refresh },
    ticker: { add: tickerAdd, remove: tickerRemove, lagSmoothing: vi.fn() },
  };

  return { dependencies, lenis, update, refresh, tickerAdd, tickerRemove };
}

describe('createCinematicMotionController', () => {
  it('uses one Lenis instance, forwards one ticker, and cleans everything up', () => {
    const { dependencies, lenis, update, tickerAdd, tickerRemove } = createDependencies();
    const controller = createCinematicMotionController({ dependencies });

    expect(dependencies.createLenis).toHaveBeenCalledOnce();
    expect(lenis.on).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(tickerAdd).toHaveBeenCalledOnce();

    const scrollListener = lenis.on.mock.calls[0][1] as () => void;
    scrollListener();
    expect(update).toHaveBeenCalledOnce();

    const frame = tickerAdd.mock.calls[0][0] as (time: number) => void;
    frame(2.5);
    expect(lenis.raf).toHaveBeenCalledWith(2500);

    controller.destroy();
    expect(tickerRemove).toHaveBeenCalledWith(frame);
    expect(lenis.off).toHaveBeenCalledWith('scroll', scrollListener);
    expect(lenis.destroy).toHaveBeenCalledOnce();
  });

  it('does not create a motion engine for reduced-motion users', () => {
    const { dependencies } = createDependencies();
    const controller = createCinematicMotionController({
      dependencies,
      reducedMotion: true,
    });

    expect(dependencies.createLenis).not.toHaveBeenCalled();
    controller.destroy();
  });

  it('pauses for hidden or offscreen state and resumes only when both are visible', () => {
    const { dependencies, lenis } = createDependencies();
    const onSceneActivityChange = vi.fn();
    const controller = createCinematicMotionController({
      dependencies,
      onSceneActivityChange,
    });

    controller.setDocumentVisible(false);
    expect(lenis.stop).toHaveBeenCalledTimes(1);

    controller.setHeroVisible(false);
    controller.setDocumentVisible(true);
    expect(lenis.start).toHaveBeenCalledTimes(1);
    expect(onSceneActivityChange).toHaveBeenLastCalledWith(false);

    controller.setHeroVisible(true);
    expect(onSceneActivityChange).toHaveBeenLastCalledWith(true);
  });

  it('pauses Lenis while a modal owns the document scroll lock', () => {
    const { dependencies, lenis } = createDependencies();
    const controller = createCinematicMotionController({ dependencies });

    window.dispatchEvent(new CustomEvent('jrc:modal-lock', { detail: { locked: true } }));
    expect(lenis.stop).toHaveBeenCalledOnce();

    window.dispatchEvent(new CustomEvent('jrc:modal-lock', { detail: { locked: false } }));
    expect(lenis.start).toHaveBeenCalledOnce();

    controller.destroy();
  });

  it('synchronizes route hash navigation with Lenis', () => {
    const { dependencies, lenis } = createDependencies();
    const target = document.createElement('section');
    target.id = 'perlombaan';
    document.body.appendChild(target);
    const controller = createCinematicMotionController({ dependencies });

    window.dispatchEvent(new CustomEvent('jrc:route-scroll', {
      detail: { targetId: 'perlombaan' },
    }));
    expect(lenis.scrollTo).toHaveBeenCalledWith(target, { immediate: true, force: true });

    controller.destroy();
    target.remove();
  });
});

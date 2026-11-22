import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HERO_ASSETS, HeroExperience } from './HeroExperience';

vi.mock('../../hooks/useCinematicMotion', () => ({
  useCinematicMotion: () => ({ rootRef: { current: null }, sceneActive: true }),
}));

describe('HeroExperience video delivery', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
  });

  it('loads the mascot video with a normal GET blob so static hosts do not receive a browser range request', async () => {
    const blob = new Blob(['video'], { type: 'video/webm' });
    const fetchMock = vi.fn().mockResolvedValue(new Response(blob, { status: 200 }));
    const createObjectURL = vi.fn().mockReturnValue('blob:jrc-hero');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const { unmount } = render(<HeroExperience><h1>JRC XIV</h1></HeroExperience>);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      HERO_ASSETS.foregroundVideo,
      expect.objectContaining({ headers: { Accept: 'video/webm' } }),
    ));
    expect(screen.getByText('JRC XIV')).toBeInTheDocument();
    expect(document.querySelector('video')).toHaveAttribute('src', 'blob:jrc-hero');

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:jrc-hero');
  });
});

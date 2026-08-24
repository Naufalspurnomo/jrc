import { expect, test } from '@playwright/test';

test('public arena is navigable, complete, and has no horizontal overflow', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /java robot contest xiv/i })).toBeVisible();
  await expect(page.locator('[data-testid="hero-static-fallback"]')).toBeAttached();

  const viewportOverflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewportOverflow.scrollWidth).toBe(viewportOverflow.clientWidth);

  const failedImages = await page.locator('img').evaluateAll((images) =>
    images
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.getAttribute('src')),
  );
  expect(failedImages).toEqual([]);

  if (testInfo.project.name === 'mobile') {
    const menu = page.locator('.site-header__toggle');
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: /navigasi utama/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeFocused();
  }

  await page.locator('#perlombaan').scrollIntoViewIfNeeded();
  const openArena = page.getByRole('button', { name: /lihat divisi/i });
  await expect(openArena).toBeVisible();
  await openArena.click();
  const arenaDialog = page.getByRole('dialog');
  await expect(arenaDialog).toBeVisible();

  if (testInfo.project.name === 'mobile') {
    const panel = arenaDialog.locator('.arena-modal__panel');
    await expect
      .poll(() => panel.evaluate((element) => element.scrollHeight > element.clientHeight), {
        message: 'expected the mobile arena panel to have scrollable overflow',
      })
      .toBe(true);

    await panel.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect
      .poll(
        () =>
          panel.evaluate(
            (element) => element.scrollTop + element.clientHeight >= element.scrollHeight - 1,
          ),
        { message: 'expected the mobile arena panel to reach its scroll boundary' },
      )
      .toBe(true);

    const bottomAction = arenaDialog.getByRole('button', { name: 'Tutup', exact: true });
    await expect(bottomAction).toBeInViewport();
    await expect(bottomAction).toBeEnabled();
    await bottomAction.click();
  } else {
    await page.getByRole('button', { name: /tutup detail arena/i }).click();
  }
  await expect(arenaDialog).toHaveCount(0);
  // Detail page still reachable directly or via modal's "Halaman penuh"
  await openArena.click();
  await page.getByRole('link', { name: /halaman penuh/i }).click();
  await expect(page).toHaveURL(/\/perlombaan\//);
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
  await page.getByRole('link', { name: /kembali ke enam arena/i }).click();
  await expect(page).toHaveURL(/\/#perlombaan$/);
  const competitionSection = page.locator('#perlombaan');
  await expect(competitionSection).toBeAttached();
  await expect
    .poll(
      () =>
        competitionSection.evaluate((section) => {
          const bounds = section.getBoundingClientRect();
          return bounds.top < window.innerHeight && bounds.bottom > 0;
        }),
      { message: 'expected #perlombaan to be in the viewport after returning from its detail page' },
    )
    .toBe(true);
  expect(consoleErrors).toEqual([]);
});

test('desktop keeps the static hero after user interaction', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The WebGL layer is desktop-only.');

  const consoleErrors: string[] = [];
  const heroRuntimeRequests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', (request) => {
    if (/\/assets\/(?:HeroCanvas|three)-.*\.js(?:\?|$)/.test(request.url())) {
      heroRuntimeRequests.push(request.url());
    }
  });

  await page.goto('/');
  const staticFallback = page.locator('[data-testid="hero-static-fallback"]');
  const webglContainer = page.locator('[data-testid="hero-webgl-canvas"]');
  await expect(staticFallback).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect(webglContainer).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(heroRuntimeRequests).toEqual([]);

  await page.mouse.wheel(0, 240);
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1_000);
  await expect(webglContainer).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(staticFallback).toBeVisible();
  expect(heroRuntimeRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('reduced motion keeps the Roman scene legible without the WebGL layer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /java robot contest xiv/i })).toBeVisible();
  await expect(page.locator('[data-testid="hero-static-fallback"]')).toBeVisible();
  await expect(page.locator('[data-testid="hero-webgl-canvas"]')).toHaveCount(0);
});

test('participant draft autosaves and can be submitted locally', async ({ page }, testInfo) => {
  await page.goto('/portal/masuk');
  await page.getByRole('button', { name: /masuk sebagai peserta/i }).click();
  await expect(page).toHaveURL(/\/portal$/);
  if (testInfo.project.name === 'mobile') {
    await expect(
      page
        .getByRole('navigation', { name: /navigasi portal peserta/i })
        .getByRole('link', { name: 'Pendaftaran' }),
    ).toBeVisible();
    const portalOverflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(portalOverflow.scrollWidth).toBe(portalOverflow.clientWidth);
  }

  await page.getByRole('link', { name: /lanjutkan pendaftaran/i }).click();
  await page.getByLabel('Nama tim').fill('Aurora Nova');
  await page.getByRole('button', { name: 'Lanjutkan' }).click();
  await page.reload();
  await expect(page.getByLabel('Nama tim')).toHaveValue('Aurora Nova');

  await page.getByRole('button', { name: 'Lanjutkan' }).click();
  await page.getByRole('button', { name: 'Lanjutkan' }).click();
  await page.getByLabel('Nama ketua').fill('Naufal Arena');
  await page.getByLabel('Email ketua').fill('naufal@example.test');
  await page.getByLabel('Nomor WhatsApp').fill('081234567890');
  await page.getByRole('button', { name: 'Lanjutkan' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'identitas.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('fixture identitas lokal'),
  });
  await page.getByRole('button', { name: /tinjau pendaftaran/i }).click();
  await expect(page.getByRole('heading', { name: /tinjau sebelum dikirim/i })).toBeVisible();
  await page.getByRole('button', { name: /kirim pendaftaran/i }).click();

  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByText('Terkirim', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Aurora Nova' })).toBeVisible();
});

test('admin can review a submitted team and export CSV', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'CSV download is covered once in Chromium.');

  await page.goto('/admin');
  await page.getByRole('button', { name: /masuk sebagai admin/i }).click();
  await page.getByRole('link', { name: /tinjau victoria prime/i }).click();
  await page.getByLabel('Catatan panitia').fill('Berkas mulai diperiksa.');
  await page.getByRole('button', { name: /mulai review/i }).click();
  await expect(page.locator('.portal-status')).toHaveText('Ditinjau');

  await page.getByLabel('Catatan panitia').fill('Seluruh metadata telah sesuai.');
  await page.getByRole('button', { name: 'Verifikasi' }).click();
  await expect(page.locator('.portal-status')).toHaveText('Terverifikasi');
  await page.getByRole('link', { name: /kembali ke index legionum/i }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /ekspor csv/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^jrc-xiv-pendaftaran-\d{4}-\d{2}-\d{2}\.csv$/);
});

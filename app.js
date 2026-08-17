const menuButton = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('.mobile-menu');
const dialog = document.querySelector('.registration-dialog');
const form = document.querySelector('#registration-form');
const categoryField = form.querySelector('[name="category"]');
const status = form.querySelector('.form-status');
let scrollFrame = 0;

const dustCanvas = document.querySelector('.hero__dust');
const vfxCanvas = document.querySelector('.hero__vfx');
const heroScene = document.querySelector('.hero');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let dustFrame = 0;

function startHeroAtmosphere() {
  if (!dustCanvas || !vfxCanvas || !heroScene || reducedMotion) return;
  const context = dustCanvas.getContext('2d');
  const vfxContext = vfxCanvas.getContext('2d');
  if (!context || !vfxContext) return;
  const composite = heroScene.querySelector('.scene__composite');
  const crowd = heroScene.querySelector('.festival-crowd');
  const banners = [...heroScene.querySelectorAll('.festival-banners')];
  const torches = [...heroScene.querySelectorAll('.festival-torches')];
  const confetti = heroScene.querySelector('.festival-confetti');
  const titleAura = heroScene.querySelector('.title-aura');
  const arenaFestival = document.querySelector('.arena-festival');
  const particles = [];
  const motes = [];
  const sparks = [];
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const getDensity = () => window.innerWidth <= 760
    ? 26
    : Math.min(55, Math.max(35, Math.round(window.innerWidth / 25)));
  const getMoteDensity = () => window.innerWidth <= 760 ? 14 : 28;
  const updatePointerParallax = (point) => {
    heroScene.style.setProperty('--festival-parallax-x', `${pointer.x * .018}px`);
    heroScene.style.setProperty('--festival-parallax-y', `${pointer.y * .012}px`);
    heroScene.style.setProperty('--festival-wind', `${pointer.x * .025}px`);
    if (crowd) crowd.style.setProperty('--crowd-flicker', `${.88 + Math.sin(performance.now() * .002) * .06}`);
    banners.forEach((banner, index) => banner.style.setProperty('--banner-offset', `${pointer.x * (.008 + index * .003)}px`));
    torches.forEach((torch, index) => torch.style.setProperty('--torch-flicker', `${.88 + Math.sin(performance.now() * (.004 + index * .0005)) * .08}`));
  };
  const updateScrollEnergy = () => {
    const depth = Math.min(1, (window.scrollY || 0) / Math.max(1, heroScene.clientHeight * .8));
    heroScene.style.setProperty('--festival-scroll', depth.toFixed(3));
    if (arenaFestival) arenaFestival.style.setProperty('--arena-scroll', depth.toFixed(3));
  };
  const updateCrowdFlicker = (time) => {
    if (!crowd) return;
    crowd.style.opacity = `${.44 + Math.sin(time * 1.7) * .03}`;
  };
  const updateBannerWind = (time) => {
    banners.forEach((banner, index) => {
      banner.style.setProperty('--banner-wave', `${Math.sin(time * (.65 + index * .08) + index) * 1.8}deg`);
    });
  };
  const updateTorchFire = (time) => {
    torches.forEach((torch, index) => {
      torch.style.setProperty('--fire-pulse', `${1 + Math.sin(time * (2.1 + index * .18)) * .025}`);
    });
  };
  const updateSmokePlumes = (time) => {
    heroScene.style.setProperty('--smoke-drift', `${Math.sin(time * .22) * 10}px`);
  };
  const updateGroundDebris = (time) => {
    heroScene.style.setProperty('--debris-drift', `${Math.sin(time * .9) * 6}px`);
  };
  const updateTitleOrbit = (time) => {
    if (titleAura) titleAura.style.setProperty('--title-pulse', `${.92 + Math.sin(time * .8) * .08}`);
  };
  const updateKnightImpact = (time, proximity) => {
    heroScene.style.setProperty('--impact-pulse', `${.94 + Math.sin(time * 2.8) * .06 + proximity * .08}`);
  };
  const updateSectionAtmosphere = (time) => {
    if (confetti) confetti.style.setProperty('--confetti-drift', `${Math.sin(time * .25) * 1.5}deg`);
  };
  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    dustCanvas.width = Math.round(heroScene.clientWidth * ratio);
    dustCanvas.height = Math.round(heroScene.clientHeight * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    vfxCanvas.width = Math.round(heroScene.clientWidth * ratio);
    vfxCanvas.height = Math.round(heroScene.clientHeight * ratio);
    vfxContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  const getCompositePoint = () => {
    if (!composite || !composite.naturalWidth) return { footX: heroScene.clientWidth * .72, footY: heroScene.clientHeight * .84, emblemX: heroScene.clientWidth * .68, emblemY: heroScene.clientHeight * .46 };
    const bounds = composite.getBoundingClientRect();
    const sceneBounds = heroScene.getBoundingClientRect();
    const footX = bounds.left - sceneBounds.left + bounds.width * .73;
    const footY = bounds.top - sceneBounds.top + bounds.height * .77;
    return {
      // batu-knight.png is a single 1440 × 1173 composition. These anchors
      // track the painted knight inside that bitmap instead of guessing from
      // the viewport, so the canvas effects stay attached after resize/crop.
      footX: Math.max(24, Math.min(sceneBounds.width - 24, footX)),
      footY: Math.max(24, Math.min(sceneBounds.height - 18, footY)),
      emblemX: Math.max(24, Math.min(sceneBounds.width - 24, bounds.left - sceneBounds.left + bounds.width * .73)),
      emblemY: Math.max(24, Math.min(sceneBounds.height - 24, bounds.top - sceneBounds.top + bounds.height * .43)),
    };
  };
  const seed = () => {
    particles.length = 0;
    motes.length = 0;
    sparks.length = 0;
    const point = getCompositePoint();
    for (let index = 0; index < getDensity(); index += 1) {
      const orbit = Math.random() * Math.PI * 2;
      const radius = 20 + Math.random() * 145;
      particles.push({
        x: point.footX + Math.cos(orbit) * radius,
        y: point.footY - Math.random() * 145 + Math.sin(orbit) * radius * .18,
        radius: .35 + Math.random() * 1.65,
        speed: .12 + Math.random() * .38,
        drift: (Math.random() - .5) * .18,
        orbit,
        orbitSpeed: (.001 + Math.random() * .003) * (Math.random() > .5 ? 1 : -1),
        orbitRadius: radius,
        lift: .12 + Math.random() * .42,
        ember: Math.random() > .76,
        alpha: .16 + Math.random() * .5,
      });
    }
    for (let index = 0; index < getMoteDensity(); index += 1) {
      motes.push({
        x: Math.random() * heroScene.clientWidth,
        y: heroScene.clientHeight * (.28 + Math.random() * .62),
        radius: .25 + Math.random() * 1.1,
        speed: .08 + Math.random() * .2,
        phase: Math.random() * Math.PI * 2,
        alpha: .08 + Math.random() * .24,
      });
    }
    for (let index = 0; index < (window.innerWidth <= 760 ? 8 : 18); index += 1) {
      sparks.push({
        x: point.footX + (Math.random() - .5) * 160,
        y: point.footY - Math.random() * 70,
        length: 7 + Math.random() * 18,
        speed: .25 + Math.random() * .55,
        phase: Math.random() * Math.PI * 2,
        alpha: .15 + Math.random() * .35,
      });
    }
  };
  const render = (timestamp = 0) => {
    const width = heroScene.clientWidth;
    const height = heroScene.clientHeight;
    const time = timestamp * .001;
    context.clearRect(0, 0, width, height);
    vfxContext.clearRect(0, 0, width, height);
    pointer.x += (pointer.tx - pointer.x) * .035;
    pointer.y += (pointer.ty - pointer.y) * .035;
    const point = getCompositePoint();
    const pointerDistance = Math.hypot(pointer.x - (point.emblemX - width / 2), pointer.y - (point.emblemY - height / 2));
    const proximity = Math.max(0, 1 - pointerDistance / 260);
    const scrollForce = Math.min(1, (window.scrollY || 0) / Math.max(1, height * .8));
    updatePointerParallax(point);
    updateScrollEnergy();
    updateCrowdFlicker(time);
    updateBannerWind(time);
    updateTorchFire(time);
    updateSmokePlumes(time);
    updateGroundDebris(time);
    updateTitleOrbit(time);
    updateKnightImpact(time, proximity);
    updateSectionAtmosphere(time);
    heroScene.style.setProperty('--pointer-x', `${pointer.x}px`);
    heroScene.style.setProperty('--pointer-y', `${pointer.y}px`);
    heroScene.style.setProperty('--knight-foot-x', `${point.footX}px`);
    heroScene.style.setProperty('--knight-foot-y', `${point.footY}px`);
    heroScene.style.setProperty('--knight-emblem-x', `${point.emblemX}px`);
    heroScene.style.setProperty('--knight-emblem-y', `${point.emblemY}px`);
    heroScene.style.setProperty('--emblem-proximity', proximity.toFixed(3));
    heroScene.style.setProperty('--energy-drift', `${Math.round((window.scrollY || 0) * .018)}px`);

    const aura = vfxContext.createRadialGradient(point.footX, point.footY - 8, 0, point.footX, point.footY - 8, Math.max(110, width * .14));
    aura.addColorStop(0, `rgba(240, 183, 71, ${.11 + proximity * .1})`);
    aura.addColorStop(.28, 'rgba(166, 61, 29, .06)');
    aura.addColorStop(1, 'rgba(166, 61, 29, 0)');
    vfxContext.fillStyle = aura;
    vfxContext.beginPath();
    vfxContext.ellipse(point.footX, point.footY - 8, Math.max(110, width * .14), 74, 0, 0, Math.PI * 2);
    vfxContext.fill();

    vfxContext.save();
    vfxContext.globalCompositeOperation = 'screen';
    const pulse = .5 + Math.sin(time * 2.8) * .5;
    const pulseRadius = 38 + pulse * 20;
    vfxContext.strokeStyle = `rgba(255, 207, 109, ${.08 + pulse * .18 + proximity * .08})`;
    vfxContext.lineWidth = 1.2;
    vfxContext.beginPath();
    vfxContext.ellipse(point.footX, point.footY - 8, pulseRadius * 1.5, pulseRadius * .43, 0, 0, Math.PI * 2);
    vfxContext.stroke();
    vfxContext.strokeStyle = `rgba(146, 53, 27, ${.05 + pulse * .1})`;
    vfxContext.lineWidth = .7;
    vfxContext.beginPath();
    vfxContext.ellipse(point.footX, point.footY - 8, pulseRadius * 2.3, pulseRadius * .63, 0, 0, Math.PI * 2);
    vfxContext.stroke();
    vfxContext.restore();

    vfxContext.save();
    vfxContext.globalCompositeOperation = 'screen';
    vfxContext.lineCap = 'round';
    for (let ribbon = 0; ribbon < (window.innerWidth <= 760 ? 4 : 8); ribbon += 1) {
      const phase = time * (.38 + ribbon * .035) + ribbon * .9;
      const startX = point.footX - width * (.24 + (ribbon % 3) * .08);
      const endX = point.footX + width * (.17 + (ribbon % 2) * .14);
      const startY = point.footY - 6 + ribbon * 4 + Math.sin(phase) * 4 + scrollForce * 12;
      vfxContext.beginPath();
      vfxContext.moveTo(startX, startY);
      vfxContext.bezierCurveTo(
        point.footX - width * .1,
        startY - 25 - Math.sin(phase) * 12,
        point.footX + width * .06,
        startY + 20 + Math.cos(phase) * 12,
        endX,
        startY - 8,
      );
      vfxContext.strokeStyle = ribbon % 3 === 0
        ? `rgba(245, 196, 94, ${.12 + proximity * .1})`
        : `rgba(157, 58, 29, ${.08 + proximity * .05})`;
      vfxContext.lineWidth = 1.2 + (ribbon % 3) * .7;
      vfxContext.stroke();
    }
    for (let plume = 0; plume < 4; plume += 1) {
      const plumePhase = time * .5 + plume * 1.6;
      const plumeX = point.footX - 55 + plume * 34 + Math.sin(plumePhase) * 7;
      const plumeY = point.footY - 12 - Math.abs(Math.sin(plumePhase * .7)) * 58;
      vfxContext.strokeStyle = `rgba(255, 214, 132, ${.08 + Math.abs(Math.sin(plumePhase)) * .1})`;
      vfxContext.lineWidth = 2.2;
      vfxContext.beginPath();
      vfxContext.moveTo(plumeX, point.footY - 5);
      vfxContext.bezierCurveTo(plumeX - 15, point.footY - 32, plumeX + 14, plumeY + 18, plumeX + Math.sin(plumePhase) * 12, plumeY);
      vfxContext.stroke();
    }
    vfxContext.restore();

    vfxContext.save();
    vfxContext.globalCompositeOperation = 'screen';
    vfxContext.lineCap = 'round';
    const laneCount = window.innerWidth <= 760 ? 3 : 6;
    for (let lane = 0; lane < laneCount; lane += 1) {
      const lanePhase = time * (.26 + lane * .018) + lane * 1.45;
      const laneY = height * (.72 + lane * .038) + Math.sin(lanePhase) * (3 + lane * 1.4) + scrollForce * 14;
      const laneSpan = width * (.3 + lane * .08);
      vfxContext.beginPath();
      vfxContext.moveTo(point.footX - laneSpan, laneY);
      vfxContext.bezierCurveTo(
        point.footX - laneSpan * .45,
        laneY - 9 - Math.sin(lanePhase) * 7,
        point.footX + laneSpan * .25,
        laneY + 8 + Math.cos(lanePhase) * 8,
        point.footX + laneSpan,
        laneY - 3,
      );
      vfxContext.strokeStyle = lane % 3 === 0
        ? `rgba(239, 185, 79, ${.08 + proximity * .06})`
        : `rgba(172, 61, 30, ${.045 + proximity * .03})`;
      vfxContext.lineWidth = lane % 2 === 0 ? 1.4 : .7;
      vfxContext.stroke();
    }
    vfxContext.restore();

    vfxContext.save();
    vfxContext.translate(point.emblemX, point.emblemY);
    vfxContext.rotate(-time * .08);
    vfxContext.lineCap = 'round';
    for (let ring = 0; ring < 4; ring += 1) {
      const radiusX = 34 + ring * 11;
      const radiusY = 18 + ring * 6;
      vfxContext.beginPath();
      vfxContext.ellipse(0, 0, radiusX, radiusY, ring * .12, Math.PI * (.16 + ring * .24), Math.PI * (1.03 + ring * .24));
      vfxContext.strokeStyle = ring % 2 === 0
        ? `rgba(238, 188, 83, ${.13 + proximity * .12})`
        : `rgba(77, 143, 191, ${.09 + proximity * .08})`;
      vfxContext.lineWidth = ring === 0 ? 1.1 : .55;
      vfxContext.stroke();
    }
    vfxContext.restore();

    vfxContext.save();
    vfxContext.translate(point.emblemX, point.emblemY);
    vfxContext.rotate(time * .04);
    vfxContext.strokeStyle = `rgba(233, 186, 83, ${.08 + proximity * .12})`;
    vfxContext.lineWidth = 1;
    for (let arc = 0; arc < 3; arc += 1) {
      vfxContext.beginPath();
      vfxContext.arc(0, 0, 50 + arc * 13, Math.PI * (.16 + arc * .25), Math.PI * (1.18 + arc * .25));
      vfxContext.stroke();
    }
    vfxContext.restore();

    vfxContext.save();
    vfxContext.lineCap = 'round';
    for (const mote of motes) {
      mote.phase += .004;
      mote.x += mote.speed + Math.sin(mote.phase) * .08;
      mote.y += Math.cos(mote.phase * .8) * .07;
      if (mote.x > width + 6) mote.x = -6;
      if (mote.y > height * .94) mote.y = height * .28;
      vfxContext.fillStyle = `rgba(250, 219, 153, ${mote.alpha * (.78 + Math.sin(time * .8 + mote.phase) * .3)})`;
      vfxContext.beginPath();
      vfxContext.arc(mote.x + pointer.x * .012, mote.y + pointer.y * .008, mote.radius, 0, Math.PI * 2);
      vfxContext.fill();
    }
    for (const spark of sparks) {
      spark.phase += .035;
      spark.y -= spark.speed;
      spark.x += Math.sin(spark.phase) * .6;
      if (spark.y < point.footY - 130) {
        spark.x = point.footX + (Math.random() - .5) * 150;
        spark.y = point.footY - Math.random() * 25;
      }
      vfxContext.strokeStyle = `rgba(241, 185, 79, ${spark.alpha * (.55 + Math.sin(spark.phase) * .35)})`;
      vfxContext.lineWidth = .7;
      vfxContext.beginPath();
      vfxContext.moveTo(spark.x, spark.y);
      vfxContext.lineTo(spark.x - 1.5, spark.y - spark.length);
      vfxContext.stroke();
    }
    vfxContext.restore();

    for (const particle of particles) {
      particle.orbit += particle.orbitSpeed;
      particle.x += particle.speed + Math.cos(particle.orbit) * .18 + pointer.x * .002;
      particle.y -= particle.lift + (window.scrollY > 30 ? .06 : 0);
      particle.x += Math.cos(particle.orbit) * .12;
      if (particle.y < point.footY - 210 || particle.x > width + 8) {
        particle.x = point.footX + (Math.random() - .5) * 100;
        particle.y = point.footY - Math.random() * 12;
      }
      context.fillStyle = particle.ember
        ? `rgba(181, 66, 30, ${particle.alpha * .92})`
        : `rgba(246, 198, 98, ${particle.alpha * 1.18})`;
      if (particle.ember) {
        context.beginPath();
        context.moveTo(particle.x, particle.y);
        context.lineTo(particle.x - 1.8, particle.y + 2.8);
        context.strokeStyle = context.fillStyle;
        context.lineWidth = particle.radius;
        context.stroke();
      } else {
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = `rgba(246, 198, 98, ${particle.alpha * .28})`;
        context.lineWidth = .55;
        context.beginPath();
        context.moveTo(particle.x - particle.speed * 8, particle.y + particle.lift * 5);
        context.lineTo(particle.x, particle.y);
        context.stroke();
      }
    }
    dustFrame = window.requestAnimationFrame(render);
  };
  window.addEventListener('resize', () => { resize(); seed(); }, { passive: true });
  heroScene.addEventListener('pointermove', (event) => {
    const bounds = heroScene.getBoundingClientRect();
    pointer.tx = event.clientX - bounds.left - bounds.width / 2;
    pointer.ty = event.clientY - bounds.top - bounds.height / 2;
  }, { passive: true });
  heroScene.addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; }, { passive: true });
  if (composite && !composite.complete) composite.addEventListener('load', seed, { once: true });
  resize();
  seed();
  render();
}

startHeroAtmosphere();

function closeMenu() {
  menuButton?.setAttribute('aria-expanded', 'false');
  mobileMenu?.setAttribute('hidden', '');
}

// The threshold haze has one restrained scroll response: as the visitor
// crosses into the arena, the dust drifts a few pixels instead of becoming a
// generic reveal animation.
window.addEventListener('scroll', () => {
  if (scrollFrame) return;
  scrollFrame = window.requestAnimationFrame(() => {
    document.documentElement.style.setProperty('--scroll-depth', String(window.scrollY));
    scrollFrame = 0;
  });
}, { passive: true });

menuButton?.addEventListener('click', () => {
  const willOpen = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(willOpen));
  mobileMenu.toggleAttribute('hidden', !willOpen);
});

mobileMenu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

document.querySelectorAll('[data-open-registration]').forEach((button) => {
  button.addEventListener('click', () => {
    closeMenu();
    status.textContent = '';
    if (button.dataset.category) categoryField.value = button.dataset.category;
    dialog.showModal();
    dialog.querySelector('input')?.focus();
  });
});

document.querySelector('[data-close-registration]')?.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const leader = new FormData(form).get('leader').toString().trim().split(' ')[0];
  status.textContent = `Terima kasih, ${leader}. Minat pendaftaran timmu sudah dicatat.`;
  form.reset();
  categoryField.value = '';
});

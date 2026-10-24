/* CSS 3D controlado pelo scroll nativo. Sem loop contínuo ou sensores do aparelho. */
(() => {
    'use strict';
    const root = document.documentElement;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const mouse = matchMedia('(hover: hover) and (pointer: fine)');
    const scenes = [...document.querySelectorAll('[data-motion-scene]')];
    const grids = [...document.querySelectorAll('.nk-product-grid')];
    if (!scenes.length) return;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    let paused = false;
    try { paused = localStorage.getItem('nakachi-motion-paused') === 'true'; } catch { /* armazenamento opcional */ }
    let enabled = false;
    let frame = 0;
    let pointer = null;
    let lastPointerTarget = null;
    const visible = new Set();
    const watched = new Set();
    const animations = new Set();

    const controls = document.createElement('div');
    controls.className = 'nk-motion-controls';
    const hint = document.createElement('span');
    hint.className = 'nk-motion-hint';
    hint.textContent = 'Role e descubra seus sabores';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nk-motion-toggle';
    toggle.setAttribute('aria-label', 'Pausar efeitos de movimento');
    controls.append(hint, toggle);
    const anchor = document.querySelector('.nk-hero-actions') || document.querySelector('.nk-search');
    anchor?.after(controls);

    const progress = document.createElement('div');
    progress.className = 'nk-scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.append(progress);

    function schedule() {
        if (enabled && !document.hidden && !frame) frame = requestAnimationFrame(render);
    }

    function resetPointer(target) {
        if (!target) return;
        for (const property of ['--pointer-x', '--pointer-y', '--image-x', '--image-ry']) target.style.removeProperty(property);
    }

    function render() {
        frame = 0;
        if (!enabled || document.hidden) return;
        const height = window.innerHeight;
        const mobile = window.innerWidth <= 600;
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - height);
        const scrollProgress = clamp(window.scrollY / maxScroll, 0, 1);
        // Mede primeiro; aplica transformações depois para não intercalar leitura e layout.
        const scenePositions = scenes.map(element => ({ element, rect: element.getBoundingClientRect() }));
        const cards = [...visible].filter(element => element.isConnected).map(element => ({ element, rect: element.getBoundingClientRect() }));
        const pointerRect = pointer?.target.isConnected ? pointer.target.getBoundingClientRect() : null;
        progress.style.transform = `scaleX(${scrollProgress})`;
        for (const { element, rect } of scenePositions) {
            if (rect.bottom < -100 || rect.top > height + 100) continue;
            const phase = clamp((height / 2 - rect.top - rect.height / 2) / height, -1, 1);
            element.style.setProperty('--scene-y', `${phase * (mobile ? -22 : -42)}px`);
            element.style.setProperty('--scene-rx', `${phase * (mobile ? 14 : 20)}deg`);
            element.style.setProperty('--scene-ry', `${phase * (mobile ? -18 : -26)}deg`);
            element.style.setProperty('--scene-rz', `${phase * 5}deg`);
        }
        for (const { element, rect } of cards) {
            const phase = clamp((height / 2 - rect.top - rect.height / 2) / height, -.7, .7);
            element.style.setProperty('--image-y', `${phase * (mobile ? -12 : -22)}px`);
            element.style.setProperty('--image-rz', `${phase * 3}deg`);
        }
        if (pointerRect && pointer && mouse.matches) {
            const x = clamp((pointer.x - pointerRect.left) / pointerRect.width - .5, -.5, .5);
            const y = clamp((pointer.y - pointerRect.top) / pointerRect.height - .5, -.5, .5);
            if (pointer.target.matches('[data-motion-scene]')) {
                pointer.target.style.setProperty('--pointer-x', `${x * 12}deg`);
                pointer.target.style.setProperty('--pointer-y', `${-y * 10}deg`);
            } else {
                pointer.target.style.setProperty('--image-x', `${x * 9}px`);
                pointer.target.style.setProperty('--image-ry', `${x * 8}deg`);
            }
        }
    }

    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
        for (const entry of entries) {
            const card = entry.target;
            if (!entry.isIntersecting) { visible.delete(card); continue; }
            visible.add(card);
            if (!card.dataset.motionSeen) {
                card.dataset.motionSeen = 'true';
                if (enabled && !document.hidden && typeof card.animate === 'function') {
                    const animation = card.animate([
                        { transform: 'perspective(900px) translateY(22px) rotateX(7deg)', opacity: .75 },
                        { transform: 'perspective(900px) translateY(0) rotateX(0)', opacity: 1 },
                    ], { duration: 520, easing: 'cubic-bezier(.2,.65,.3,1)' });
                    animations.add(animation);
                    animation.onfinish = animation.oncancel = () => animations.delete(animation);
                }
            }
        }
        schedule();
    }, { threshold: .08 }) : null;

    function observeCards() {
        for (const card of watched) if (!card.isConnected) {
            visible.delete(card);
            watched.delete(card);
            observer?.unobserve(card);
        }
        grids.forEach(grid => grid.querySelectorAll('.nk-product').forEach(card => {
            if (watched.has(card)) return;
            watched.add(card);
            if (observer) observer.observe(card);
            else visible.add(card);
        }));
        schedule();
    }

    function updatePreference() {
        enabled = !paused && !reduced.matches;
        root.classList.toggle('nk-motion-enabled', enabled);
        toggle.disabled = reduced.matches;
        toggle.textContent = reduced.matches ? 'Movimento reduzido' : paused ? 'Ativar efeitos' : 'Pausar efeitos';
        toggle.setAttribute('aria-pressed', String(paused || reduced.matches));
        hint.hidden = !enabled;
        progress.hidden = !enabled;
        if (!enabled) {
            cancelAnimationFrame(frame);
            frame = 0;
            for (const animation of animations) animation.cancel();
            pointer = null;
            resetPointer(lastPointerTarget);
        } else schedule();
    }
    toggle.addEventListener('click', () => {
        paused = !paused;
        try { localStorage.setItem('nakachi-motion-paused', String(paused)); } catch { /* preferência apenas nesta página */ }
        updatePreference();
    });
    reduced.addEventListener('change', updatePreference);
    mouse.addEventListener('change', () => { pointer = null; resetPointer(lastPointerTarget); schedule(); });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
        else schedule();
    });
    document.addEventListener('pointermove', event => {
        if (!enabled || !mouse.matches || event.pointerType !== 'mouse') return;
        const target = event.target.closest('.nk-product, [data-motion-scene]');
        if (target !== lastPointerTarget) resetPointer(lastPointerTarget);
        lastPointerTarget = target;
        pointer = target ? { target, x: event.clientX, y: event.clientY } : null;
        schedule();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => {
        resetPointer(lastPointerTarget); pointer = null;
    });
    const changes = new MutationObserver(observeCards);
    grids.forEach(grid => changes.observe(grid, { childList: true }));
    updatePreference();
    observeCards();
})();

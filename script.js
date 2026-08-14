(function () {
    const LOAD_TIMEOUT_MS = 12000;
    const CRITICAL_IMAGES = [
        'images/bg-continiation2.png',
        'images/location.jpg',
        'images/hero2.png',
        'images/1.png',
        'images/2.png',
        'images/3.png',
        'images/4.png',
        'images/5.png',
    ];

    function loadImage(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = src;
        });
    }

    function waitForDomImages() {
        return Promise.all(
            Array.from(document.images).map((img) => {
                if (img.complete) return Promise.resolve();
                return new Promise((resolve) => {
                    img.addEventListener('load', resolve, { once: true });
                    img.addEventListener('error', resolve, { once: true });
                });
            })
        );
    }

    function waitForFonts() {
        if (!document.fonts || !document.fonts.ready) return Promise.resolve();
        return document.fonts.ready.then(
            () => undefined,
            () => undefined
        );
    }

    function waitForWindowLoad() {
        if (document.readyState === 'complete') return Promise.resolve();
        return new Promise((resolve) => {
            window.addEventListener('load', resolve, { once: true });
        });
    }

    function waitForAnimationFrame() {
        return new Promise((resolve) => {
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(resolve);
            });
        });
    }

    function withTimeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise((resolve) => {
                window.setTimeout(resolve, ms);
            }),
        ]);
    }

    /** Temporary: keep loader visible forever for design preview. */
    const KEEP_LOADER_FOREVER = false;

    function forceScrollTop() {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
        const scroller = document.querySelector('.page-scroll');
        if (!scroller) return;
        const prevBehavior = scroller.style.scrollBehavior;
        scroller.style.scrollBehavior = 'auto';
        scroller.scrollTop = 0;
        scroller.style.scrollBehavior = prevBehavior;
    }

    forceScrollTop();
    window.addEventListener('pageshow', forceScrollTop);
    window.addEventListener('beforeunload', forceScrollTop);

    function revealPage() {
        if (KEEP_LOADER_FOREVER) return;

        const root = document.documentElement;
        const loader = document.querySelector('.page-loader');

        forceScrollTop();
        root.classList.remove('is-loading');
        root.classList.add('is-ready');

        if (loader) {
            loader.setAttribute('aria-busy', 'false');
            const removeLoader = () => {
                if (loader.isConnected) loader.remove();
            };
            loader.addEventListener('transitionend', removeLoader, { once: true });
            window.setTimeout(removeLoader, 1000);
        }
    }

    const pageReady = withTimeout(
        Promise.all([
            waitForFonts(),
            waitForDomImages(),
            Promise.all(CRITICAL_IMAGES.map(loadImage)),
            waitForWindowLoad(),
        ]).then(waitForAnimationFrame),
        LOAD_TIMEOUT_MS
    ).then(revealPage);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealElements = document.querySelectorAll('.reveal');
    const snake = document.querySelector('.snake');
    const snakeItems = snake
        ? Array.from(snake.querySelectorAll('.snake-item'))
        : [];
    const locationSection = document.querySelector('.location');
    const scheduleSection = document.querySelector('.schedule');

    const SNAKE_DRAW_MS = 2800;
    const SNAKE_ITEM_FADE_MS = 650;
    /** Scroll lock ≈ draw + last-item fade; slightly under so unlock matches perceived end. */
    const SNAKE_LOCK_MS = 3300;
    /** Longest location expand transition (arc/details ≈ 2.15s). */
    const LOCATION_EXPAND_MS = 2050;
    /** Lock page scroll while gated animations (snake, location) play. */
    const SCROLL_LOCK_DURING_ANIMATION = true;
    const SCROLL_LOCK_KEYS = new Set([
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'PageUp',
        'PageDown',
        'Home',
        'End',
        ' ',
        'Spacebar',
    ]);

    let scrollLockCount = 0;
    let lockedScrollY = 0;
    let locationExpandedAt = null;
    let scheduleInView = false;
    let touchLastY = null;

    /** App scrollport — window itself does not scroll (iOS rubber-band fix). */
    const scrollRoot =
        document.querySelector('.page-scroll') || document.documentElement;
    const usesPageScroll = scrollRoot !== document.documentElement;

    function getScrollY() {
        if (usesPageScroll) return scrollRoot.scrollTop || 0;
        return window.scrollY || window.pageYOffset || 0;
    }

    function preventScrollEvent(event) {
        event.preventDefault();
    }

    function preventScrollKey(event) {
        if (!SCROLL_LOCK_KEYS.has(event.key)) return;
        event.preventDefault();
    }

    function getFocusEl(section, selector) {
        if (!section) return null;
        return section.querySelector(selector) || section;
    }

    function setScrollY(targetY) {
        const y = Math.max(0, Math.round(targetY));
        const prevBehavior = scrollRoot.style.scrollBehavior;
        scrollRoot.style.scrollBehavior = 'auto';
        if (usesPageScroll) {
            scrollRoot.scrollTop = y;
        } else {
            window.scrollTo(0, y);
        }
        scrollRoot.style.scrollBehavior = prevBehavior;
        return y;
    }

    function getScrollYToAlign(el, align) {
        const rect = el.getBoundingClientRect();
        const scrollY = getScrollY();
        const vh = window.innerHeight || 1;
        return Math.max(0, Math.round(rect.top + scrollY + rect.height / 2 - vh * align));
    }

    /** Scroll Y that frames el in the viewport: centered if it fits, else top-pinned. */
    function getScrollYToFrame(el) {
        if (!el) return getScrollY();
        const rect = el.getBoundingClientRect();
        const scrollY = getScrollY();
        const vh = window.innerHeight || 1;
        const top = rect.top + scrollY;
        const height = rect.height;
        if (height >= vh) {
            return Math.max(0, Math.round(top));
        }
        return Math.max(0, Math.round(top - (vh - height) / 2));
    }

    /** Layout top in document coords — ignores CSS transforms (e.g. .reveal). */
    function getOffsetTop(el) {
        let top = 0;
        for (let node = el; node; node = node.offsetParent) {
            top += node.offsetTop;
        }
        return top;
    }

    /**
     * Frame heading + expanded scene together when they fit; otherwise
     * park on the photo so the lock doesn't clip the circle.
     * Narrow: lock between photo-flush and extra air above the heading.
     * Wide: lock further down the page so the expanded scene sits higher.
     */
    function getLocationFrameY() {
        if (!locationSection) return getScrollY();

        const kicker = locationSection.querySelector('.location-heading');
        const stage = locationSection.querySelector('.location-stage');
        if (!stage) {
            return getScrollYToFrame(kicker || locationSection);
        }

        const vh = scrollRoot.clientHeight || window.innerHeight || 1;
        const narrow = (window.innerWidth || 0) <= 480;
        const kickerTop = kicker ? getOffsetTop(kicker) : getOffsetTop(stage);
        const topPad = narrow
            ? Math.round(Math.min(18, Math.max(6, vh * 0.02)))
            : Math.round(Math.min(20, Math.max(8, vh * 0.02)));
        const shift = narrow
            ? Math.round(Math.min(64, Math.max(32, vh * 0.07)))
            : Math.round(Math.min(288, Math.max(160, vh * 0.25)));

        if (narrow) {
            return Math.max(0, Math.round(kickerTop - topPad + shift));
        }

        // Wide: further down the page than a centered frame (not extra space above).
        return Math.max(0, Math.round(kickerTop - topPad + shift));
    }

    function normalizeWheelDeltaY(event) {
        let delta = event.deltaY;
        if (event.deltaMode === 1) delta *= 16;
        if (event.deltaMode === 2) delta *= window.innerHeight || 800;
        return delta;
    }

    function lockScroll(durationMs, scrollY) {
        if (!SCROLL_LOCK_DURING_ANIMATION || reduceMotion || durationMs <= 0) return;

        if (scrollLockCount === 0) {
            lockedScrollY =
                scrollY != null ? Math.max(0, Math.round(scrollY)) : getScrollY();
            if (Math.abs(getScrollY() - lockedScrollY) > 0.5) {
                setScrollY(lockedScrollY);
            }
            document.documentElement.classList.add('is-scroll-locked');
            window.addEventListener('wheel', preventScrollEvent, { passive: false });
            window.addEventListener('touchmove', preventScrollEvent, { passive: false });
            window.addEventListener('keydown', preventScrollKey, { passive: false });
        } else if (scrollY != null) {
            lockedScrollY = Math.max(0, Math.round(scrollY));
            setScrollY(lockedScrollY);
        }

        scrollLockCount += 1;

        window.setTimeout(() => {
            scrollLockCount = Math.max(0, scrollLockCount - 1);
            if (scrollLockCount > 0) return;

            document.documentElement.classList.remove('is-scroll-locked');
            window.removeEventListener('wheel', preventScrollEvent);
            window.removeEventListener('touchmove', preventScrollEvent);
            window.removeEventListener('keydown', preventScrollKey);
        }, durationMs);
    }

    function holdAt(scrollY) {
        if (scrollLockCount <= 0) return;
        if (Math.abs(getScrollY() - lockedScrollY) < 0.5) return;
        setScrollY(lockedScrollY);
    }

    function showSnakeInstant() {
        if (!snake) return;
        snake.classList.add('is-drawn');
        snakeItems.forEach((item) => item.classList.add('is-visible'));
    }

    function playSnake() {
        if (!snake || snake.dataset.played === '1') return;
        snake.dataset.played = '1';

        const focus = getFocusEl(scheduleSection, '.snake') || snake;
        const targetY = setScrollY(getScrollYToAlign(focus, 0.5));
        snake.classList.add('is-drawn');
        lockScroll(SNAKE_LOCK_MS, targetY);

        // Reveal nodes on the animation clock (rAF) so setTimeout bursts don't hitch the stroke.
        const pending = snakeItems
            .map((item) => ({
                item,
                atMs: (Number(item.dataset.at || 0) / 100) * SNAKE_DRAW_MS,
            }))
            .sort((a, b) => a.atMs - b.atMs);
        let next = 0;
        const startedAt = performance.now();

        const tick = (now) => {
            const elapsed = now - startedAt;
            while (next < pending.length && elapsed >= pending[next].atMs) {
                pending[next].item.classList.add('is-visible');
                next += 1;
            }
            if (next < pending.length) {
                window.requestAnimationFrame(tick);
            }
        };

        window.requestAnimationFrame(tick);
    }

    function expandLocation(el, presetY) {
        if (!el || el.classList.contains('is-expanded')) return;

        el.classList.add('is-expanded');

        if (!reduceMotion) {
            const targetY =
                presetY != null
                    ? Math.max(0, Math.round(presetY))
                    : getLocationFrameY();
            // Avoid a second scrollTo when the gate already parked us here.
            if (Math.abs(getScrollY() - targetY) > 0.5) {
                setScrollY(targetY);
            }
            lockScroll(LOCATION_EXPAND_MS, targetY);
            if (locationExpandedAt === null) {
                locationExpandedAt = targetY;
            }
        } else if (locationExpandedAt === null) {
            locationExpandedAt = getScrollY();
        }

        revealSchedule();
    }

    function getActiveGate() {
        if (
            locationSection &&
            !locationSection.classList.contains('is-expanded')
        ) {
            return {
                y: getLocationFrameY(),
                activate: (y) => expandLocation(locationSection, y),
            };
        }

        if (
            scheduleSection &&
            scheduleSection.classList.contains('is-visible') &&
            locationExpandedAt !== null &&
            snake &&
            snake.dataset.played !== '1'
        ) {
            const focus = getFocusEl(scheduleSection, '.snake');
            return {
                y: getScrollYToAlign(focus, 0.5),
                activate: () => playSnake(),
            };
        }

        return null;
    }

    function settleGate(gate) {
        const targetY = setScrollY(gate.y);
        gate.activate();
        if (scrollLockCount > 0) lockedScrollY = targetY;
        return true;
    }

    /**
     * Stop downward scroll at the next animation gate.
     * Uses only the remaining distance to the gate — no snap-back from afar.
     */
    function consumeDownwardGate(deltaY, prevent) {
        if (reduceMotion || scrollLockCount > 0 || !(deltaY > 0)) return false;

        const gate = getActiveGate();
        if (!gate) return false;

        const scrollY = getScrollY();
        // Only the tick that would cross the gate — remaining distance stays small.
        if (scrollY + deltaY < gate.y - 0.5) return false;

        prevent();
        return settleGate(gate);
    }

    /** Sync clamp for scrollbar / leftover inertia (no rAF delay). */
    function enforceGateOnScroll() {
        if (reduceMotion) return;

        if (scrollLockCount > 0) {
            holdAt(lockedScrollY);
            return;
        }

        const gate = getActiveGate();
        if (!gate) return;
        if (getScrollY() + 1 < gate.y) return;
        settleGate(gate);
    }

    function onGateWheel(event) {
        if (scrollLockCount > 0) {
            event.preventDefault();
            return;
        }
        consumeDownwardGate(normalizeWheelDeltaY(event), () => {
            event.preventDefault();
        });
    }

    function onGateTouchStart(event) {
        if (!event.touches || !event.touches.length) return;
        touchLastY = event.touches[0].clientY;
    }

    function onGateTouchMove(event) {
        if (scrollLockCount > 0) {
            event.preventDefault();
            return;
        }
        if (!event.touches || !event.touches.length || touchLastY == null) return;

        const y = event.touches[0].clientY;
        const deltaY = touchLastY - y;
        touchLastY = y;

        consumeDownwardGate(deltaY, () => {
            event.preventDefault();
        });
    }

    function onGateTouchEnd() {
        touchLastY = null;
    }

    function onGateKeyDown(event) {
        if (scrollLockCount > 0) {
            if (SCROLL_LOCK_KEYS.has(event.key)) event.preventDefault();
            return;
        }

        const downKeys = new Set(['ArrowDown', 'PageDown', ' ', 'Spacebar']);
        if (!downKeys.has(event.key)) return;

        const vh = window.innerHeight || 800;
        const delta =
            event.key === 'PageDown' || event.key === ' ' || event.key === 'Spacebar'
                ? vh * 0.9
                : 48;

        consumeDownwardGate(delta, () => {
            event.preventDefault();
        });
    }

    function tryPlaySnake() {
        if (!scheduleSection || !scheduleSection.classList.contains('is-visible')) return;
        if (locationExpandedAt === null) return;
        if (scrollLockCount > 0) return;
        if (snake && snake.dataset.played === '1') return;

        const focus = getFocusEl(scheduleSection, '.snake');
        const gateY = getScrollYToAlign(focus, 0.5);
        if (getScrollY() + 1 < gateY) return;
        playSnake();
    }

    function revealSchedule() {
        if (!scheduleSection || scheduleSection.classList.contains('is-visible')) return;
        if (!scheduleInView || locationExpandedAt === null) return;
        scheduleSection.classList.add('is-visible');
        tryPlaySnake();
    }

    function updateLocationExpand() {
        if (!locationSection || reduceMotion) return;
        if (locationSection.classList.contains('is-expanded')) return;

        const targetY = getLocationFrameY();
        // Safety net for scrollbar / residual momentum — gate handlers cover wheel/touch.
        if (getScrollY() + 1 < targetY) return;
        expandLocation(locationSection);
    }

    function startInteractions() {
        if (reduceMotion) {
            revealElements.forEach((el) => {
                el.classList.add('is-visible');
                if (el.classList.contains('location')) {
                    expandLocation(el);
                }
            });
            showSnakeInstant();
        } else {
            const observer = new IntersectionObserver(
                (entries, obs) => {
                    entries.forEach((entry) => {
                        if (!entry.isIntersecting) return;

                        const el = entry.target;

                        if (el.classList.contains('schedule')) {
                            scheduleInView = true;
                            revealSchedule();
                            obs.unobserve(el);
                            return;
                        }

                        if (el.classList.contains('location')) {
                            el.classList.add('is-visible');
                            obs.unobserve(el);
                            return;
                        }

                        el.classList.add('is-visible');
                        obs.unobserve(el);
                    });
                },
                {
                    root: usesPageScroll ? scrollRoot : null,
                    threshold: 0.16,
                    rootMargin: '0px 0px -6% 0px',
                }
            );

            revealElements.forEach((el) => observer.observe(el));

            let expandRaf = 0;
            const onScroll = () => {
                // Immediate clamp — critical for touch/trackpad inertia.
                enforceGateOnScroll();
                if (expandRaf) return;
                expandRaf = window.requestAnimationFrame(() => {
                    expandRaf = 0;
                    if (scrollLockCount > 0) {
                        holdAt(lockedScrollY);
                        return;
                    }
                    updateLocationExpand();
                    revealSchedule();
                    tryPlaySnake();
                });
            };

            const onResize = () => {
                if (expandRaf) return;
                expandRaf = window.requestAnimationFrame(() => {
                    expandRaf = 0;
                    if (scrollLockCount > 0) {
                        holdAt(lockedScrollY);
                        return;
                    }
                    updateLocationExpand();
                    revealSchedule();
                    tryPlaySnake();
                });
            };

            scrollRoot.addEventListener('scroll', onScroll, { passive: true });
            window.addEventListener('resize', onResize);

            // Non-passive gates: catch the tick that would cross the animation point.
            window.addEventListener('wheel', onGateWheel, { passive: false });
            window.addEventListener('touchstart', onGateTouchStart, { passive: true });
            window.addEventListener('touchmove', onGateTouchMove, { passive: false });
            window.addEventListener('touchend', onGateTouchEnd, { passive: true });
            window.addEventListener('touchcancel', onGateTouchEnd, { passive: true });
            window.addEventListener('keydown', onGateKeyDown, { passive: false });

            updateLocationExpand();
        }

        const target = new Date('2026-05-15T00:00:00').getTime();
        const daysEl = document.getElementById('days');
        const hoursEl = document.getElementById('hours');
        const minutesEl = document.getElementById('minutes');
        const secondsEl = document.getElementById('seconds');

        document.querySelectorAll('[data-gallery]').forEach((gallery) => {
            const track = gallery.querySelector('.dresscode-gallery-track');
            const originalSlides = Array.from(gallery.querySelectorAll('.dresscode-gallery-slide'));
            const prevBtn = gallery.querySelector('.dresscode-gallery-btn--prev');
            const nextBtn = gallery.querySelector('.dresscode-gallery-btn--next');
            if (!track || originalSlides.length < 2) return;

            const firstClone = originalSlides[0].cloneNode(true);
            const lastClone = originalSlides[originalSlides.length - 1].cloneNode(true);
            [firstClone, lastClone].forEach((clone) => {
                clone.classList.remove('is-active');
                clone.setAttribute('aria-hidden', 'true');
            });
            track.appendChild(firstClone);
            track.insertBefore(lastClone, track.firstElementChild);

            const slides = Array.from(track.querySelectorAll('.dresscode-gallery-slide'));
            const realCount = originalSlides.length;
            let index = 1;
            let startX = 0;
            let deltaX = 0;
            let dragging = false;
            let width = gallery.clientWidth || 1;
            let wrapTimer = 0;
            let wrapHandler = null;

            function render(offsetPx) {
                const base = -index * 100;
                const dragPct = width ? (offsetPx / width) * 100 : 0;
                track.style.transform = `translate3d(${base + dragPct}%, 0, 0)`;
                slides.forEach((slide, i) => {
                    slide.classList.toggle('is-active', i === index);
                });
            }

            function jumpTo(nextIndex) {
                gallery.classList.add('is-jumping');
                index = nextIndex;
                render(0);
                void track.offsetWidth;
                gallery.classList.remove('is-jumping');
            }

            function snapIfClone() {
                if (index === 0) {
                    jumpTo(realCount);
                    return true;
                }
                if (index === realCount + 1) {
                    jumpTo(1);
                    return true;
                }
                return false;
            }

            function clearWrapWatch() {
                if (wrapHandler) {
                    track.removeEventListener('transitionend', wrapHandler);
                    wrapHandler = null;
                }
                clearTimeout(wrapTimer);
            }

            function scheduleSnap() {
                clearWrapWatch();
                if (index !== 0 && index !== realCount + 1) return;

                const snap = () => {
                    clearWrapWatch();
                    snapIfClone();
                };
                wrapHandler = (event) => {
                    if (event.target !== track || event.propertyName !== 'transform') return;
                    snap();
                };
                track.addEventListener('transitionend', wrapHandler);
                wrapTimer = setTimeout(snap, 500);
            }

            function goTo(next) {
                const from = index;
                snapIfClone();
                index += next - from;
                deltaX = 0;
                gallery.classList.remove('is-dragging');
                render(0);
                scheduleSnap();
            }

            function onPointerDown(event) {
                if (event.target.closest('.dresscode-gallery-btn')) return;
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                snapIfClone();
                dragging = true;
                startX = event.clientX;
                deltaX = 0;
                width = gallery.clientWidth || 1;
                gallery.classList.add('is-dragging');
                gallery.setPointerCapture(event.pointerId);
            }

            function onPointerMove(event) {
                if (!dragging) return;
                deltaX = event.clientX - startX;
                render(deltaX);
            }

            function onPointerUp(event) {
                if (!dragging) return;
                dragging = false;
                gallery.classList.remove('is-dragging');
                try {
                    gallery.releasePointerCapture(event.pointerId);
                } catch (_) {
                    /* already released */
                }

                const threshold = Math.min(72, width * 0.18);
                if (deltaX <= -threshold) goTo(index + 1);
                else if (deltaX >= threshold) goTo(index - 1);
                else goTo(index);
            }

            gallery.addEventListener('pointerdown', onPointerDown);
            gallery.addEventListener('pointermove', onPointerMove);
            gallery.addEventListener('pointerup', onPointerUp);
            gallery.addEventListener('pointercancel', onPointerUp);

            if (prevBtn) {
                prevBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    goTo(index - 1);
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    goTo(index + 1);
                });
            }

            gallery.classList.add('is-jumping');
            render(0);
            void track.offsetWidth;
            gallery.classList.remove('is-jumping');
        });

        if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

        function updateCountdown() {
            let diff = target - Date.now();
            if (diff < 0) diff = 0;

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            daysEl.textContent = String(days).padStart(2, '0');
            hoursEl.textContent = String(hours).padStart(2, '0');
            minutesEl.textContent = String(minutes).padStart(2, '0');
            secondsEl.textContent = String(seconds).padStart(2, '0');
        }

        updateCountdown();
        setInterval(updateCountdown, 1000);
    }

    function initAutoResizeTextareas() {
        const fields = document.querySelectorAll('textarea[data-auto-resize]');
        if (!fields.length) return;

        function resize(el) {
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
        }

        fields.forEach((el) => {
            resize(el);
            el.addEventListener('input', () => resize(el));
        });

        window.addEventListener('resize', () => {
            fields.forEach(resize);
        });
    }

    pageReady.then(() => {
        startInteractions();
        initAutoResizeTextareas();
    });
})();

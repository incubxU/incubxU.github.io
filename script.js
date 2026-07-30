(function () {
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
    /** Longest location expand transition (arc/details ≈ 2.15s). */
    const LOCATION_EXPAND_MS = 2200;
    const CENTER_BAND = 0.12;
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

    function getScrollYToAlign(el, align) {
        const rect = el.getBoundingClientRect();
        const scrollY = window.scrollY || window.pageYOffset || 0;
        const vh = window.innerHeight || 1;
        return Math.max(0, Math.round(rect.top + scrollY + rect.height / 2 - vh * align));
    }

    function hasReachedAlign(el, align) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const center = rect.top + rect.height / 2;
        return center <= vh * align + vh * CENTER_BAND;
    }

    function snapToAlign(el, align) {
        const targetY = getScrollYToAlign(el, align);
        const html = document.documentElement;
        const prevBehavior = html.style.scrollBehavior;
        html.style.scrollBehavior = 'auto';
        window.scrollTo(0, targetY);
        html.style.scrollBehavior = prevBehavior;
        return targetY;
    }

    /** Scroll Y that frames el in the viewport: centered if it fits, else top-pinned. */
    function getScrollYToFrame(el) {
        if (!el) return window.scrollY || window.pageYOffset || 0;
        const rect = el.getBoundingClientRect();
        const scrollY = window.scrollY || window.pageYOffset || 0;
        const vh = window.innerHeight || 1;
        const top = rect.top + scrollY;
        const height = rect.height;
        if (height >= vh) {
            return Math.max(0, Math.round(top));
        }
        return Math.max(0, Math.round(top - (vh - height) / 2));
    }

    function snapToScrollY(targetY) {
        const html = document.documentElement;
        const prevBehavior = html.style.scrollBehavior;
        html.style.scrollBehavior = 'auto';
        window.scrollTo(0, targetY);
        html.style.scrollBehavior = prevBehavior;
        return targetY;
    }

    function lockScroll(durationMs, scrollY) {
        if (reduceMotion || durationMs <= 0) return;

        if (scrollLockCount === 0) {
            lockedScrollY =
                scrollY != null ? scrollY : window.scrollY || window.pageYOffset || 0;
            if (scrollY != null) {
                const html = document.documentElement;
                const prevBehavior = html.style.scrollBehavior;
                html.style.scrollBehavior = 'auto';
                window.scrollTo(0, lockedScrollY);
                html.style.scrollBehavior = prevBehavior;
            }
            document.documentElement.classList.add('is-scroll-locked');
            window.addEventListener('wheel', preventScrollEvent, { passive: false });
            window.addEventListener('touchmove', preventScrollEvent, { passive: false });
            window.addEventListener('keydown', preventScrollKey, { passive: false });
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

    function showSnakeInstant() {
        if (!snake) return;
        snake.classList.add('is-drawn');
        snakeItems.forEach((item) => item.classList.add('is-visible'));
    }

    function playSnake() {
        if (!snake || snake.dataset.played === '1') return;
        snake.dataset.played = '1';

        const focus = getFocusEl(scheduleSection, '.snake') || snake;
        const targetY = snapToAlign(focus, 0.5);
        snake.classList.add('is-drawn');
        lockScroll(SNAKE_DRAW_MS + SNAKE_ITEM_FADE_MS, targetY);

        snakeItems.forEach((item) => {
            const at = Number(item.dataset.at || 0);
            const delay = (at / 100) * SNAKE_DRAW_MS;

            window.setTimeout(() => {
                item.classList.add('is-visible');
            }, delay);
        });
    }

    function tryPlaySnake() {
        if (!scheduleSection || !scheduleSection.classList.contains('is-visible')) return;
        if (locationExpandedAt === null) return;
        if (scrollLockCount > 0) return;
        if (snake && snake.dataset.played === '1') return;

        const focus = getFocusEl(scheduleSection, '.snake');
        if (!hasReachedAlign(focus, 0.5)) return;
        playSnake();
    }

    function revealSchedule() {
        if (!scheduleSection || scheduleSection.classList.contains('is-visible')) return;
        if (!scheduleInView || locationExpandedAt === null) return;
        scheduleSection.classList.add('is-visible');
        tryPlaySnake();
    }

    function expandLocation(el) {
        if (!el || el.classList.contains('is-expanded')) return;

        el.classList.add('is-expanded');

        if (!reduceMotion) {
            const focus = getFocusEl(el, '.location-stage');
            // Frame the stage (not the padded section) so the top stays visible.
            const targetY = snapToScrollY(getScrollYToFrame(focus));
            lockScroll(LOCATION_EXPAND_MS, targetY);
            if (locationExpandedAt === null) {
                locationExpandedAt = targetY;
            }
        } else if (locationExpandedAt === null) {
            locationExpandedAt = window.scrollY || window.pageYOffset || 0;
        }

        revealSchedule();
    }

    function updateLocationExpand() {
        if (!locationSection || reduceMotion) return;
        if (locationSection.classList.contains('is-expanded')) return;

        const focus = getFocusEl(locationSection, '.location-stage');
        const targetY = getScrollYToFrame(focus);
        const scrollY = window.scrollY || window.pageYOffset || 0;
        // Start only once the stage is already at the frame position — no big jump.
        if (scrollY + 1 < targetY) return;
        expandLocation(locationSection);
    }

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
                threshold: 0.16,
                rootMargin: '0px 0px -6% 0px',
            }
        );

        revealElements.forEach((el) => observer.observe(el));

        let expandRaf = 0;
        const onScrollOrResize = () => {
            if (expandRaf) return;
            expandRaf = window.requestAnimationFrame(() => {
                expandRaf = 0;
                updateLocationExpand();
                revealSchedule();
                tryPlaySnake();
            });
        };

        window.addEventListener('scroll', onScrollOrResize, { passive: true });
        window.addEventListener('resize', onScrollOrResize);
        updateLocationExpand();
    }

    const target = new Date('2026-05-15T00:00:00').getTime();
    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');

    document.querySelectorAll('[data-gallery]').forEach((gallery) => {
        const track = gallery.querySelector('.dresscode-gallery-track');
        const slides = Array.from(gallery.querySelectorAll('.dresscode-gallery-slide'));
        const prevBtn = gallery.querySelector('.dresscode-gallery-btn--prev');
        const nextBtn = gallery.querySelector('.dresscode-gallery-btn--next');
        if (!track || slides.length < 2) return;

        let index = 0;
        let startX = 0;
        let deltaX = 0;
        let dragging = false;
        let width = gallery.clientWidth || 1;

        function render(offsetPx) {
            const base = -index * 100;
            const dragPct = width ? (offsetPx / width) * 100 : 0;
            track.style.transform = `translate3d(${base + dragPct}%, 0, 0)`;
            slides.forEach((slide, i) => {
                slide.classList.toggle('is-active', i === index);
            });
        }

        function goTo(next) {
            const total = slides.length;
            index = ((next % total) + total) % total;
            deltaX = 0;
            gallery.classList.remove('is-dragging');
            render(0);
        }

        function onPointerDown(event) {
            if (event.target.closest('.dresscode-gallery-btn')) return;
            if (event.pointerType === 'mouse' && event.button !== 0) return;
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

        render(0);
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
})();

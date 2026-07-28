(function () {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealElements = document.querySelectorAll('.reveal');
    const snake = document.querySelector('.snake');
    const snakeItems = snake
        ? Array.from(snake.querySelectorAll('.snake-item'))
        : [];
    const locationSection = document.querySelector('.location');
    const scheduleSection = document.querySelector('.schedule');

    function showSnakeInstant() {
        if (!snake) return;
        snake.classList.add('is-drawn');
        snakeItems.forEach((item) => item.classList.add('is-visible'));
    }

    function playSnake() {
        if (!snake || snake.dataset.played === '1') return;
        snake.dataset.played = '1';
        snake.classList.add('is-drawn');

        const durationMs = 2800;

        snakeItems.forEach((item) => {
            const at = Number(item.dataset.at || 0);
            const delay = (at / 100) * durationMs;

            window.setTimeout(() => {
                item.classList.add('is-visible');
            }, delay);
        });
    }

    let locationExpandedAt = null;
    let scheduleInView = false;
    const SNAKE_SCROLL_AFTER_EXPAND = 160;

    function tryPlaySnake() {
        if (!scheduleSection || !scheduleSection.classList.contains('is-visible')) return;
        if (locationExpandedAt === null) return;
        const scrollY = window.scrollY || window.pageYOffset || 0;
        if (scrollY < locationExpandedAt + SNAKE_SCROLL_AFTER_EXPAND) return;
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
        if (locationExpandedAt === null) {
            locationExpandedAt = window.scrollY || window.pageYOffset || 0;
        }
        revealSchedule();
    }

    function updateLocationExpand() {
        if (!locationSection || reduceMotion) return;

        const rect = locationSection.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const start = vh * 0.48;
        const end = vh * 0.18;
        let progress = (start - rect.top) / (start - end);
        progress = Math.max(0, Math.min(1, progress));

        if (progress >= 0.55) {
            expandLocation(locationSection);
        }
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

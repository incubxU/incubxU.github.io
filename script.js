(function () {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealElements = document.querySelectorAll('.reveal');
    const snake = document.querySelector('.snake');
    const snakeItems = snake
        ? Array.from(snake.querySelectorAll('.snake-item'))
        : [];

    function showSnakeInstant() {
        if (!snake) return;
        snake.classList.add('is-drawn');
        snakeItems.forEach((item) => item.classList.add('is-visible'));
    }

    function playSnake() {
        if (!snake || snake.dataset.played === '1') return;
        snake.dataset.played = '1';
        snake.classList.add('is-drawn');

        const durationMs = 2400;

        snakeItems.forEach((item) => {
            const at = Number(item.dataset.at || 0);
            const delay = (at / 100) * durationMs;

            window.setTimeout(() => {
                item.classList.add('is-visible');
            }, delay);
        });
    }

    function expandLocation(el) {
        if (!el || el.classList.contains('is-expanded')) return;
        el.classList.add('is-expanded');
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
                        el.classList.add('is-visible');
                        playSnake();
                        obs.unobserve(el);
                        return;
                    }

                    if (el.classList.contains('location')) {
                        el.classList.add('is-visible');
                        window.setTimeout(() => expandLocation(el), 420);
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

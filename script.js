(function () {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealElements = document.querySelectorAll('.reveal');
    const snake = document.querySelector('.snake');
    const snakeLine = snake && snake.querySelector('.snake-line');
    const snakeItems = snake
        ? Array.from(snake.querySelectorAll('.snake-item'))
        : [];
    const locationSection = document.querySelector('.location');
    const locationPhoto = document.querySelector('.location-photo');

    let snakeProgressMax = 0;
    let snakeCompleteScheduled = false;
    let dresscodePending = false;
    let dresscodeUnlocked = false;
    const dresscodeSection = document.querySelector('.dresscode');
    const AFTER_SNAKE_DELAY_MS = 700;

    function tryRevealDresscode() {
        if (!dresscodeSection || !dresscodeUnlocked || !dresscodePending) return;
        if (dresscodeSection.classList.contains('is-visible')) return;
        dresscodeSection.classList.add('is-visible');
    }

    function scheduleDresscodeAfterSnake() {
        if (snakeCompleteScheduled) return;
        snakeCompleteScheduled = true;
        window.setTimeout(() => {
            dresscodeUnlocked = true;
            tryRevealDresscode();
        }, AFTER_SNAKE_DELAY_MS);
    }

    function showSnakeInstant() {
        if (!snake) return;
        snakeProgressMax = 1;
        if (snakeLine) snakeLine.style.strokeDashoffset = '0';
        snakeItems.forEach((item) => item.classList.add('is-visible'));
        dresscodeUnlocked = true;
    }

    function updateSnake() {
        if (!snake || !snakeLine || reduceMotion) return;

        const rect = snake.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        // Reveal line: snake draws only up to what has scrolled past ~60% of the viewport
        const revealY = vh * 0.6;
        let progress = (revealY - rect.top) / Math.max(rect.height, 1);
        progress = Math.max(0, Math.min(1, progress));

        snakeProgressMax = Math.max(snakeProgressMax, progress);
        snakeLine.style.strokeDashoffset = String(100 - snakeProgressMax * 100);

        snakeItems.forEach((item) => {
            const at = Number(item.dataset.at || 0) / 100;
            if (snakeProgressMax + 0.02 >= at) {
                item.classList.add('is-visible');
            }
        });

        if (snakeProgressMax >= 0.99) {
            scheduleDresscodeAfterSnake();
        }
    }

    function expandLocation(el) {
        if (!el || el.classList.contains('is-expanded')) return;
        el.classList.add('is-expanded');
    }

    let locationFocusMax = 0;

    function updateLocationFocus() {
        if (!locationSection || !locationPhoto || reduceMotion) return;

        const rect = locationSection.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const start = vh * 0.42;
        const end = vh * 0.08 + 3;
        let progress = (start - rect.top) / (start - end);
        progress = Math.max(0, Math.min(1, progress));

        const eased = 1 - Math.pow(1 - progress, 2.6);
        locationFocusMax = Math.max(locationFocusMax, eased);

        const blur = (1 - locationFocusMax) * 28;
        const scale = 1 + (1 - locationFocusMax) * 0.12;

        locationPhoto.style.setProperty('--photo-blur', `${blur.toFixed(2)}px`);
        locationPhoto.style.setProperty('--photo-scale', scale.toFixed(4));

        // Expand cylinder only when photo is nearly sharp
        if (locationFocusMax >= 0.88) {
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

                    if (el.classList.contains('dresscode')) {
                        dresscodePending = true;
                        tryRevealDresscode();
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

        let focusRaf = 0;
        const onScrollOrResize = () => {
            if (focusRaf) return;
            focusRaf = window.requestAnimationFrame(() => {
                focusRaf = 0;
                updateLocationFocus();
                updateSnake();
            });
        };

        window.addEventListener('scroll', onScrollOrResize, { passive: true });
        window.addEventListener('resize', onScrollOrResize);
        updateLocationFocus();
        updateSnake();
    }

    const gallery = document.querySelector('.dress-gallery');
    const galleryTrack = gallery && gallery.querySelector('.dress-gallery-track');
    const galleryPrev = gallery && gallery.querySelector('.dress-gallery-btn--prev');
    const galleryNext = gallery && gallery.querySelector('.dress-gallery-btn--next');

    if (galleryTrack && galleryPrev && galleryNext) {
        const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

        const getStep = () => {
            const item = galleryTrack.querySelector('.dress-gallery-item');
            if (!item) return galleryTrack.clientWidth * 0.6;
            const styles = window.getComputedStyle(galleryTrack);
            const gap = parseFloat(styles.columnGap || styles.gap) || 0;
            return item.getBoundingClientRect().width + gap;
        };

        const updateGalleryButtons = () => {
            if (!finePointer.matches) return;
            const maxScroll = galleryTrack.scrollWidth - galleryTrack.clientWidth;
            const left = galleryTrack.scrollLeft;
            galleryPrev.disabled = left <= 2;
            galleryNext.disabled = left >= maxScroll - 2;
        };

        const scrollGalleryBy = (direction) => {
            galleryTrack.scrollBy({
                left: direction * getStep(),
                behavior: reduceMotion ? 'auto' : 'smooth',
            });
        };

        galleryPrev.addEventListener('click', () => scrollGalleryBy(-1));
        galleryNext.addEventListener('click', () => scrollGalleryBy(1));
        galleryTrack.addEventListener('scroll', updateGalleryButtons, { passive: true });
        window.addEventListener('resize', updateGalleryButtons);
        finePointer.addEventListener('change', updateGalleryButtons);
        updateGalleryButtons();
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

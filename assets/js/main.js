/**
* Sreekar Cango — portfolio
* No dependencies. Typing effect, count-up and reveal are all in here.
*/
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasIO = "IntersectionObserver" in window;

  /**
   * Theme. An explicit choice wins over the OS setting and persists;
   * with no stored choice the page follows prefers-color-scheme.
   */
  const THEME_KEY = "sc-theme";
  const root = document.documentElement;

  let storedTheme = null;
  try {
    storedTheme = localStorage.getItem(THEME_KEY);
  } catch {
    /* storage unavailable */
  }
  if (storedTheme === "dark" || storedTheme === "light") {
    root.setAttribute("data-theme", storedTheme);
  }

  const themeToggle = $(".theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const current = root.getAttribute("data-theme") || (prefersDark ? "dark" : "light");
      const next = current === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      themeToggle.setAttribute("aria-label", `Switch to ${next === "dark" ? "light" : "dark"} theme`);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* private mode: the choice just won't survive a reload */
      }
    });
  }

  /**
   * Hero video. Only fetched when it will actually be seen and wanted: a wide
   * viewport, no reduced-motion preference, no Save-Data. Everyone else gets
   * the poster, which is already painted as the background.
   */
  const heroMedia = $(".hero-media[data-video]");
  if (heroMedia) {
    const saveData = navigator.connection && navigator.connection.saveData;
    const wide = window.matchMedia("(min-width: 900px)").matches;
    if (wide && !reducedMotion && !saveData) {
      const video = document.createElement("video");
      video.src = heroMedia.dataset.video;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      video.setAttribute("aria-hidden", "true");
      video.setAttribute("tabindex", "-1");
      video.preload = "auto";
      heroMedia.appendChild(video);
      const playing = video.play();
      if (playing) playing.catch(() => {});
    }
  }

  /**
   * Scroll-spy via IntersectionObserver.
   */
  const navLinks = $$("#navbar a[href^='#']");
  if (navLinks.length && hasIO) {
    const linkFor = new Map();
    navLinks.forEach((link) => {
      const section = document.getElementById(link.hash.slice(1));
      if (section) linkFor.set(section, link);
    });

    const visible = new Set();
    const setActive = () => {
      if (!visible.size) return;
      const top = [...visible].sort((a, b) => a.offsetTop - b.offsetTop)[0];
      navLinks.forEach((l) => l.classList.remove("active"));
      const link = linkFor.get(top);
      if (link) link.classList.add("active");
    };

    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        });
        setActive();
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0 }
    );
    linkFor.forEach((_l, section) => spy.observe(section));
  }

  /**
   * Mobile navigation drawer
   */
  const body = document.body;
  const navToggle = $(".mobile-nav-toggle");
  const backdrop = $(".nav-backdrop");

  const setNav = (open) => {
    body.classList.toggle("mobile-nav-active", open);
    if (navToggle) {
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    }
  };

  if (navToggle) {
    navToggle.addEventListener("click", () => setNav(!body.classList.contains("mobile-nav-active")));
  }
  if (backdrop) backdrop.addEventListener("click", () => setNav(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && body.classList.contains("mobile-nav-active")) setNav(false);
  });
  navLinks.forEach((link) => link.addEventListener("click", () => setNav(false)));

  /**
   * Back to top
   */
  const backToTop = $(".back-to-top");
  if (backToTop) {
    const sentinel = document.createElement("div");
    sentinel.style.cssText = "position:absolute;top:400px;height:1px;width:1px;pointer-events:none;";
    body.appendChild(sentinel);
    if (hasIO) {
      new IntersectionObserver(
        ([entry]) => backToTop.classList.toggle("active", !entry.isIntersecting),
        { threshold: 0 }
      ).observe(sentinel);
    }
    backToTop.addEventListener("click", (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    });
  }

  /**
   * Hero typing effect (replaces typed.js)
   */
  const typed = $(".typed");
  const typedItems = typed && typed.getAttribute("data-typed-items");
  if (typed && typedItems) {
    const phrases = typedItems.split(",").map((s) => s.trim()).filter(Boolean);
    if (reducedMotion || phrases.length < 2) {
      typed.textContent = phrases[0] || "";
    } else {
      let phrase = 0;
      let pos = 0;
      let deleting = false;
      const tick = () => {
        const current = phrases[phrase];
        pos += deleting ? -1 : 1;
        typed.textContent = current.slice(0, pos);
        let delay = deleting ? 38 : 72;
        if (!deleting && pos === current.length) {
          deleting = true;
          delay = 2100;
        } else if (deleting && pos === 0) {
          deleting = false;
          phrase = (phrase + 1) % phrases.length;
          delay = 320;
        }
        setTimeout(tick, delay);
      };
      setTimeout(tick, 500);
    }
  }

  /**
   * Count-up on scroll (replaces purecounter)
   */
  const counters = $$("[data-count]");
  if (counters.length) {
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const animate = (el) => {
      const target = Number(el.dataset.count) || 0;
      if (reducedMotion) {
        el.textContent = String(target);
        return;
      }
      const duration = 1400;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        el.textContent = String(Math.round(easeOut(t) * target));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (hasIO) {
      const io = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            animate(entry.target);
            obs.unobserve(entry.target);
          });
        },
        { threshold: 0.4 }
      );
      counters.forEach((el) => io.observe(el));
    } else {
      counters.forEach(animate);
    }
  }

  /**
   * Scroll reveal. Anything already at or above the viewport is shown at
   * once, so a #hash jump can never leave a skipped section invisible.
   */
  const revealTargets = $$("[data-reveal]");
  if (revealTargets.length) {
    if (hasIO && !reducedMotion) {
      const revealObserver = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
      );
      revealTargets.forEach((el) => revealObserver.observe(el));

      const revealPassed = () => {
        revealTargets.forEach((el) => {
          if (el.classList.contains("is-visible")) return;
          if (el.getBoundingClientRect().top < window.innerHeight) {
            el.classList.add("is-visible");
            revealObserver.unobserve(el);
          }
        });
      };
      revealPassed();
      window.addEventListener("hashchange", () => setTimeout(revealPassed, 400));
      window.addEventListener("load", revealPassed);
    } else {
      revealTargets.forEach((el) => el.classList.add("is-visible"));
    }
  }

  /**
   * Pause decorative loops while offscreen — several decoding at once is
   * wasted battery on mobile.
   */
  const loops = $$("video[data-autoloop]");
  if (loops.length && hasIO) {
    const loopObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const v = entry.target;
          if (entry.isIntersecting) {
            const p = v.play();
            if (p) p.catch(() => {});
          } else {
            v.pause();
          }
        });
      },
      { threshold: 0.15 }
    );
    loops.forEach((v) => loopObserver.observe(v));
  }

  const thisYear = String(new Date().getFullYear());
  $$("#year, .year").forEach((el) => (el.textContent = thisYear));
})();

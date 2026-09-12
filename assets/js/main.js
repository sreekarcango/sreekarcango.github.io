/**
* Sreekar Cango - portfolio
* Originally based on the iPortfolio template by BootstrapMade.com
*/
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /**
   * Theme. An explicit choice wins over the OS setting and persists;
   * with no stored choice the page follows prefers-color-scheme.
   */
  const THEME_KEY = "sc-theme";
  const root = document.documentElement;

  const storedTheme = (() => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  })();

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
   * Scroll-spy. Replaces a scroll handler that measured every section on
   * every event, which forced synchronous layout.
   */
  const navLinks = $$("#navbar a[href^='#']");
  if (navLinks.length && "IntersectionObserver" in window) {
    const linkFor = new Map();
    navLinks.forEach((link) => {
      const section = document.getElementById(link.hash.slice(1));
      if (section) linkFor.set(section, link);
    });

    const visible = new Set();
    const setActive = () => {
      if (!visible.size) return;
      // Topmost visible section wins when several are on screen at once.
      const top = [...visible].sort((a, b) => a.offsetTop - b.offsetTop)[0];
      navLinks.forEach((l) => l.classList.remove("active"));
      const link = linkFor.get(top);
      if (link) link.classList.add("active");
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        });
        setActive();
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0 }
    );

    linkFor.forEach((_link, section) => observer.observe(section));
  }

  /**
   * Mobile navigation
   */
  const body = document.body;
  const navToggle = $(".mobile-nav-toggle");
  const backdrop = $(".nav-backdrop");

  const setNav = (open) => {
    body.classList.toggle("mobile-nav-active", open);
    if (navToggle) {
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.classList.toggle("bi-list", !open);
      navToggle.classList.toggle("bi-x", open);
    }
  };

  if (navToggle) {
    navToggle.addEventListener("click", () => {
      setNav(!body.classList.contains("mobile-nav-active"));
    });
  }

  if (backdrop) backdrop.addEventListener("click", () => setNav(false));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && body.classList.contains("mobile-nav-active")) setNav(false);
  });

  // Close the drawer when a nav link is followed; CSS scroll-padding-top
  // handles the header offset, so no manual scroll maths here.
  $$("#navbar a[href^='#']").forEach((link) => {
    link.addEventListener("click", () => setNav(false));
  });

  /**
   * Back to top
   */
  const backToTop = $(".back-to-top");
  if (backToTop) {
    const sentinel = document.createElement("div");
    sentinel.style.cssText = "position:absolute;top:400px;height:1px;width:1px;";
    body.appendChild(sentinel);

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        ([entry]) => backToTop.classList.toggle("active", !entry.isIntersecting),
        { threshold: 0 }
      ).observe(sentinel);
    }

    backToTop.addEventListener("click", (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /**
   * Hero type effect
   */
  const typed = $(".typed");
  const typedItems = typed && typed.getAttribute("data-typed-items");
  if (typed && typedItems && typeof Typed !== "undefined") {
    new Typed(".typed", {
      strings: typedItems.split(",").map((s) => s.trim()),
      loop: true,
      typeSpeed: 70,
      backSpeed: 35,
      backDelay: 2200
    });
  }

  /**
   * Scroll reveal. Replaces AOS, which defaulted every element to opacity 0
   * and left the page blank whenever its script did not run.
   */
  const revealTargets = $$("[data-reveal]");
  if (revealTargets.length) {
    if ("IntersectionObserver" in window) {
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

      // Jumping straight to a #hash skips everything above the target, and the
      // observer never fires for it. Reveal anything already at or above the
      // viewport so no section can be left permanently invisible.
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

  if (typeof PureCounter !== "undefined" && $(".purecounter")) {
    new PureCounter();
  }

  /**
   * Pause offscreen decorative video. Several loops autoplay at once and
   * each one decoding continuously is wasted battery on mobile.
   */
  const videos = $$("video[data-autoloop]");
  if (videos.length && "IntersectionObserver" in window) {
    const vidObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const v = entry.target;
          if (entry.isIntersecting) {
            const playing = v.play();
            if (playing) playing.catch(() => {});
          } else {
            v.pause();
          }
        });
      },
      { threshold: 0.15 }
    );
    videos.forEach((v) => vidObserver.observe(v));
  }
})();

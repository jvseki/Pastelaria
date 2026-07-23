const topbar = document.querySelector(".topbar");
const revealItems = document.querySelectorAll(
    ".section h2, .section-lead, .idea-list, .flow li, .server-block, .domain-grid > div, .close-inner > *:not(.eyebrow)",
);

window.addEventListener(
    "scroll",
    () => {
        topbar?.classList.toggle("is-scrolled", window.scrollY > 24);
    },
    { passive: true },
);

revealItems.forEach((el) => el.classList.add("reveal"));

const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-in");
                observer.unobserve(entry.target);
            }
        });
    },
    { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
);

revealItems.forEach((el) => observer.observe(el));

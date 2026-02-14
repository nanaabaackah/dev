import { useEffect } from "react";
import { animate, stagger } from "animejs";

const REVEAL_SELECTOR = [
  ".page-header",
  ".page > .panel",
  ".page > .panel-grid",
  ".page > .page-grid",
  ".page > .stack",
  ".page > .dashboard-grid",
  ".page > .productivity-page__aux-grid",
  ".page .panel-grid > .panel",
  ".page .page-grid > .panel",
  ".page .stack > .panel",
  ".page .dashboard-grid > .panel",
  ".page .productivity-page__aux-grid > .panel",
  ".page .productivity-jobs__list > .productivity-job-card",
  ".notice",
  ".auth-shell .panel",
  ".public-booking .panel",
].join(", ");

const EXCLUDED_ANCESTOR_SELECTOR =
  ".modal-backdrop, .modal-card, .slot-modal, .slot-modal__card, .row-actions__menu";

const useScrollAnimations = (watchValue) => {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const root = document.querySelector(".erp-content") || document.body;
    const nodes = Array.from(root.querySelectorAll(REVEAL_SELECTOR)).filter((node) => {
      if (!(node instanceof HTMLElement)) return false;
      return !node.closest(EXCLUDED_ANCESTOR_SELECTOR);
    });
    const uniqueNodes = Array.from(new Set(nodes));

    uniqueNodes.forEach((node) => {
      node.classList.add("scroll-reveal-target");
      node.classList.remove("is-revealed");
      node.style.opacity = "0";
      node.style.transform = "translateY(18px)";
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target);
        if (!visible.length) return;

        animate(visible, {
          opacity: [0, 1],
          translateY: [18, 0],
          scale: [0.985, 1],
          duration: 560,
          ease: "out(3)",
          delay: stagger(70, { start: 30 }),
        });

        visible.forEach((target) => {
          target.classList.add("is-revealed");
          observer.unobserve(target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -8% 0px",
      }
    );

    uniqueNodes.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
      uniqueNodes.forEach((node) => {
        node.style.opacity = "";
        node.style.transform = "";
      });
    };
  }, [watchValue]);
};

export default useScrollAnimations;

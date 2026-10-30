const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const viewportSettings = {
  once: true,
  amount: 0.2,
};

export const fadeUp = prefersReducedMotion
  ? {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.15 } },
    }
  : {
      hidden: { opacity: 0, y: 16 },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          duration: 0.35,
          ease: [0.16, 1, 0.3, 1],
        },
      },
    };

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.25,
      ease: "easeOut",
    },
  },
};

export const staggerContainer = prefersReducedMotion
  ? { hidden: {}, visible: {} }
  : {
      hidden: {},
      visible: {
        transition: {
          staggerChildren: 0.06,
          delayChildren: 0.02,
        },
      },
    };

export const getFadeUpWithDelay = (delay = 0) =>
  prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.15 } },
      }
    : {
        hidden: { opacity: 0, y: 14 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.35,
            delay,
            ease: [0.16, 1, 0.3, 1],
          },
        },
      };

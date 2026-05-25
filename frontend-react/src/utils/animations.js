// ── ANIMATION PRESETS & UTILITIES ─────────────────────────────

// Page transitions
export const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

export const pageTransition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

// Stagger animations for lists
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// Card animations
export const cardHover = {
  whileHover: { y: -4, boxShadow: '0 12px 32px rgba(255, 140, 107, 0.25)' },
  whileTap: { y: -2 },
  transition: { type: 'spring', stiffness: 400, damping: 40 },
};

export const cardTap = {
  whileTap: { scale: 0.98 },
  transition: { type: 'spring', stiffness: 500, damping: 30 },
};

// Button animations
export const buttonHover = {
  whileHover: { scale: 1.05, y: -2 },
  whileTap: { scale: 0.95, y: 0 },
};

export const magneticButton = {
  whileHover: { 
    boxShadow: '0 8px 32px rgba(255, 140, 107, 0.4)',
    backgroundColor: 'rgb(255, 140, 107)',
  },
  whileTap: { scale: 0.98 },
};

// Input focus animation
export const inputFocus = {
  whileFocus: { boxShadow: '0 0 0 3px rgba(255, 183, 165, 0.2)' },
};

// Modal animations
export const modalBackdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalContent = {
  initial: { scale: 0.9, opacity: 0, y: 20 },
  animate: { scale: 1, opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  exit: { scale: 0.9, opacity: 0, y: 20 },
};

// Loading states
export const shimmer = {
  animate: {
    backgroundPosition: ['200% 0', '-200% 0'],
    transition: {
      repeat: Infinity,
      duration: 1.5,
      ease: 'linear',
    },
  },
};

export const pulse = {
  animate: {
    opacity: [1, 0.5, 1],
    transition: {
      repeat: Infinity,
      duration: 2,
      ease: 'easeInOut',
    },
  },
};

export const spin = {
  animate: {
    rotate: 360,
    transition: {
      repeat: Infinity,
      duration: 1,
      ease: 'linear',
    },
  },
};

// Reveal animations
export const revealUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export const revealDown = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export const revealLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export const revealRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

// Scale reveal (pop-in)
export const popIn = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 30 } },
};

// Glassmorphism blur transitions
export const glassFade = {
  initial: { opacity: 0, backdropFilter: 'blur(0px)' },
  animate: { opacity: 1, backdropFilter: 'blur(16px)', transition: { duration: 0.3 } },
};

// Floating animation (infinite subtle movement)
export const float = {
  animate: {
    y: [0, -10, 0],
    transition: {
      repeat: Infinity,
      duration: 3,
      ease: 'easeInOut',
    },
  },
};

// Typing indicator animation
export const typingDot = {
  animate: {
    y: [0, -8, 0],
    opacity: [0.4, 1, 0.4],
  },
};

export const typingIndicator = {
  animate: { transition: { repeat: Infinity, duration: 1.4 } },
};

// Success checkmark animation
export const successCheck = {
  initial: { scale: 0, rotate: -45 },
  animate: { scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 300 } },
};

// Shake animation (for errors)
export const shake = {
  animate: {
    x: [-4, 4, -4, 4, 0],
    transition: { duration: 0.4 },
  },
};

// Progress bar fill
export const progressFill = {
  initial: { width: 0 },
  animate: { width: '100%', transition: { duration: 0.8, ease: 'easeOut' } },
};

// Bounce animation
export const bounce = {
  animate: {
    y: [0, -12, 0],
    transition: {
      repeat: Infinity,
      duration: 0.8,
      ease: 'easeOut',
    },
  },
};

// Slide in from direction
export const slideInLeft = {
  initial: { x: -100, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
};

export const slideInRight = {
  initial: { x: 100, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
};

export const slideInTop = {
  initial: { y: -100, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
};

export const slideInBottom = {
  initial: { y: 100, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
};

// Hover scale effect
export const hoverScale = (scale = 1.05) => ({
  whileHover: { scale },
  transition: { type: 'spring', stiffness: 400, damping: 30 },
});

// Tap scale effect
export const tapScale = (scale = 0.95) => ({
  whileTap: { scale },
  transition: { type: 'spring', stiffness: 500, damping: 30 },
});

// Composite animation utilities
export const smoothExit = {
  exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } },
};

export const smoothEnter = {
  initial: { opacity: 0, scale: 0.95, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3 } },
};

// Enhanced spring physics preset (premium feel)
export const premiumSpring = {
  type: 'spring',
  stiffness: 260,
  damping: 60,
};

export const snappySpring = {
  type: 'spring',
  stiffness: 400,
  damping: 40,
};

export const smoothSpring = {
  type: 'spring',
  stiffness: 150,
  damping: 25,
};

export default {
  pageVariants,
  pageTransition,
  staggerContainer,
  staggerItem,
  cardHover,
  cardTap,
  buttonHover,
  magneticButton,
  inputFocus,
  modalBackdrop,
  modalContent,
  shimmer,
  pulse,
  spin,
  revealUp,
  revealDown,
  revealLeft,
  revealRight,
  popIn,
  glassFade,
  float,
  typingDot,
  typingIndicator,
  successCheck,
  shake,
  progressFill,
  bounce,
  slideInLeft,
  slideInRight,
  slideInTop,
  slideInBottom,
  hoverScale,
  tapScale,
  smoothExit,
  smoothEnter,
  premiumSpring,
  snappySpring,
  smoothSpring,
};

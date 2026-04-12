/**
 * Utility functions for formatting data across the application
 */

/**
 * Convert a date string into a relative human-readable format
 * @param {string} date - Date string from backend
 * @returns {string} e.g., "5m ago", "Just now"
 */
export const getRelativeTime = (date) => {
  if (!date) return 'Just now';
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now - then) / 1000);

  if (diffInSeconds < 30) return 'Just now';
  if (diffInSeconds < 60) return `few seconds ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return then.toLocaleDateString();
};

/**
 * Format lifestyle values for display
 */
export const formatLifestyleValue = (key, value) => {
  const formatters = {
    sleep_time: {
      early: "🌅 Early Bird",
      late: "🌙 Night Owl",
      flexible: "⏰ Flexible",
    },
    diet: {
      veg: "🥗 Vegetarian",
      eggetarian: "🥚 Eggetarian",
      nonveg: "🍗 Non-Veg",
    },
    noise_tolerance: {
      quiet: "🔇 Quiet",
      moderate: "🔉 Moderate",
      loud: "🔊 Loud OK",
    },
  };

  return formatters[key]?.[value] || value;
};

/**
 * Get color based on compatibility score
 */
export const getScoreColor = (score) => {
  if (score >= 80) return "#22c55e"; // Green
  if (score >= 60) return "#7C6EF8"; // Brand Primary
  return "#f43f5e"; // Rose
};

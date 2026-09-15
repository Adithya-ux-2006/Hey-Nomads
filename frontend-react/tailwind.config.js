/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          coral: '#E86A4A',
          'coral-light': '#F09070',
          'coral-dark': '#D05535',
          amber: '#F2B84B',
          'amber-light': '#F5CC7A',
          teal: '#4F7C82',
          'teal-light': '#6A9CA3',
          'teal-dark': '#3D6369',
        },
        surface: {
          bg: '#FAF8F4',
          card: '#FFFFFF',
          muted: '#F5F1EB',
          border: '#E8E2D9',
          'border-light': '#F0ECE5',
        },
        text: {
          primary: '#1F2933',
          secondary: '#6B7280',
          muted: '#9CA3AF',
          light: '#D1D5DB',
        },
        status: {
          success: '#22C55E',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#3B82F6',
        }
      },
      fontFamily: {
        display: ['Poppins', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'card': '16px',
        'pill': '9999px',
        'xl2': '20px',
        'xl3': '24px',
      },
      boxShadow: {
        'soft': '0 4px 24px rgba(0, 0, 0, 0.04)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
        'hover': '0 10px 40px rgba(0, 0, 0, 0.08)',
        'coral': '0 4px 24px rgba(232, 106, 74, 0.25)',
        'teal': '0 4px 24px rgba(79, 124, 130, 0.25)',
      },
    },
  },
  plugins: [],
}

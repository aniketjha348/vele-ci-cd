/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cyberpunk: {
          purple: '#8B5CF6',
          blue: '#3B82F6',
          green: '#10B981',
          pink: '#EC4899',
          dark: '#0A0A0F',
          darker: '#050508',
          gray: '#1A1A2E',
          lightGray: '#2D2D44',
        },
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 3s infinite',
        'gradient': 'gradient-shift 3s ease infinite',
        'slide-up': 'slide-up 0.5s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #8B5CF6, 0 0 10px #8B5CF6, 0 0 15px #8B5CF6' },
          '100%': { boxShadow: '0 0 10px #8B5CF6, 0 0 20px #8B5CF6, 0 0 30px #8B5CF6' },
        },
      },
      backgroundImage: {
        'cyberpunk-gradient': 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #10B981 100%)',
      },
    },
  },
  plugins: [],
}


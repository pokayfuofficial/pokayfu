/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0A0A12',
        surface:  '#12121F',
        surface2: '#1A1A2E',
        surface3: '#222238',
        accent:   '#7C3AFF',
        accent2:  '#FF3A8C',
        accent3:  '#00E5B0',
        gold:     '#FFB800',
      },
      fontFamily: {
        display: ['Unbounded', 'sans-serif'],
        body:    ['Golos Text', 'sans-serif'],
        mono:    ['Space Mono', 'monospace'],
      },
      animation: {
        'pulse-slow':  'pulse 3s ease-in-out infinite',
        'float':       'float 4s ease-in-out infinite',
        'shimmer':     'shimmer 3s infinite',
        'wave':        'wave 1.2s ease-in-out infinite',
        'slide-up':    'slideUp 0.3s ease-out',
        'fade-in':     'fadeIn 0.25s ease-out',
      },
      keyframes: {
        float:    { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        shimmer:  { '0%': { transform: 'translateX(-100%) rotate(45deg)' }, '100%': { transform: 'translateX(100%) rotate(45deg)' } },
        wave:     { '0%,100%': { transform: 'scaleY(0.4)', opacity: '0.5' }, '50%': { transform: 'scaleY(1)', opacity: '1' } },
        slideUp:  { from: { transform: 'translateY(20px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        fadeIn:   { from: { opacity: '0' }, to: { opacity: '1' } },
      },
    },
  },
  plugins: [],
};

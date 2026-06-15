/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // PROOF brand colors
        proof: {
          black: '#0a0a0a',
          white: '#f5f5f5',
          green: '#22c55e',   // rating gain
          red: '#ef4444',     // rating loss
          gold: '#f59e0b',    // top rankings
          muted: '#737373',   // secondary text
          card: '#171717',    // card backgrounds
          border: '#262626',  // borders
        },
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
}

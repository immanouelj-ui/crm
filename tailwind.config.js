/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'] },
      colors: {
        indigo: { 50:'#f1f2f4',100:'#e7e9ed',200:'#d3d6dc',300:'#aeb4bf',400:'#788190',500:'#454e5d',600:'#171b23',700:'#0a0d12',800:'#080a0e',900:'#050609',950:'#020304' },
        slate: { 50:'#f7f8fa',100:'#eef0f3',200:'#e3e6eb',300:'#c9cfd8',400:'#8b94a3',500:'#677181',600:'#4c5667',700:'#353e4e',800:'#202734',900:'#10151e',950:'#090d14' },
      },
      borderRadius: { xl:'16px', '2xl':'22px', '3xl':'28px' },
      boxShadow: { sm:'0 2px 8px -4px rgb(16 21 30 / 0.08)', md:'0 8px 30px -10px rgb(16 21 30 / 0.12)', xl:'0 20px 70px -20px rgb(16 21 30 / 0.18)' },
    },
  },
  plugins: [],
};

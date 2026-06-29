import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#BB2649',
          hover:   '#9B1E3C',
          deep:    '#7B162F',
          light:   '#F9E3E8',
          faint:   '#FDF4F6',
        },
        sidebar: '#1A1A1C',
        panel:   '#2F2F33',
        success: {
          DEFAULT: '#16A34A',
          light:   '#DCFCE7',
          faint:   '#F0FDF4',
        },
        warning: {
          DEFAULT: '#D97706',
          light:   '#FEF3C7',
          faint:   '#FFFBEB',
        },
        danger: {
          DEFAULT: '#DC2626',
          light:   '#FEE2E2',
          faint:   '#FEF2F2',
        },
        info: {
          DEFAULT: '#2563EB',
          light:   '#DBEAFE',
          faint:   '#EFF6FF',
        },
        // Gray scale — matches design system exactly
        gray: {
          50:  '#FAFAFA',
          100: '#F2F2F7',
          200: '#E5E5EA',
          300: '#D1D1D6',
          400: '#A1A1AA',
          500: '#71717A',
          600: '#52525A',
          700: '#3E3E42',
          800: '#2F2F33',
          900: '#1A1A1C',
          950: '#0F0F10',
        },
      },
      borderRadius: {
        card: '10px',
        btn:  '6px',
        xl:   '16px',
      },
      fontFamily: {
        sans:    ['DM Sans', 'sans-serif'],
        mono:    ['DM Mono', 'monospace'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        sm:   '0 1px 2px rgba(0,0,0,.05)',
        card: '0 2px 8px rgba(0,0,0,.08)',
        lg:   '0 8px 24px rgba(0,0,0,.12)',
      },
      height: {
        header: '56px',
      },
      width: {
        sidebar: '240px',
      },
    },
  },
  plugins: [
    function ({ addUtilities }: { addUtilities: (u: Record<string, Record<string, string>>) => void }) {
      addUtilities({ '.scrollbar-none': { '-ms-overflow-style': 'none', 'scrollbar-width': 'none' }, '.scrollbar-none::-webkit-scrollbar': { display: 'none' } });
    },
  ],
};

export default config;

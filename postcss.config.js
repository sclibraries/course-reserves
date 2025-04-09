// postcss.config.js
export default {
    plugins: {
      'postcss-import': {},
      tailwindcss: { config: './tailwind.config.ts' },        
      autoprefixer: {},
    },
  };
// postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {}, // This line is the key change!
    autoprefixer: {}, // Keep autoprefixer if you have it
  },
};
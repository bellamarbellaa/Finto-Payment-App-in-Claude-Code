/**
 * babel-preset-expo covers expo-router and, when Reanimated is installed,
 * wires in its worklets plugin automatically — so nothing else is needed here.
 */
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};

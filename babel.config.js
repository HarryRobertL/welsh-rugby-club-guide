module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Required for react-native-reanimated native driver (fixes RCTAnimation / useNativeDriver warning on iOS/Android).
    plugins: ['react-native-reanimated/plugin'],
  };
};

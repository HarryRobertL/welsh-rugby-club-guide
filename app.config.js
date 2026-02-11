const appJson = require('./app.json');

/**
 * Dynamic Expo config. Merges app.json with extra.eas.projectId from env
 * so push notifications work in EAS builds. Set EAS_PROJECT_ID in .env
 * after running `eas init` (or copy from Expo dashboard).
 */
module.exports = ({ config }) => {
  const base = config ?? appJson.expo;
  const projectId =
    process.env.EAS_PROJECT_ID ?? base?.extra?.eas?.projectId ?? null;
  return {
    ...base,
    extra: {
      ...(base?.extra ?? {}),
      ...(projectId && { eas: { projectId } }),
    },
  };
};

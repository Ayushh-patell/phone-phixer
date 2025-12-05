// lib/starLogic.js

import { getSettingValue } from "../routes/universalSettingsRoutes.js";

/**
 * Returns the full star_levels array from settings.
 * Shape: [{ lvl, name, checkPrice, ... }, ...]
 */
export const getStarLevels = async () => {
  const levels = await getSettingValue("star_levels", []);
  return Array.isArray(levels) ? levels : [];
};

/**
 * Get the config object for a given star level (number).
 */
export const getStarConfigForLevel = async (level) => {
  const levels = await getStarLevels();

  return (
    levels.find(
      (s) =>
        s.lvl === level || // if you use 'lvl'
        s.level === level  // if you used 'level'
    ) || null
  );
};

/**
 * Get the checkPrice (or 0) for a given user based on their star level.
 */
export const getUserCheckPrice = async (user) => {
  const level = user.star || 0;
  if (!level) return 0;

  const cfg = await getStarConfigForLevel(level);
  return cfg?.checkPrice ?? 0;
};

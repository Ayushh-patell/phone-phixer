// config/seedUniversalSettings.js
import UniversalSettings from "./models/UniversalSettings.js";

export const seedUniversalSettings = async () => {
  const defaults = [
    {
      key: "referralActive_limit",
      value: 5,
      description: "Minimum selfVolume (UV) required to set referralActive = true.",
    },
    {
      key: "checkprice_bornStar",
      value: 220,
      description: "Check price for Born Star.",
    },
    {
      key: "checkprice_risingStar",
      value: 270,
      description: "Check price for Rising Star.",
    },
    {
      key: "hotposition_min_uv",
      value: 2,
      description: "Minimum selfVolume (UV) required to be eligible for hot position placement.",
    },
  ];

  for (const def of defaults) {
    await UniversalSettings.findOneAndUpdate(
      { key: def.key },
      { $setOnInsert: def },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  }
};

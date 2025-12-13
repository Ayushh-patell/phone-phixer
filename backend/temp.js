// config/seedUniversalSettings.js
import UniversalSettings from "./models/UniversalSettings.js";

export const seedUniversalSettings = async () => {
  const defaults = [
    {
      key: "rsp_to_uv",
      value: 120,
      description: "Value of one UV to RSP",
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

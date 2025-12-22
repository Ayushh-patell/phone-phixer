import mongoose from "mongoose";

/**
 * levelsToCheck can be a positive integer or the string "infinity"
 * (recommended vs storing JS Infinity).
 */
const LevelsToCheckSchema = {
  type: mongoose.Schema.Types.Mixed,
  required: true,
  validate: {
    validator: (v) =>
      (typeof v === "number" && Number.isInteger(v) && v > 0) || v === "infinity",
    message: "levelsToCheck must be a positive integer or 'infinity'."
  }
};

/** Existing condition payload schemas */
const HotpositionConditionSchema = new mongoose.Schema(
  {
    minCount: { type: Number, required: true, min: 1 },
    levelsToCheck: LevelsToCheckSchema
  },
  { _id: false }
);

const ActiveReferralsConditionSchema = new mongoose.Schema(
  {
    minCount: { type: Number, required: true, min: 1 },
    levelsToCheck: LevelsToCheckSchema
  },
  { _id: false }
);

const PersonalRspConditionSchema = new mongoose.Schema(
  {
    minRsp: { type: Number, required: true, min: 0 },
    monthsToCheck: { type: Number, required: true, min: 1 }
  },
  { _id: false }
);

const GroupRspConditionSchema = new mongoose.Schema(
  {
    minRsp: { type: Number, required: true, min: 0 },
    monthsToCheck: { type: Number, required: true, min: 1 },
    levelsToCheck: LevelsToCheckSchema
  },
  { _id: false }
);

const GroupStarConditionSchema = new mongoose.Schema(
  {
    starLevel: { type: Number, required: true, min: 1 },
    minUsers: { type: Number, required: true, min: 1 },
    levelsToCheck: LevelsToCheckSchema
  },
  { _id: false }
);

/** NEW: personal_check */
const PersonalCheckConditionSchema = new mongoose.Schema(
  {
    minChecksCreated: { type: Number, required: true, min: 0 },
    monthsToCheck: { type: Number, required: true, min: 1 }
  },
  { _id: false }
);

/** NEW: group_check */
const GroupCheckConditionSchema = new mongoose.Schema(
  {
    minChecksCreated: { type: Number, required: true, min: 0 },
    monthsToCheck: { type: Number, required: true, min: 1 },
    levelsToCheck: LevelsToCheckSchema
  },
  { _id: false }
);

/**
 * Union-like condition schema: `type` + exactly one matching payload.
 */
const StarEligibilityConditionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        "hotposition",
        "activeReferrals",
        "personal_rsp",
        "group_rsp",
        "group_star",
        "personal_check",
        "group_check"
      ]
    },

    // payloads (only one must be set based on type)
    hotposition: { type: HotpositionConditionSchema },
    activeReferrals: { type: ActiveReferralsConditionSchema },
    personalRsp: { type: PersonalRspConditionSchema },
    groupRsp: { type: GroupRspConditionSchema },
    groupStar: { type: GroupStarConditionSchema },
    personalCheck: { type: PersonalCheckConditionSchema },
    groupCheck: { type: GroupCheckConditionSchema }
  },
  { _id: false }
);

// Enforce payload presence + strict union (only one payload set).
StarEligibilityConditionSchema.pre("validate", function (next) {
  const mapping = {
    hotposition: "hotposition",
    activeReferrals: "activeReferrals",
    personal_rsp: "personalRsp",
    group_rsp: "groupRsp",
    group_star: "groupStar",
    personal_check: "personalCheck",
    group_check: "groupCheck"
  };

  const requiredField = mapping[this.type];

  if (!requiredField) {
    return next(new Error(`Unknown condition type '${this.type}'.`));
  }

  if (!this[requiredField]) {
    return next(new Error(`Condition type '${this.type}' requires '${requiredField}' object.`));
  }

  const payloadFields = [
    "hotposition",
    "activeReferrals",
    "personalRsp",
    "groupRsp",
    "groupStar",
    "personalCheck",
    "groupCheck"
  ];

  const setFields = payloadFields.filter((f) => this[f] != null);

  if (setFields.length !== 1 || setFields[0] !== requiredField) {
    return next(
      new Error(`Condition type '${this.type}' must set only '${requiredField}' payload.`)
    );
  }

  next();
});

/**
 * A criteria block groups conditions.
 * - isOr=false => AND (all conditions must pass)
 * - isOr=true  => OR  (any condition can pass)
 */
const StarEligibilityCriteriaSchema = new mongoose.Schema(
  {
    isOr: { type: Boolean, default: false },
    conditions: {
      type: [StarEligibilityConditionSchema],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "Each criteria must have at least one condition."
      }
    }
  },
  { _id: false }
);

/**
 * One entry per star level, holding multiple criteria blocks.
 */
const StarLevelEligibilitySchema = new mongoose.Schema(
  {
    starLevel: { type: Number, required: true, min: 1 },
    criterias: { type: [StarEligibilityCriteriaSchema], required: true, default: [] }
  },
  { _id: false }
);

/**
 * If you want a dedicated model for this config (recommended for strict validation),
 * use this. Otherwise, embed StarLevelEligibilitySchema array into UniversalSettings.value
 * when key === "star_eligibility_criterias".
 */
const StarEligibilityRulesSchema = new mongoose.Schema(
  {
    key: { type: String, default: "star_eligibility_criterias", unique: true },
    value: { type: [StarLevelEligibilitySchema], required: true },
    description: { type: String, default: "Eligibility rules per star level for upgrades" }
  },
  { timestamps: true }
);

export default mongoose.model("StarEligibilityRules", StarEligibilityRulesSchema);

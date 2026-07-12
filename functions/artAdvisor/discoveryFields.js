/**
 * Minimal guided flows for catalog search — at most 2 questions before search.
 */

const {
  CUSTOM_CHIP_LABEL,
  SKIP_CHIP_LABEL,
  EXPLORE_TYPE_OPTIONS,
  EXPLORE_MEDIUM_OPTIONS,
} = require("./constants");
const {SKIPPED} = require("./conversationState");

const RECOMMENDATION_FLOW = [
  {
    id: "artType",
    profileKey: "lookingFor",
    label: "Type of art",
    question: "What type of art?",
    editPrompt: "I'd like to change the type of art.",
    required: false,
    presets: EXPLORE_TYPE_OPTIONS,
  },
  {
    id: "medium",
    profileKey: "medium",
    label: "Medium",
    question: "Preferred medium?",
    editPrompt: "I'd like to change the medium.",
    required: false,
    presets: EXPLORE_MEDIUM_OPTIONS,
  },
];

const INTERIOR_FLOW = [
  {
    id: "room",
    profileKey: "room",
    label: "Room",
    question: "Which room is this for?",
    editPrompt: "I'd like to change which room this is for.",
    required: true,
    presets: ["Living room", "Bedroom", "Office", "Dining room"],
  },
  {
    id: "decorStyle",
    profileKey: "decorStyle",
    label: "Decor style",
    question: "What's your decor style?",
    editPrompt: "I'd like to change my decor style.",
    required: false,
    presets: ["Modern", "Minimal", "Traditional", "Boho"],
  },
];

const DISCOVERY_INTENT_PHRASE = /find artwork|style my space|explore ideas|just explore|browse art/i;

const TYPE_TO_CATEGORY = {
  Landscape: "landscape",
  Portraits: "portrait",
};

const MEDIUM_TO_FILTER = {
  Acrylic: "acrylic",
  Watercolour: "watercolor",
  Oil: "oil",
  Charcoal: "charcoal",
};

function getDiscoveryFlow(intent) {
  return intent === "interior_design" ? INTERIOR_FLOW : RECOMMENDATION_FLOW;
}

function isDiscoveryIntentPhrase(message) {
  return DISCOVERY_INTENT_PHRASE.test(String(message || ""));
}

function profileHasAnswer(profile, field) {
  const val = profile?.[field.profileKey];
  if (val === undefined || val === null) return false;
  const text = String(val).trim();
  return text.length > 0;
}

function profileWasSkipped(profile, field) {
  const val = profile?.[field.profileKey];
  return val === SKIPPED || val === "No preference" || val === "No budget yet";
}

function getNextDiscoveryField(profile, intent) {
  return getDiscoveryFlow(intent).find(
      (field) => !profileHasAnswer(profile, field) && !profileWasSkipped(profile, field),
  ) || null;
}

/** Search once every step is answered or skipped. */
function isDiscoveryReadyForSearch(profile, intent) {
  return getNextDiscoveryField(profile, intent) === null;
}

function getDiscoveryQuickReplies(field) {
  if (!field) return [];
  const chips = [...field.presets];
  const hasSkip = chips.some((c) => c.toLowerCase() === SKIP_CHIP_LABEL.toLowerCase());
  if (!field.required && !hasSkip) chips.push(SKIP_CHIP_LABEL);
  return chips;
}

function isSkipChipSelection(text) {
  const t = String(text || "").trim().toLowerCase();
  return t === "skip" || t === "no preference" || t === "no budget yet";
}

function isCustomChipSelection(text) {
  const t = String(text || "").trim().toLowerCase();
  return t === CUSTOM_CHIP_LABEL.toLowerCase() || t.startsWith(`${CUSTOM_CHIP_LABEL.toLowerCase()} `) || t === "custom" || t.startsWith("custom ");
}

function tryApplyDiscoveryAnswer(field, message) {
  if (!field) return null;
  if (isCustomChipSelection(message)) return null;
  if (isSkipChipSelection(message)) {
    return field.required ? null : {[field.profileKey]: SKIPPED};
  }
  const trimmed = String(message || "").trim();
  if (!trimmed) return null;
  const preset = field.presets.find((p) => p.toLowerCase() === trimmed.toLowerCase());
  if (preset && !isSkipChipSelection(preset) && !isCustomChipSelection(preset)) {
    return {[field.profileKey]: preset};
  }
  if (field.id === "artType" || field.id === "room") {
    return {[field.profileKey]: trimmed};
  }
  if (field.id === "medium") {
    return {[field.profileKey]: trimmed};
  }
  return {[field.profileKey]: trimmed};
}

function buildDiscoverySearchQuery(profile, intent) {
  const parts = [];
  if (profile.lookingFor && profile.lookingFor !== SKIPPED) {
    parts.push(profile.lookingFor);
  }
  if (profile.room && profile.room !== SKIPPED) {
    parts.push(`art for ${profile.room}`);
  }
  if (profile.decorStyle && profile.decorStyle !== SKIPPED) {
    parts.push(`${profile.decorStyle} decor`);
  }
  if (profile.medium && profile.medium !== SKIPPED) {
    parts.push(`${profile.medium} medium`);
  }
  if (intent === "interior_design") {
    return parts.join(", ") || "artwork for home interior";
  }
  return parts.join(", ") || "artwork";
}

function buildDiscoverySearchFilters(profile, intent) {
  if (intent === "interior_design") return {};
  const filters = {};
  const artType = profile.lookingFor;
  const medium = profile.medium;
  if (artType && artType !== SKIPPED && TYPE_TO_CATEGORY[artType]) {
    filters.category = TYPE_TO_CATEGORY[artType];
  }
  if (medium && medium !== SKIPPED && MEDIUM_TO_FILTER[medium]) {
    filters.medium = MEDIUM_TO_FILTER[medium];
  }
  return filters;
}

function inferDiscoveryIntent(message) {
  if (/style my space|decorate|room|interior/i.test(message)) return "interior_design";
  if (/explore|browse|discover/i.test(message)) return "discovery";
  return "recommendation";
}

module.exports = {
  RECOMMENDATION_FLOW,
  INTERIOR_FLOW,
  getDiscoveryFlow,
  isDiscoveryIntentPhrase,
  getNextDiscoveryField,
  isDiscoveryReadyForSearch,
  getDiscoveryQuickReplies,
  isSkipChipSelection,
  isCustomChipSelection,
  tryApplyDiscoveryAnswer,
  buildDiscoverySearchQuery,
  buildDiscoverySearchFilters,
  inferDiscoveryIntent,
};

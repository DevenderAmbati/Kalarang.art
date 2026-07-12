/**
 * Commission field definitions — mirrors the manual commission form.
 * Each step offers exactly 3 preset chips + 1 Custom chip (Cursor-style).
 */

const {
  TYPE_OPTIONS,
  SIZE_OPTIONS,
  BUDGET_OPTIONS,
  DEADLINE_OPTIONS,
  DEFAULT_STYLE_OPTIONS,
  DEFAULT_SUBJECT_OPTIONS,
  CUSTOM_CHIP_LABEL,
  SKIP_CHIP_LABEL,
  TITLE_PRESET_OPTIONS,
} = require("./constants");

const COMMISSION_FIELDS = [
  {
    id: "title",
    label: "Title",
    question: "What should we call this commission?",
    editPrompt: "I'd like to change the title.",
    required: true,
    presets: TITLE_PRESET_OPTIONS,
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => Boolean(d.title?.trim()),
    applyPreset: (d, val) => ({...d, title: val}),
  },
  {
    id: "description",
    label: "Description",
    question: "Describe what you want.",
    editPrompt: "I'd like to change the description.",
    required: false,
    presets: [
      "Realistic portrait with soft background",
      "Abstract art with bold colors",
    ],
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => d.descriptionAnswered === true,
    applyPreset: (d, val) => ({...d, description: val, descriptionAnswered: true}),
  },
  {
    id: "budget",
    label: "Budget",
    question: "What's your budget?",
    editPrompt: "I'd like to change my budget.",
    required: true,
    presets: BUDGET_OPTIONS.filter((o) => o !== "Other").slice(0, 3),
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => Boolean(d.budget?.trim()) && (d.budget !== "Other" || d.customBudget?.trim()),
    applyPreset: (d, val) => ({...d, budget: val}),
  },
  {
    id: "deadline",
    label: "Deadline",
    question: "When do you need it?",
    editPrompt: "I'd like to change the deadline.",
    required: true,
    presets: DEADLINE_OPTIONS.filter((o) => o !== "Other").slice(0, 3),
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => Boolean(d.deadline?.trim()),
    applyPreset: (d, val) => ({...d, deadline: val}),
  },
  {
    id: "type",
    label: "Type",
    question: "What type of artwork?",
    editPrompt: "I'd like to change the artwork type.",
    required: true,
    presets: TYPE_OPTIONS.slice(0, 3),
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => Boolean(d.type?.trim()),
    applyPreset: (d, val) => ({...d, type: val}),
  },
  {
    id: "size",
    label: "Size",
    question: "What size do you need?",
    editPrompt: "I'd like to change the size.",
    required: false,
    presets: SIZE_OPTIONS.filter((o) => o !== "Other").slice(0, 3),
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => Boolean(d.size?.trim()),
    applyPreset: (d, val) => ({...d, size: val}),
  },
  {
    id: "style",
    label: "Style",
    question: "Preferred style?",
    editPrompt: "I'd like to change the style.",
    required: false,
    presets: DEFAULT_STYLE_OPTIONS.slice(0, 3),
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => Array.isArray(d.style) && d.style.length > 0,
    applyPreset: (d, val) => ({...d, style: [val]}),
  },
  {
    id: "subject",
    label: "Subject",
    question: "What's the subject?",
    editPrompt: "I'd like to change the subject.",
    required: false,
    askInFlow: false,
    presets: DEFAULT_SUBJECT_OPTIONS.slice(0, 3),
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => Array.isArray(d.subject) && d.subject.length > 0,
    applyPreset: (d, val) => ({...d, subject: [val]}),
  },
  {
    id: "location",
    label: "City / pincode",
    question: "City or pincode for delivery?",
    editPrompt: "I'd like to change the delivery location.",
    required: true,
    presets: ["Mumbai", "Delhi", "Bengaluru"],
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => Boolean(d.cityOrPincode?.trim()),
    applyPreset: (d, val) => ({...d, cityOrPincode: val, deliveryType: "Physical artwork"}),
  },
  {
    id: "referenceImages",
    label: "Reference image",
    question: "Any reference image?",
    editPrompt: "I'd like to change my reference image.",
    required: false,
    presets: ["Use 📎 to attach"],
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => d.referenceImagesAnswered === true,
    applyPreset: (d, val) => {
      if (val === "Use 📎 to attach") {
        return {...d, referenceImagesAnswered: true, wantsReferenceImages: true};
      }
      return {...d, referenceImagesAnswered: true};
    },
  },
];

function getActiveCommissionFields(draft = {}) {
  return COMMISSION_FIELDS.filter((field) => {
    if (typeof field.showIf === "function" && !field.showIf(draft)) return false;
    return true;
  });
}

function getNextCommissionField(draft = {}) {
  return getActiveCommissionFields(draft)
      .filter((field) => field.askInFlow !== false)
      .find((field) => !field.isFilled(draft)) || null;
}

function getCommissionQuickReplies(field) {
  if (!field) return [];
  const chips = [...field.presets, field.customLabel || CUSTOM_CHIP_LABEL];
  if (!field.required) chips.push(SKIP_CHIP_LABEL);
  return chips;
}

function getCommissionQuestion(field) {
  return field?.question || "";
}

function isCustomChipSelection(text) {
  const t = String(text || "").trim().toLowerCase();
  const label = CUSTOM_CHIP_LABEL.toLowerCase();
  return t === label || t.startsWith(`${label} `) || t === "custom" || t.startsWith("custom ") || t === "type my own";
}

function patchFromField(field, updated) {
  switch (field.id) {
  case "title": return {title: updated.title};
  case "description": return {description: updated.description, descriptionAnswered: true};
  case "size": return {size: updated.size};
  case "budget": return {budget: updated.budget};
  case "deadline": return {deadline: updated.deadline};
  case "type": return {type: updated.type};
  case "style": return {style: updated.style};
  case "subject": return {subject: updated.subject};
  case "location": return {cityOrPincode: updated.cityOrPincode, deliveryType: "Physical artwork"};
  case "referenceImages":
    return {referenceImagesAnswered: true, wantsReferenceImages: updated.wantsReferenceImages || false};
  default: return null;
  }
}

function isSkipChipSelection(text) {
  const t = String(text || "").trim().toLowerCase();
  return t === "skip" || t === "no preference";
}

function applySkipPatch(field, draft = {}) {
  if (!field || field.required) return null;
  switch (field.id) {
  case "description":
    return {
      description: draft.title?.trim() || "",
      descriptionAnswered: true,
    };
  case "size": return {size: "No preference"};
  case "style": return {style: ["No preference"]};
  case "subject": return {subject: []};
  case "referenceImages": return {referenceImagesAnswered: true};
  default: return null;
  }
}

/** If the user's message matches a preset chip, return a draft patch. */
function tryApplyCommissionChip(field, message, draft = {}) {
  if (!field) return null;
  if (isSkipChipSelection(message)) return applySkipPatch(field, draft);
  if (isCustomChipSelection(message)) return null;
  const trimmed = String(message || "").trim();
  if (!trimmed) return null;
  const match = field.presets.find((p) => p.toLowerCase() === trimmed.toLowerCase());
  if (!match) return null;
  return patchFromField(field, field.applyPreset({}, match));
}

/** Apply a free-typed answer to the current commission field. */
function applyCustomAnswerPatch(field, text) {
  const value = String(text || "").trim();
  if (!value || isCustomChipSelection(value)) return null;

  switch (field.id) {
  case "title": return {title: value};
  case "description": return {description: value, descriptionAnswered: true};
  case "size":
    if (["a4", "a3", "a2"].includes(value.toLowerCase())) return {size: value.toUpperCase()};
    return {size: "Other", customWidth: value};
  case "budget":
    if (BUDGET_OPTIONS.includes(value)) return {budget: value};
    return {budget: "Other", customBudget: value.startsWith("₹") ? value : `₹${value}`};
  case "deadline":
    if (DEADLINE_OPTIONS.includes(value)) return {deadline: value};
    return {deadline: value};
  case "type": {
    const match = TYPE_OPTIONS.find((t) => t.toLowerCase() === value.toLowerCase());
    return {type: match || value};
  }
  case "style": return {style: [value]};
  case "subject": return {subject: [value]};
  case "location": return {cityOrPincode: value, deliveryType: "Physical artwork"};
  case "referenceImages": return {referenceImagesAnswered: true};
  default: return null;
  }
}

function getCustomInputPlaceholder(fieldId) {
  const map = {
    title: "Enter title…",
    description: "Describe what you want…",
    size: "Enter size (e.g. A3 or 12×16 in)…",
    budget: "Enter budget (e.g. ₹7,500)…",
    deadline: "Enter deadline…",
    type: "Enter artwork type…",
    style: "Enter style…",
    subject: "Enter subject…",
    location: "Enter city or pincode…",
    referenceImages: "Describe your reference…",
  };
  return map[fieldId] || "Type your answer…";
}

function buildCommissionStepsForProgress(draft = {}) {
  return getActiveCommissionFields(draft).map((field) => {
    const filled = field.isFilled(draft);
    let value = "";
    if (field.id === "title") value = draft.title || "";
    else if (field.id === "description") value = draft.description || "";
    else if (field.id === "size") value = draft.size || "";
    else if (field.id === "budget") {
      value = draft.budget === "Other" ? (draft.customBudget || "Other") : (draft.budget || "");
    } else if (field.id === "deadline") value = draft.deadline || "";
    else if (field.id === "type") value = draft.type || "";
    else if (field.id === "style") value = (draft.style || []).join(", ");
    else if (field.id === "subject") value = (draft.subject || []).join(", ");
    else if (field.id === "location") value = draft.cityOrPincode || "";
    else if (field.id === "referenceImages") {
      const count = (draft.referenceImageUrls || []).length;
      value = draft.wantsReferenceImages ? "Attach in chat" : (count ? `${count} image(s)` : "None");
    }

    return {
      id: field.id,
      label: field.label,
      value: filled ? value : "",
      status: filled ? "filled" : "pending",
      optional: !field.required,
      editPrompt: field.editPrompt,
    };
  });
}

module.exports = {
  COMMISSION_FIELDS,
  getActiveCommissionFields,
  getNextCommissionField,
  getCommissionQuickReplies,
  getCommissionQuestion,
  isCustomChipSelection,
  isSkipChipSelection,
  tryApplyCommissionChip,
  applyCustomAnswerPatch,
  getCustomInputPlaceholder,
  buildCommissionStepsForProgress,
};

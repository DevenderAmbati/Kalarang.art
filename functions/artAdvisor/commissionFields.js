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
} = require("./constants");

const COMMISSION_FIELDS = [
  {
    id: "title",
    label: "Title",
    question: "What should we call this commission?",
    editPrompt: "I'd like to change the title.",
    required: true,
    presets: ["Pet portrait", "Family portrait", "Landscape artwork"],
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => Boolean(d.title?.trim()),
    applyPreset: (d, val) => ({...d, title: val}),
  },
  {
    id: "description",
    label: "Description",
    question: "Describe what you want.",
    editPrompt: "I'd like to change the description.",
    required: true,
    presets: [
      "Realistic portrait with soft background",
      "Abstract art with bold colors",
      "Traditional artwork with fine details",
    ],
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => Boolean(d.description?.trim()),
    applyPreset: (d, val) => ({...d, description: val}),
  },
  {
    id: "size",
    label: "Size",
    question: "What size do you need?",
    editPrompt: "I'd like to change the size.",
    required: false,
    presets: SIZE_OPTIONS.filter((o) => o !== "Custom").slice(0, 3),
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => Boolean(d.size?.trim()),
    applyPreset: (d, val) => ({...d, size: val}),
  },
  {
    id: "budget",
    label: "Budget",
    question: "What's your budget?",
    editPrompt: "I'd like to change my budget.",
    required: true,
    presets: BUDGET_OPTIONS.filter((o) => o !== "Custom").slice(0, 3),
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => Boolean(d.budget?.trim()) && (d.budget !== "Custom" || d.customBudget?.trim()),
    applyPreset: (d, val) => ({...d, budget: val}),
  },
  {
    id: "deadline",
    label: "Deadline",
    question: "When do you need it?",
    editPrompt: "I'd like to change the deadline.",
    required: true,
    presets: DEADLINE_OPTIONS.filter((o) => o !== "Custom").slice(0, 3),
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
    presets: DEFAULT_SUBJECT_OPTIONS.slice(0, 3),
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => Array.isArray(d.subject) && d.subject.length > 0,
    applyPreset: (d, val) => ({...d, subject: [val]}),
  },
  {
    id: "delivery",
    label: "Delivery",
    question: "How should it be delivered?",
    editPrompt: "I'd like to change delivery details.",
    required: true,
    presets: ["Digital file", "Physical artwork", "Either works"],
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => Boolean(d.deliveryType?.trim()),
    applyPreset: (d, val) => {
      if (val === "Either works") return {...d, deliveryType: "Physical artwork"};
      if (val === "Digital file") {
        return {...d, deliveryType: "Digital file", cityOrPincode: "Digital delivery"};
      }
      return {...d, deliveryType: "Physical artwork"};
    },
  },
  {
    id: "location",
    label: "City / pincode",
    question: "City or pincode for delivery?",
    editPrompt: "I'd like to change the delivery location.",
    required: true,
    showIf: (d) => d.deliveryType !== "Digital file",
    presets: ["Mumbai", "Delhi", "Bengaluru"],
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => Boolean(d.cityOrPincode?.trim()) && d.cityOrPincode !== "Digital delivery",
    applyPreset: (d, val) => ({...d, cityOrPincode: val, deliveryType: d.deliveryType || "Physical artwork"}),
  },
  {
    id: "referenceImages",
    label: "Reference images",
    question: "Any reference images?",
    editPrompt: "I'd like to change reference images.",
    required: false,
    presets: ["Use 📎 to attach", "No reference needed", "Describe in text instead"],
    customLabel: CUSTOM_CHIP_LABEL,
    isFilled: (d) => d.referenceImagesAnswered === true,
    applyPreset: (d, val) => {
      if (val === "No reference needed" || val === "Describe in text instead") {
        return {...d, referenceImagesAnswered: true};
      }
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
  return getActiveCommissionFields(draft).find((field) => !field.isFilled(draft)) || null;
}

function getCommissionQuickReplies(field) {
  if (!field) return [];
  return [...field.presets.slice(0, 3), field.customLabel || CUSTOM_CHIP_LABEL];
}

function getCommissionQuestion(field) {
  return field?.question || "";
}

function isCustomChipSelection(text) {
  const t = String(text || "").trim().toLowerCase();
  return t === "custom" || t.startsWith("custom ") || t === "type my own";
}

function patchFromField(field, updated) {
  switch (field.id) {
  case "title": return {title: updated.title};
  case "description": return {description: updated.description};
  case "size": return {size: updated.size};
  case "budget": return {budget: updated.budget};
  case "deadline": return {deadline: updated.deadline};
  case "type": return {type: updated.type};
  case "style": return {style: updated.style};
  case "subject": return {subject: updated.subject};
  case "delivery": return {deliveryType: updated.deliveryType, cityOrPincode: updated.cityOrPincode};
  case "location": return {cityOrPincode: updated.cityOrPincode, deliveryType: updated.deliveryType || "Physical artwork"};
  case "referenceImages":
    return {referenceImagesAnswered: true, wantsReferenceImages: updated.wantsReferenceImages || false};
  default: return null;
  }
}

/** If the user's message matches a preset chip, return a draft patch. */
function tryApplyCommissionChip(field, message) {
  if (!field || isCustomChipSelection(message)) return null;
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
  case "description": return {description: value};
  case "size":
    if (["a4", "a3", "a2"].includes(value.toLowerCase())) return {size: value.toUpperCase()};
    return {size: "Custom", customWidth: value};
  case "budget":
    if (BUDGET_OPTIONS.includes(value)) return {budget: value};
    return {budget: "Custom", customBudget: value.startsWith("₹") ? value : `₹${value}`};
  case "deadline":
    if (DEADLINE_OPTIONS.includes(value)) return {deadline: value};
    return {deadline: value};
  case "type": {
    const match = TYPE_OPTIONS.find((t) => t.toLowerCase() === value.toLowerCase());
    return {type: match || value};
  }
  case "style": return {style: [value]};
  case "subject": return {subject: [value]};
  case "delivery":
    if (value.toLowerCase().includes("digital")) {
      return {deliveryType: "Digital file", cityOrPincode: "Digital delivery"};
    }
    return {deliveryType: "Physical artwork"};
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
    delivery: "Describe delivery preference…",
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
      value = draft.budget === "Custom" ? (draft.customBudget || "Custom") : (draft.budget || "");
    } else if (field.id === "deadline") value = draft.deadline || "";
    else if (field.id === "type") value = draft.type || "";
    else if (field.id === "style") value = (draft.style || []).join(", ");
    else if (field.id === "subject") value = (draft.subject || []).join(", ");
    else if (field.id === "delivery") value = draft.deliveryType || "";
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
  tryApplyCommissionChip,
  applyCustomAnswerPatch,
  getCustomInputPlaceholder,
  buildCommissionStepsForProgress,
};

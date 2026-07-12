const {
  BUDGET_OPTIONS,
  DEADLINE_OPTIONS,
  SIZE_OPTIONS,
  TYPE_OPTIONS,
} = require("./constants");

function emptyDraft() {
  return {
    title: "",
    description: "",
    descriptionAnswered: false,
    budget: "",
    customBudget: "",
    deadline: "",
    size: "",
    customHeight: "",
    customWidth: "",
    type: "",
    style: [],
    subject: [],
    deliveryType: "",
    cityOrPincode: "",
    referenceImageUrls: [],
    referenceImagesAnswered: false,
    wantsReferenceImages: false,
  };
}

function mergeCommissionDraft(existing, updates) {
  const draft = {...emptyDraft(), ...existing};
  for (const [key, val] of Object.entries(updates)) {
    if (val === undefined || val === null) continue;
    if (Array.isArray(val)) {
      draft[key] = val.length > 0 ? val : draft[key];
    } else if (typeof val === "string") {
      draft[key] = val.trim() || draft[key];
    } else if (typeof val === "boolean") {
      draft[key] = val;
    } else {
      draft[key] = val;
    }
  }
  return draft;
}

function ensureCommissionDefaults(draft) {
  const next = {...draft};
  if (next.descriptionAnswered && !next.description?.trim() && next.title?.trim()) {
    next.description = next.title.trim();
  }
  if (!next.deliveryType?.trim()) {
    next.deliveryType = "Physical artwork";
  }
  return next;
}

function validateCommissionDraft(draft) {
  const normalized = ensureCommissionDefaults(draft);
  const errors = [];
  if (!normalized.title?.trim()) errors.push("Title is required");
  if (!normalized.description?.trim()) errors.push("Description is required");
  if (!normalized.type?.trim() || !TYPE_OPTIONS.includes(normalized.type)) {
    errors.push(`Type must be one of: ${TYPE_OPTIONS.join(", ")}`);
  }
  if (!normalized.budget?.trim()) {
    errors.push("Budget is required");
  } else if (normalized.budget === "Other" && !normalized.customBudget?.trim()) {
    errors.push("Custom budget amount is required");
  }
  if (!normalized.deadline?.trim()) errors.push("Deadline is required");
  if (!normalized.cityOrPincode?.trim()) {
    errors.push("City or pincode is required");
  }
  return {isValid: errors.length === 0, errors, draft: normalized};
}

function draftToCreatePayload(draft) {
  const normalized = ensureCommissionDefaults(draft);
  const deliveryType = normalized.deliveryType || "Physical artwork";
  return {
    title: normalized.title || "",
    description: normalized.description || "",
    budget: normalized.budget === "Other" ? (normalized.customBudget || normalized.budget) : (normalized.budget || ""),
    deadline: normalized.deadline || "",
    size: normalized.size || "",
    customHeight: normalized.customHeight || "",
    customWidth: normalized.customWidth || "",
    type: normalized.type || "",
    style: normalized.style || [],
    subject: normalized.subject || [],
    deliveryType: deliveryType || "",
    cityOrPincode: normalized.cityOrPincode || "",
  };
}

function formatDraftSummary(draft) {
  const sizeDisplay = draft.size === "Other" && (draft.customWidth || draft.customHeight)
    ? `${draft.customWidth || "?"} × ${draft.customHeight || "?"} in`
    : (draft.size || "(not set)");
  return {
    title: draft.title || "(not set)",
    description: draft.description || "(not set)",
    subject: draft.title || "(not set)",
    size: sizeDisplay,
    medium: draft.type || "(not set)",
    budget: draft.budget === "Other" ? (draft.customBudget || "Other") : (draft.budget || "(not set)"),
    deadline: draft.deadline || "(not set)",
    style: draft.style || [],
    subjectTags: draft.subject || [],
    deliveryType: draft.deliveryType || "(not set)",
    cityOrPincode: draft.cityOrPincode || "(not set)",
    referenceImageCount: (draft.referenceImageUrls || []).length,
  };
}

module.exports = {emptyDraft, mergeCommissionDraft, validateCommissionDraft, draftToCreatePayload, formatDraftSummary, ensureCommissionDefaults};

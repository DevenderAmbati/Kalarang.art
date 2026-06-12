const {BUDGET_OPTIONS, DEADLINE_OPTIONS, SIZE_OPTIONS, TYPE_OPTIONS} = require("./constants");

function emptyDraft() {
  return {
    title: "",
    description: "",
    budget: "",
    customBudget: "",
    deadline: "",
    size: "",
    customHeight: "",
    customWidth: "",
    type: "",
    style: [],
    subject: [],
    cityOrPincode: "",
    referenceImageUrls: [],
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
    } else {
      draft[key] = val;
    }
  }
  return draft;
}

function validateCommissionDraft(draft) {
  const errors = [];
  if (!draft.title?.trim()) errors.push("Title is required");
  if (!draft.description?.trim()) errors.push("Description is required");
  if (!draft.type?.trim() || !TYPE_OPTIONS.includes(draft.type)) {
    errors.push(`Type must be one of: ${TYPE_OPTIONS.join(", ")}`);
  }
  if (!draft.budget?.trim()) {
    errors.push("Budget is required");
  } else if (draft.budget === "Custom" && !draft.customBudget?.trim()) {
    errors.push("Custom budget amount is required");
  }
  if (!draft.deadline?.trim()) errors.push("Deadline is required");
  if (!draft.cityOrPincode?.trim()) errors.push("City or pincode is required");
  return {isValid: errors.length === 0, errors};
}

function draftToCreatePayload(draft) {
  return {
    title: draft.title || "",
    description: draft.description || "",
    budget: draft.budget === "Custom" ? (draft.customBudget || draft.budget) : (draft.budget || ""),
    deadline: draft.deadline || "",
    size: draft.size || "",
    customHeight: draft.customHeight || "",
    customWidth: draft.customWidth || "",
    type: draft.type || "",
    style: draft.style || [],
    subject: draft.subject || [],
    deliveryType: "",
    cityOrPincode: draft.cityOrPincode || "",
  };
}

function formatDraftSummary(draft) {
  return {
    subject: draft.title || "(not set)",
    size: draft.size || "(not set)",
    medium: draft.type || "(not set)",
    budget: draft.budget === "Custom" ? (draft.customBudget || "Custom") : (draft.budget || "(not set)"),
    deadline: draft.deadline || "(not set)",
    style: draft.style || [],
    cityOrPincode: draft.cityOrPincode || "(not set)",
    referenceImageCount: (draft.referenceImageUrls || []).length,
  };
}

module.exports = {emptyDraft, mergeCommissionDraft, validateCommissionDraft, draftToCreatePayload, formatDraftSummary};

const {
  BUDGET_OPTIONS,
  DEADLINE_OPTIONS,
  SIZE_OPTIONS,
  TYPE_OPTIONS,
  DELIVERY_TYPE_OPTIONS,
} = require("./constants");

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
  if (!draft.deliveryType?.trim()) {
    errors.push("Delivery type is required");
  } else if (draft.deliveryType === "Physical artwork") {
    if (!draft.cityOrPincode?.trim() || draft.cityOrPincode === "Digital delivery") {
      errors.push("City or pincode is required for physical delivery");
    }
  }
  return {isValid: errors.length === 0, errors};
}

function draftToCreatePayload(draft) {
  const deliveryType = draft.deliveryType ||
    (draft.cityOrPincode === "Digital delivery" ? "Digital file" : "Physical artwork");
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
    deliveryType: deliveryType || "",
    cityOrPincode: draft.cityOrPincode || "",
  };
}

function formatDraftSummary(draft) {
  const sizeDisplay = draft.size === "Custom" && (draft.customWidth || draft.customHeight)
    ? `${draft.customWidth || "?"} × ${draft.customHeight || "?"} in`
    : (draft.size || "(not set)");
  return {
    title: draft.title || "(not set)",
    description: draft.description || "(not set)",
    subject: draft.title || "(not set)",
    size: sizeDisplay,
    medium: draft.type || "(not set)",
    budget: draft.budget === "Custom" ? (draft.customBudget || "Custom") : (draft.budget || "(not set)"),
    deadline: draft.deadline || "(not set)",
    style: draft.style || [],
    subjectTags: draft.subject || [],
    deliveryType: draft.deliveryType || "(not set)",
    cityOrPincode: draft.cityOrPincode || "(not set)",
    referenceImageCount: (draft.referenceImageUrls || []).length,
  };
}

module.exports = {emptyDraft, mergeCommissionDraft, validateCommissionDraft, draftToCreatePayload, formatDraftSummary};

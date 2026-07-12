/**
 * Deterministic conversation-state engine for the Art Advisor.
 */

const {buildCommissionStepsForProgress} = require("./commissionFields");

const SKIPPED = "No preference";

function hasValue(val) {
  if (val === undefined || val === null) return false;
  if (Array.isArray(val)) return val.length > 0;
  return String(val).trim().length > 0;
}

function displayValue(val) {
  if (Array.isArray(val)) return val.join(", ");
  return String(val ?? "").trim();
}

const DISCOVERY_STEPS = [
  {
    id: "artType",
    label: "Type of art",
    getValue: (profile) => profile.lookingFor,
    editPrompt: "I'd like to change the type of art.",
    options: [],
    optional: true,
  },
  {
    id: "medium",
    label: "Medium",
    getValue: (profile) => profile.medium,
    editPrompt: "I'd like to change the medium.",
    options: [],
    optional: true,
  },
];

const INTERIOR_STEPS = [
  {
    id: "room",
    label: "Room",
    getValue: (profile) => profile.room,
    editPrompt: "I'd like to change which room this is for.",
    options: ["Living room", "Bedroom", "Office", "Dining room", "Entryway"],
  },
  {
    id: "decorStyle",
    label: "Decor style",
    getValue: (profile) => profile.decorStyle,
    editPrompt: "I'd like to change my decor style.",
    options: ["Modern", "Minimal", "Traditional", "Boho", "Industrial"],
    optional: true,
  },
];

const FLOWS = {
  commission: {label: "Custom commission", steps: [], source: "draft"},
  recommendation: {label: "Finding artwork", steps: DISCOVERY_STEPS, source: "profile"},
  discovery: {label: "Exploring art", steps: DISCOVERY_STEPS, source: "profile"},
  interior_design: {label: "Styling your space", steps: INTERIOR_STEPS, source: "profile"},
};

function computeProgress(intent, commissionDraft, discoveryProfile) {
  const flow = FLOWS[intent];
  if (!flow) return null;

  const source = flow.source === "draft" ? (commissionDraft || {}) : (discoveryProfile || {});
  const steps = flow.source === "draft"
    ? buildCommissionStepsForProgress(commissionDraft || {})
    : flow.steps.map((step) => {
      const raw = step.getValue(source);
      const filled = hasValue(raw);
      const skipped = filled && displayValue(raw) === SKIPPED;
      return {
        id: step.id,
        label: step.label,
        value: filled && !skipped ? displayValue(raw) : "",
        status: skipped ? "skipped" : (filled ? "filled" : "pending"),
        optional: Boolean(step.optional),
        editPrompt: step.editPrompt,
      };
    });

  const done = steps.filter((s) => s.status !== "pending").length;
  return {
    intent,
    flowLabel: flow.label,
    steps,
    done,
    total: steps.length,
    percent: steps.length ? Math.round((done / steps.length) * 100) : 0,
  };
}

function buildStateBlock({intent, commissionDraft, discoveryProfile, searchCount}) {
  const lines = ["", "--- LIVE SESSION STATE (authoritative — trust this over chat history) ---"];
  lines.push(`Detected intent: ${intent || "not yet detected"}`);

  const progress = computeProgress(intent, commissionDraft, discoveryProfile);
  if (progress) {
    lines.push(`Active flow: ${progress.flowLabel} (${progress.done}/${progress.total} collected)`);
    const collected = progress.steps.filter((s) => s.status === "filled");
    const skipped = progress.steps.filter((s) => s.status === "skipped");
    const pending = progress.steps.filter((s) => s.status === "pending");
    if (collected.length) {
      lines.push("Already collected (do NOT ask again):");
      for (const s of collected) lines.push(`  - ${s.label}: ${s.value}`);
    }
    if (skipped.length) {
      lines.push(`Skipped by user (do NOT ask again): ${skipped.map((s) => s.label).join(", ")}`);
    }
    if (pending.length) {
      const next = pending[0];
      lines.push(`Still missing (ask the FIRST one next, one at a time): ${pending.map((s) => s.label).join(" → ")}`);
      if (intent === "commission") {
        lines.push(`NEXT QUESTION: Ask about "${next.label}" only. Include presets + "Other" + "Skip" if optional.`);
      } else if (["recommendation", "discovery", "interior_design"].includes(intent)) {
        lines.push(`NEXT QUESTION: Ask about "${next.label}" only. Include "Skip" if optional. Search after required fields are collected.`);
      }
    } else {
      lines.push(
          intent === "commission" ?
            "All fields collected — call mark_commission_ready now if you haven't." :
            "All preferences collected — call search_artworks now if you haven't shown results.",
      );
    }
  } else {
    lines.push("No guided flow active. Determine the user's intent (call set_intent) and begin the matching flow.");
  }

  if (typeof searchCount === "number") {
    lines.push(`Catalog searches performed this session: ${searchCount}`);
    if (searchCount > 0) {
      lines.push("Artwork results were already shown. quickReplies MUST be []. Do not suggest refinements (price, color, medium, etc.).");
    }
  }
  lines.push("--- END LIVE SESSION STATE ---");
  return lines.join("\n");
}

module.exports = {computeProgress, buildStateBlock, FLOWS, SKIPPED};

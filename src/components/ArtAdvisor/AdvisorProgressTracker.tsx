import React, { useState } from "react";
import { MdExpandMore, MdEdit, MdCheck, MdRemove } from "react-icons/md";
import { AdvisorProgress, AdvisorProgressStep } from "../../services/artAdvisorService";

interface Props {
  progress: AdvisorProgress;
  /** Sends the step's edit prompt as a user message. */
  onEditStep: (step: AdvisorProgressStep) => void;
  disabled?: boolean;
}

const AdvisorProgressTracker: React.FC<Props> = ({ progress, onEditStep, disabled = false }) => {
  const [expanded, setExpanded] = useState(false);

  if (!progress || progress.total === 0) return null;

  return (
    <div className={`aa-progress ${expanded ? "aa-progress-expanded" : ""}`}>
      <button
        type="button"
        className="aa-progress-summary"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={`${progress.flowLabel}: ${progress.done} of ${progress.total} steps complete. Tap to review or edit your answers.`}
      >
        <span className="aa-progress-label">{progress.flowLabel}</span>
        <span className="aa-progress-count">{progress.done}/{progress.total}</span>
        <span className="aa-progress-bar" aria-hidden>
          <span className="aa-progress-bar-fill" style={{ width: `${progress.percent}%` }} />
        </span>
        <span className={`aa-progress-chevron ${expanded ? "aa-progress-chevron-up" : ""}`} aria-hidden>
          {MdExpandMore({ size: 18 })}
        </span>
      </button>

      {expanded && (
        <div className="aa-progress-steps">
          {progress.steps.map((step) => {
            const isEditable = step.status !== "pending" && !disabled;
            return (
              <button
                key={step.id}
                type="button"
                className={`aa-progress-step aa-progress-step-${step.status}`}
                onClick={() => isEditable && onEditStep(step)}
                disabled={!isEditable}
                title={isEditable ? `Tap to change ${step.label.toLowerCase()}` : undefined}
              >
                <span className="aa-progress-step-icon" aria-hidden>
                  {step.status === "filled" && MdCheck({ size: 13 })}
                  {step.status === "skipped" && MdRemove({ size: 13 })}
                </span>
                <span className="aa-progress-step-text">
                  <span className="aa-progress-step-label">{step.label}</span>
                  {step.status === "filled" && step.value && (
                    <span className="aa-progress-step-value">{step.value}</span>
                  )}
                  {step.status === "skipped" && (
                    <span className="aa-progress-step-value aa-progress-step-skipped">Skipped</span>
                  )}
                </span>
                {step.status !== "pending" && (
                  <span className="aa-progress-step-edit" aria-hidden>{MdEdit({ size: 13 })}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdvisorProgressTracker;

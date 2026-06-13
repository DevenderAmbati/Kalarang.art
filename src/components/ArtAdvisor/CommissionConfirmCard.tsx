import React from "react";
import { MdEdit } from "react-icons/md";
import { CommissionSummary } from "../../services/artAdvisorService";

interface Props {
  summary: CommissionSummary;
  onConfirm: () => void;
  onEditField: (prompt: string) => void;
  isSubmitting?: boolean;
  isActive?: boolean;
}

const CommissionConfirmCard: React.FC<Props> = ({
  summary,
  onConfirm,
  onEditField,
  isSubmitting = false,
  isActive = true,
}) => {
  const rows: Array<{ label: string; value: string; editPrompt: string } | null> = [
    { label: "Title", value: summary.title || summary.subject, editPrompt: "I'd like to change the title." },
    { label: "Description", value: summary.description, editPrompt: "I'd like to change the description." },
    { label: "Size", value: summary.size || "Not specified", editPrompt: "I'd like to change the size." },
    { label: "Budget", value: summary.budget, editPrompt: "I'd like to change my budget." },
    { label: "Deadline", value: summary.deadline, editPrompt: "I'd like to change the deadline." },
    { label: "Type", value: summary.medium, editPrompt: "I'd like to change the artwork type." },
    summary.style?.length > 0
      ? { label: "Style", value: summary.style.join(", "), editPrompt: "I'd like to change the style." }
      : null,
    summary.subjectTags?.length > 0
      ? { label: "Subject", value: summary.subjectTags.join(", "), editPrompt: "I'd like to change the subject." }
      : null,
    { label: "Delivery", value: summary.deliveryType || "Not specified", editPrompt: "I'd like to change delivery details." },
    summary.deliveryType === "Physical artwork"
      ? { label: "Location", value: summary.cityOrPincode, editPrompt: "I'd like to change the delivery location." }
      : null,
    summary.referenceImageCount > 0
      ? { label: "References", value: `${summary.referenceImageCount} image(s)`, editPrompt: "I'd like to change my reference images." }
      : null,
  ];

  return (
    <div className="aa-commission-card">
      <h4 className="aa-commission-card-title">Your Commission Summary</h4>
      <p className="aa-commission-card-hint">Tap any detail to change it before posting.</p>
      <dl className="aa-commission-card-list">
        {rows.filter(Boolean).map((row) => (
          <div key={row!.label}>
            <dt>{row!.label}</dt>
            <dd>
              {isActive ? (
                <button
                  type="button"
                  className="aa-commission-field-btn"
                  onClick={() => onEditField(row!.editPrompt)}
                  disabled={isSubmitting}
                  title={`Change ${row!.label.toLowerCase()}`}
                >
                  <span>{row!.value}</span>
                  <span className="aa-commission-field-edit" aria-hidden>{MdEdit({ size: 12 })}</span>
                </button>
              ) : (
                <span>{row!.value}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="aa-commission-card-actions">
        <button
          type="button"
          className="aa-btn-secondary"
          onClick={() => onEditField("I'd like to change something before posting.")}
          disabled={isSubmitting || !isActive}
        >
          Make changes
        </button>
        <button
          type="button"
          className="aa-btn-primary"
          onClick={onConfirm}
          disabled={isSubmitting || !isActive}
        >
          {isSubmitting ? "Posting…" : "Post Commission"}
        </button>
      </div>
    </div>
  );
};

export default CommissionConfirmCard;

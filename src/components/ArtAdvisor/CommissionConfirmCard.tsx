import React from "react";
import { CommissionSummary } from "../../services/artAdvisorService";

interface Props {
  summary: CommissionSummary;
  onConfirm: () => void;
  onEdit: () => void;
  isSubmitting?: boolean;
}

const CommissionConfirmCard: React.FC<Props> = ({ summary, onConfirm, onEdit, isSubmitting = false }) => {
  return (
    <div className="aa-commission-card">
      <h4 className="aa-commission-card-title">Your Commission Summary</h4>
      <dl className="aa-commission-card-list">
        <div><dt>Subject</dt><dd>{summary.subject}</dd></div>
        <div><dt>Type</dt><dd>{summary.medium}</dd></div>
        <div><dt>Size</dt><dd>{summary.size || "Not specified"}</dd></div>
        <div><dt>Budget</dt><dd>{summary.budget}</dd></div>
        <div><dt>Deadline</dt><dd>{summary.deadline}</dd></div>
        <div><dt>Location</dt><dd>{summary.cityOrPincode}</dd></div>
        {summary.style?.length > 0 && (
          <div><dt>Style</dt><dd>{summary.style.join(", ")}</dd></div>
        )}
        {summary.referenceImageCount > 0 && (
          <div><dt>References</dt><dd>{summary.referenceImageCount} image(s)</dd></div>
        )}
      </dl>
      <div className="aa-commission-card-actions">
        <button type="button" className="aa-btn-secondary" onClick={onEdit} disabled={isSubmitting}>
          Keep chatting
        </button>
        <button type="button" className="aa-btn-primary" onClick={onConfirm} disabled={isSubmitting}>
          {isSubmitting ? "Posting…" : "Post Commission"}
        </button>
      </div>
    </div>
  );
};

export default CommissionConfirmCard;

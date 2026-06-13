import React from "react";
import { useNavigate } from "react-router-dom";
import { MdSmartToy, MdPalette, MdChair, MdBrush, MdExplore } from "react-icons/md";
import { AdvisorMessage } from "../../services/artAdvisorService";
import ArtworkRecommendationCard from "./ArtworkRecommendationCard";
import CommissionConfirmCard from "./CommissionConfirmCard";

const SUGGESTED_PROMPTS = [
  {
    icon: MdPalette,
    label: "find artwork for me",
    text: "I want to find artwork for me.",
  },
  {
    icon: MdChair,
    label: "style my space",
    text: "I want to style my space.",
  },
  {
    icon: MdBrush,
    label: "commission custom art",
    text: "I want to commission a custom artwork.",
  },
  {
    icon: MdExplore,
    label: "just explore ideas",
    text: "I want to just explore ideas — what kinds of art can I find on Kalarang?",
  },
];

interface Props {
  messages: AdvisorMessage[];
  onConfirmCommission: () => void;
  onSuggestionClick?: (text: string) => void;
  isSubmittingCommission?: boolean;
  isTyping?: boolean;
  isRestoring?: boolean;
}

const BotAvatar: React.FC<{ small?: boolean }> = ({ small }) => (
  <div className={`aa-bot-avatar ${small ? "aa-bot-avatar-sm" : ""}`} aria-hidden>
    {MdSmartToy({ size: small ? 20 : 36 })}
  </div>
);

const ArtAdvisorMessageList: React.FC<Props> = ({
  messages,
  onConfirmCommission,
  onSuggestionClick,
  isSubmittingCommission = false,
  isTyping = false,
  isRestoring = false,
}) => {
  const navigate = useNavigate();
  const showSuggestions = messages.length === 0 && !isTyping && !isRestoring;
  const lastMsg = messages[messages.length - 1];
  const showQuickReplies = !isTyping && lastMsg?.role === "assistant" && lastMsg.quickReplies?.length;

  return (
    <div className="aa-messages-wrap">
      {isRestoring && messages.length === 0 && (
        <div className="aa-restoring">Restoring your conversation…</div>
      )}

      {showSuggestions && (
        <div className="aa-welcome">
          <BotAvatar />
          <p className="aa-welcome-title">Hi, I'm Kala</p>
          <p className="aa-welcome-sub">Your personal AI art consultant</p>
          <p className="aa-welcome-prompt">I want to…</p>
          <div className="aa-suggestions">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p.text}
                type="button"
                className="aa-suggestion-pill"
                onClick={() => onSuggestionClick?.(p.text)}
              >
                <span className="aa-suggestion-icon" aria-hidden>{p.icon({ size: 15 })}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="aa-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`aa-message-row aa-message-row-${msg.role}`}>
            {msg.role === "assistant" && <BotAvatar small />}
            <div className={`aa-message aa-message-${msg.role}`}>
              <div className="aa-message-bubble">{msg.content}</div>

              {msg.role === "assistant" && msg.artworkRecommendations && msg.artworkRecommendations.length > 0 && (
                <div className="aa-artwork-grid">
                  {msg.artworkRecommendations.map((a) => (
                    <ArtworkRecommendationCard key={a.id} artwork={a} />
                  ))}
                </div>
              )}

              {msg.role === "assistant" && msg.artistRecommendations && msg.artistRecommendations.length > 0 && (
                <div className="aa-artist-list">
                  {msg.artistRecommendations.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="aa-artist-chip"
                      onClick={() => navigate(`/portfolio/${a.id}`)}
                      title={`View ${a.name}'s portfolio`}
                    >
                      {a.avatar && <img src={a.avatar} alt="" />}
                      <span>{a.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {msg.role === "assistant" && msg.action === "confirm_commission" && msg.commissionSummary && (
                <CommissionConfirmCard
                  summary={msg.commissionSummary}
                  onConfirm={onConfirmCommission}
                  onEditField={(prompt) => onSuggestionClick?.(prompt)}
                  isSubmitting={isSubmittingCommission}
                  isActive={msg.id === lastMsg?.id}
                />
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="aa-message-row aa-message-row-assistant">
            <BotAvatar small />
            <div className="aa-typing-bubble">
              <span className="aa-typing-label">Thinking</span>
              <span className="aa-typing-dots">
                <span /><span /><span />
              </span>
            </div>
          </div>
        )}
      </div>

      {showQuickReplies && (
        <div className="aa-quick-replies">
          {lastMsg.quickReplies!.map((reply) => (
            <button
              key={reply}
              type="button"
              className={`aa-quick-reply-btn${/^custom$/i.test(reply) ? " aa-quick-reply-btn-custom" : ""}`}
              onClick={() => onSuggestionClick?.(reply)}
            >
              {reply}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArtAdvisorMessageList;

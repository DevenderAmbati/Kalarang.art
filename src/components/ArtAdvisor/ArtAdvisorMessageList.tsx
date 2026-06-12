import React from "react";
import { MdSmartToy } from "react-icons/md";
import { AdvisorMessage } from "../../services/artAdvisorService";
import ArtworkRecommendationCard from "./ArtworkRecommendationCard";
import CommissionConfirmCard from "./CommissionConfirmCard";

const SUGGESTED_PROMPTS = [
  { label: "Find art for my space", text: "I need a painting for my living room" },
  { label: "Browse under ₹5,000", text: "Show me paintings under ₹5,000" },
  { label: "Commission custom art", text: "I want to commission a custom artwork" },
  { label: "Pet portrait", text: "I want a portrait of my pet" },
];

interface Props {
  messages: AdvisorMessage[];
  onConfirmCommission: () => void;
  onSuggestionClick?: (text: string) => void;
  isSubmittingCommission?: boolean;
  isTyping?: boolean;
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
}) => {
  const showSuggestions = messages.length === 0 && !isTyping;
  const lastMsg = messages[messages.length - 1];
  const showQuickReplies = !isTyping && lastMsg?.role === "assistant" && lastMsg.quickReplies?.length;

  return (
    <div className="aa-messages-wrap">
      {showSuggestions && (
        <div className="aa-welcome">
          <BotAvatar />
          <p className="aa-welcome-title">Kalarang AI Art Advisor</p>
          <p className="aa-welcome-sub">
            Hi! I can help you find the perfect artwork or commission something custom. What would you like to do?
          </p>
          <div className="aa-suggestions">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p.text}
                type="button"
                className="aa-suggestion-chip"
                onClick={() => onSuggestionClick?.(p.text)}
              >
                {p.label}
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
                    <div key={a.id} className="aa-artist-chip">
                      {a.avatar && <img src={a.avatar} alt="" />}
                      <span>{a.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {msg.role === "assistant" && msg.action === "confirm_commission" && msg.commissionSummary && (
                <CommissionConfirmCard
                  summary={msg.commissionSummary}
                  onConfirm={onConfirmCommission}
                  onEdit={() => {}}
                  isSubmitting={isSubmittingCommission}
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
              className="aa-quick-reply-btn"
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

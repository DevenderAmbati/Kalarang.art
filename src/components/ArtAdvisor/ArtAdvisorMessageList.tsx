import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MdSmartToy, MdPalette, MdChair, MdBrush, MdExplore } from "react-icons/md";
import { AdvisorMessage, ArtworkRecommendation } from "../../services/artAdvisorService";
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
    label: "explore ideas",
    text: "I want to just explore ideas — what kinds of art can I find on Kalarang?",
  },
];

interface Props {
  messages: AdvisorMessage[];
  onConfirmCommission: () => void;
  onSuggestionClick?: (text: string) => void;
  onNavigateAway?: () => void;
  onLoadMoreArtworks?: (messageId: string) => Promise<void>;
  isSubmittingCommission?: boolean;
  isTyping?: boolean;
  isRestoring?: boolean;
}

const ArtworkGrid: React.FC<{
  artworks: ArtworkRecommendation[];
  hasMore: boolean;
  messageId: string;
  onNavigateAway?: () => void;
  onLoadMore?: (messageId: string) => Promise<void>;
}> = ({ artworks, hasMore, messageId, onNavigateAway, onLoadMore }) => {
  const [loading, setLoading] = useState(false);

  const handleShowMore = useCallback(async () => {
    if (!onLoadMore || loading) return;
    setLoading(true);
    try {
      await onLoadMore(messageId);
    } finally {
      setLoading(false);
    }
  }, [onLoadMore, messageId, loading]);

  return (
    <div className="aa-artwork-grid">
      {artworks.map((a) => (
        <ArtworkRecommendationCard key={a.id} artwork={a} onNavigateAway={onNavigateAway} />
      ))}
      {hasMore && (
        <button
          type="button"
          className="aa-show-more-pill"
          onClick={handleShowMore}
          disabled={loading}
        >
          {loading ? "Loading…" : "Show more"}
        </button>
      )}
    </div>
  );
};

const BotAvatar: React.FC<{ small?: boolean }> = ({ small }) => (
  <div className={`aa-bot-avatar ${small ? "aa-bot-avatar-sm" : ""}`} aria-hidden>
    {MdSmartToy({ size: small ? 20 : 36 })}
  </div>
);

const ArtAdvisorMessageList: React.FC<Props> = ({
  messages,
  onConfirmCommission,
  onSuggestionClick,
  onNavigateAway,
  onLoadMoreArtworks,
  isSubmittingCommission = false,
  isTyping = false,
  isRestoring = false,
}) => {
  const navigate = useNavigate();
  const showSuggestions = messages.length === 0 && !isTyping && !isRestoring;
  const lastMsg = messages[messages.length - 1];
  const showQuickReplies =
    !isTyping &&
    lastMsg?.role === "assistant" &&
    lastMsg.quickReplies?.length &&
    !(lastMsg.artworkRecommendations && lastMsg.artworkRecommendations.length > 0);

  return (
    <div className="aa-messages-wrap">
      {isRestoring && messages.length === 0 && (
        <div className="aa-restoring">Restoring your conversation…</div>
      )}

      {showSuggestions && (
        <div className="aa-welcome">
          <BotAvatar />
          <p className="aa-welcome-title">Hi, I'm Kalaa</p>
          <p className="aa-welcome-sub">Your personal AI art consultant</p>
          <p className="aa-welcome-prompt">How can I help you today?</p>
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
                <ArtworkGrid
                  artworks={msg.artworkRecommendations}
                  hasMore={
                    msg.hasMoreArtworks === true ||
                    (msg.totalArtworkMatches != null &&
                      msg.totalArtworkMatches > msg.artworkRecommendations.length)
                  }
                  messageId={msg.id}
                  onNavigateAway={onNavigateAway}
                  onLoadMore={onLoadMoreArtworks}
                />
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
              className={`aa-quick-reply-btn${/^(other|custom)$/i.test(reply) ? " aa-quick-reply-btn-custom" : ""}`}
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

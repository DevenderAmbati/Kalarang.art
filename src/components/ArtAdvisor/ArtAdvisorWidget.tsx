import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { MdSmartToy, MdClose, MdImage, MdSend, MdRefresh } from "react-icons/md";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { useArtAdvisor } from "../../context/ArtAdvisorContext";
import { useDrawerBackNavigation } from "../../hooks/useDrawerBackNavigation";
import {
  AdvisorMessage,
  AdvisorProgressStep,
  PendingCommissionField,
  sendAdvisorMessage,
  hydrateAdvisorSession,
  loadMoreArtworks,
  getAdvisorErrorMessage,
} from "../../services/artAdvisorService";
import { createCommissionRequest, COMMISSION_LISTS_UPDATED_EVENT, COMMISSION_POSTED_EVENT } from "../../services/commissionService";
import ArtAdvisorMessageList from "./ArtAdvisorMessageList";
import AdvisorProgressTracker from "./AdvisorProgressTracker";
import "./ArtAdvisorWidget.css";

const MAX_REFERENCE_IMAGES = 1;

const ArtAdvisorWidget: React.FC = () => {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const {
    isOpen, setIsOpen,
    sessionId, messages, setMessages,
    progress, setProgress,
    setIntent,
    isHydrated, setIsHydrated,
    referenceFiles, setReferenceFiles,
    pendingCommissionPayload, setPendingCommissionPayload,
    resetSession,
  } = useArtAdvisor();

  const [input, setInput] = useState("");
  const [inputPlaceholder, setInputPlaceholder] = useState("Type your answer, or ask me anything…");
  const [pendingCommissionField, setPendingCommissionField] = useState<PendingCommissionField | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [isSubmittingCommission, setIsSubmittingCommission] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const navigatingAwayRef = useRef(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 220);
  }, [setIsOpen]);

  const handleNavigateAway = useCallback(() => {
    navigatingAwayRef.current = true;
    setIsOpen(false);
    setIsClosing(false);
  }, [setIsOpen]);

  useDrawerBackNavigation({
    drawerOpen: isOpen,
    activeChatId: null,
    onCloseDrawer: handleClose,
    onExitChat: () => { },
    navigatingAwayRef,
  });

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 300);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  // Restore the stored conversation on first open so reloads don't wipe the chat.
  useEffect(() => {
    if (!isOpen || isHydrated) return;
    let cancelled = false;
    setIsHydrating(true);
    hydrateAdvisorSession(sessionId)
      .then((data) => {
        if (cancelled) return;
        if (data.messages.length > 0) {
          setMessages(
            data.messages.map((m, i) => ({
              id: `restored-${i}`,
              role: m.role,
              content: m.content,
              quickReplies: m.quickReplies?.length ? m.quickReplies : undefined,
              timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
            })),
          );
          setProgress(data.progress);
          setIntent(data.intent);
        }
      })
      .catch(() => {
        // Hydration is best-effort; the user can still chat.
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydrating(false);
          setIsHydrated(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, isHydrated, sessionId, setMessages, setProgress, setIntent, setIsHydrated]);

  const submitMessage = async (text: string, options?: { files?: File[] }) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const attachedFiles = options?.files ?? referenceFiles;

    const userMsg: AdvisorMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    try {
      const response = await sendAdvisorMessage(
        sessionId,
        trimmed,
        undefined,
        attachedFiles.length > 0 ? attachedFiles.length : undefined,
      );

      if (response.commissionSummary) {
        response.commissionSummary.referenceImageCount = attachedFiles.length;
      }

      const assistantMsg: AdvisorMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.reply,
        artworkRecommendations: response.artworkRecommendations,
        hasMoreArtworks: response.hasMoreArtworks,
        totalArtworkMatches: response.totalArtworkMatches,
        artistRecommendations: response.artistRecommendations,
        commissionSummary: response.commissionSummary,
        action: response.action || undefined,
        quickReplies: response.quickReplies?.length ? response.quickReplies : undefined,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setProgress(response.progress);
      setIntent(response.intent);
      setPendingCommissionField(response.pendingCommissionField || null);
      if (response.pendingCommissionField?.inputPlaceholder) {
        setInputPlaceholder(response.pendingCommissionField.inputPlaceholder);
      } else {
        setInputPlaceholder("Type your answer, or ask me anything…");
      }

      if (response.commissionPayload) {
        setPendingCommissionPayload(response.commissionPayload);
      }
    } catch (err: unknown) {
      const message = getAdvisorErrorMessage(err);
      toast.error(message);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: message,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = () => submitMessage(input);

  const handleSuggestion = (text: string) => {
    if (/^(other|custom)$/i.test(text.trim())) {
      const placeholder = pendingCommissionField?.inputPlaceholder ||
        `Enter ${pendingCommissionField?.label?.toLowerCase() || "your answer"}…`;
      setInputPlaceholder(placeholder);
      inputRef.current?.focus();
      return;
    }
    if (text === "Use 📎 to attach") {
      if (referenceFiles.length >= MAX_REFERENCE_IMAGES) return;
      fileInputRef.current?.click();
      return;
    }
    submitMessage(text);
  };

  const handleEditStep = (step: AdvisorProgressStep) => {
    submitMessage(step.editPrompt);
  };

  const handleLoadMoreArtworks = useCallback(async (messageId: string) => {
    try {
      const response = await loadMoreArtworks(sessionId);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                artworkRecommendations: [
                  ...(msg.artworkRecommendations || []),
                  ...response.artworkRecommendations,
                ],
                hasMoreArtworks: response.hasMoreArtworks,
              }
            : msg,
        ),
      );
    } catch {
      toast.error("Failed to load more artworks.");
    }
  }, [sessionId, setMessages]);

  const handleNewChat = () => {
    if (isSending) return;
    resetSession();
    setPendingCommissionField(null);
    setInputPlaceholder("Type your answer, or ask me anything…");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isReferenceImageStep = pendingCommissionField?.id === "referenceImages";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = Array.from(e.target.files || [])
      .find((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (!file) return;

    const files = [file];
    setReferenceFiles(files);

    if (pendingCommissionField?.id === "referenceImages") {
      void submitMessage(`📎 ${file.name}`, { files });
    }
  };

  const handleConfirmCommission = async () => {
    if (!pendingCommissionPayload) {
      toast.error("No commission draft ready. Keep chatting to fill in details.");
      return;
    }
    if (!appUser?.uid) {
      toast.info("Please sign in to post a commission request.");
      navigate("/login", { state: { from: "/commissions", advisorPending: true } });
      return;
    }

    setIsSubmittingCommission(true);
    try {
      await createCommissionRequest(
        appUser.uid,
        appUser.name || "Buyer",
        appUser.avatar,
        pendingCommissionPayload,
        referenceFiles,
      );
      toast.success("Commission request posted!");
      setPendingCommissionPayload(null);
      setReferenceFiles([]);
      setPendingCommissionField(null);
      resetSession();
      window.dispatchEvent(new CustomEvent(COMMISSION_LISTS_UPDATED_EVENT));
      window.dispatchEvent(new CustomEvent(COMMISSION_POSTED_EVENT));
      handleClose();
      navigate("/commissions", { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to post commission.";
      toast.error(message);
    } finally {
      setIsSubmittingCommission(false);
    }
  };

  const chatPanel = (
    <div className={`aa-chat-panel ${isClosing ? "aa-chat-panel-closing" : ""}`} role="dialog" aria-label="AI Art Advisor">
      <header className="aa-chat-header">
        <div className="aa-chat-header-left">
          <div className="aa-bot-avatar aa-bot-avatar-header">
            {MdSmartToy({ size: 22 })}
            <span className="aa-online-dot" aria-label="Online" />
          </div>
          <div className="aa-chat-header-text">
            <h2 className="aa-chat-title">Kalaa</h2>
            <p className="aa-chat-status">Your art consultant · Online</p>
          </div>
        </div>
        <div className="aa-chat-header-actions">
          {messages.length > 0 && (
            <button type="button" className="aa-header-btn" onClick={handleNewChat} aria-label="Start new chat" title="Start new chat">
              {MdRefresh({})}
            </button>
          )}
          <button type="button" className="aa-header-btn" onClick={handleClose} aria-label="Close" title="Close">
            {MdClose({})}
          </button>
        </div>
      </header>

      {progress && progress.intent === 'commission' && progress.done > 0 && (
        <AdvisorProgressTracker progress={progress} onEditStep={handleEditStep} disabled={isSending} />
      )}

      <div className="aa-chat-body">
        <ArtAdvisorMessageList
          messages={messages}
          onConfirmCommission={handleConfirmCommission}
          onSuggestionClick={handleSuggestion}
          onNavigateAway={handleNavigateAway}
          onLoadMoreArtworks={handleLoadMoreArtworks}
          isSubmittingCommission={isSubmittingCommission}
          isTyping={isSending}
          isRestoring={isHydrating}
        />
        <div ref={messagesEndRef} />
      </div>

      {isReferenceImageStep && referenceFiles.length > 0 && (
        <div className="aa-ref-preview">
          {referenceFiles.map((f) => (
            <span key={f.name} className="aa-ref-chip">{f.name}</span>
          ))}
          <button type="button" onClick={() => setReferenceFiles([])}>Clear</button>
        </div>
      )}

      <footer className="aa-chat-footer">
        <div className="aa-input-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFileSelect}
          />
          {isReferenceImageStep && (
          <button
            type="button"
            className="aa-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach reference image"
            title="Attach one reference photo"
            disabled={referenceFiles.length >= MAX_REFERENCE_IMAGES}
          >
            {MdImage({})}
          </button>
          )}
          <textarea
            ref={inputRef}
            className="aa-input"
            placeholder={inputPlaceholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isSending}
          />
          <button
            type="button"
            className="aa-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            aria-label="Send message"
          >
            {MdSend({})}
          </button>
        </div>
        <p className="aa-powered-by">Powered by AI · Recommendations from Kalarang catalog</p>
      </footer>
    </div>
  );

  return createPortal(
    <div className="aa-widget-root">
      {isOpen && (
        <>
          <div
            className={`aa-overlay ${isClosing ? "aa-overlay-closing" : ""}`}
            onClick={handleClose}
            aria-hidden
          />
          {chatPanel}
        </>
      )}

      {!isOpen && (
        <button
          type="button"
          className="aa-launcher"
          onClick={() => setIsOpen(true)}
          aria-label="Open AI Art Advisor"
          title="AI Art Advisor"
        >
          {MdSmartToy({ size: 24, color: "#fff" })}
        </button>
      )}
    </div>,
    document.body,
  );
};

export default ArtAdvisorWidget;

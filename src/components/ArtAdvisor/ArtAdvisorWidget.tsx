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
  getAdvisorErrorMessage,
} from "../../services/artAdvisorService";
import { createCommissionRequest } from "../../services/commissionService";
import ArtAdvisorMessageList from "./ArtAdvisorMessageList";
import AdvisorProgressTracker from "./AdvisorProgressTracker";
import "./ArtAdvisorWidget.css";

const MAX_REFERENCE_IMAGES = 2;

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

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 220);
  }, [setIsOpen]);

  useDrawerBackNavigation({
    drawerOpen: isOpen,
    activeChatId: null,
    onCloseDrawer: handleClose,
    onExitChat: () => {},
  });

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
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

  const submitMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

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
      const refNote = referenceFiles.length
        ? ` (User attached ${referenceFiles.length} reference image${referenceFiles.length > 1 ? "s" : ""}.)`
        : "";
      const response = await sendAdvisorMessage(sessionId, trimmed + refNote);

      if (response.commissionSummary) {
        response.commissionSummary.referenceImageCount = referenceFiles.length;
      }

      const assistantMsg: AdvisorMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.reply,
        artworkRecommendations: response.artworkRecommendations,
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
    if (/^custom$/i.test(text.trim())) {
      const placeholder = pendingCommissionField?.inputPlaceholder ||
        `Enter ${pendingCommissionField?.label?.toLowerCase() || "your answer"}…`;
      setInputPlaceholder(placeholder);
      inputRef.current?.focus();
      return;
    }
    if (text === "Use 📎 to attach") {
      fileInputRef.current?.click();
      return;
    }
    submitMessage(text);
  };

  const handleEditStep = (step: AdvisorProgressStep) => {
    submitMessage(step.editPrompt);
  };

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_REFERENCE_IMAGES);
    setReferenceFiles(files);
    e.target.value = "";
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
      setMessages((prev) => [
        ...prev,
        {
          id: `success-${Date.now()}`,
          role: "assistant",
          content: "Your commission request is live! Artists can now apply. Good luck!",
          timestamp: new Date(),
        },
      ]);
      handleClose();
      navigate("/commissions");
      window.dispatchEvent(new CustomEvent("kalarang:commission-lists-updated"));
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
            <h2 className="aa-chat-title">Kala</h2>
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

      {progress && progress.done > 0 && (
        <AdvisorProgressTracker progress={progress} onEditStep={handleEditStep} disabled={isSending} />
      )}

      <div className="aa-chat-body">
        <ArtAdvisorMessageList
          messages={messages}
          onConfirmCommission={handleConfirmCommission}
          onSuggestionClick={handleSuggestion}
          isSubmittingCommission={isSubmittingCommission}
          isTyping={isSending}
          isRestoring={isHydrating}
        />
        <div ref={messagesEndRef} />
      </div>

      {referenceFiles.length > 0 && (
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
            multiple
            hidden
            onChange={handleFileSelect}
          />
          <button
            type="button"
            className="aa-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach reference image"
            title="Attach reference photos"
          >
            {MdImage({})}
          </button>
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

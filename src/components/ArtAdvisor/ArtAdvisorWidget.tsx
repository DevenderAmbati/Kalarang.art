import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { MdSmartToy, MdClose, MdImage, MdSend, MdMinimize } from "react-icons/md";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { useArtAdvisor } from "../../context/ArtAdvisorContext";
import { useDrawerBackNavigation } from "../../hooks/useDrawerBackNavigation";
import {
  AdvisorMessage,
  sendAdvisorMessage,
} from "../../services/artAdvisorService";
import { createCommissionRequest } from "../../services/commissionService";
import ArtAdvisorMessageList from "./ArtAdvisorMessageList";
import "./ArtAdvisorWidget.css";

const MAX_REFERENCE_IMAGES = 2;

function extractQuickReplies(text: string): string[] {
  const replies: string[] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    const match = line.match(/^[\s]*[-•*]\s+(.+)$/) || line.match(/^[\s]*\d+[.)]\s+(.+)$/);
    if (match) {
      let option = match[1].replace(/\*\*/g, "").trim();
      if (option.length > 1 && option.length <= 60) {
        replies.push(option);
      }
    }
  }
  if (replies.length < 2 || replies.length > 10) return [];
  return replies;
}

const ArtAdvisorWidget: React.FC = () => {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const {
    isOpen, setIsOpen,
    sessionId, messages, setMessages,
    referenceFiles, setReferenceFiles,
    pendingCommissionPayload, setPendingCommissionPayload,
  } = useArtAdvisor();

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
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

      const quickReplies = extractQuickReplies(response.reply);

      const assistantMsg: AdvisorMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.reply,
        artworkRecommendations: response.artworkRecommendations,
        artistRecommendations: response.artistRecommendations,
        commissionSummary: response.commissionSummary,
        action: response.action || undefined,
        quickReplies: quickReplies.length > 0 ? quickReplies : undefined,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (response.commissionPayload) {
        setPendingCommissionPayload(response.commissionPayload);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast.error(message);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I couldn't process that right now. Please try again in a moment.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = () => submitMessage(input);

  const handleSuggestion = (text: string) => {
    setInput(text);
    submitMessage(text);
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
            <h2 className="aa-chat-title">Kalarang AI</h2>
            <p className="aa-chat-status">Art Advisor · Online</p>
          </div>
        </div>
        <div className="aa-chat-header-actions">
          <button type="button" className="aa-header-btn" onClick={handleClose} aria-label="Minimize">
            {MdMinimize({})}
          </button>
          <button type="button" className="aa-header-btn" onClick={handleClose} aria-label="Close">
            {MdClose({})}
          </button>
        </div>
      </header>

      <div className="aa-chat-body">
        <ArtAdvisorMessageList
          messages={messages}
          onConfirmCommission={handleConfirmCommission}
          onSuggestionClick={handleSuggestion}
          isSubmittingCommission={isSubmittingCommission}
          isTyping={isSending}
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
            placeholder="Ask me anything about art…"
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

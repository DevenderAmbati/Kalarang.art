import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import LazyImage from "../Common/LazyImage";
import {
  subscribeToArtworkComments,
  addArtworkComment,
  deleteArtworkComment,
  ArtworkComment,
} from "../../services/commentService";
import { Artwork } from "../../types/artwork";
import { AppUser } from "../../types/user";
import { toast } from "react-toastify";
import "./ArtworkCommentModal.css";

interface ArtworkCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  artwork: Artwork | null;
  appUser: AppUser | null;
}

function formatCommentTime(d: Date | null): string {
  if (!d) return "";
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Group flat snapshot into parent → children (orphans treated as top-level). */
function groupCommentsByParent(comments: ArtworkComment[]): Map<string | null, ArtworkComment[]> {
  const idSet = new Set(comments.map((c) => c.id));
  const byParent = new Map<string | null, ArtworkComment[]>();
  for (const c of comments) {
    let parent: string | null = c.parentCommentId ?? null;
    if (parent && !idSet.has(parent)) {
      parent = null;
    }
    if (!byParent.has(parent)) {
      byParent.set(parent, []);
    }
    byParent.get(parent)!.push(c);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  }
  return byParent;
}

const ArtworkCommentModal: React.FC<ArtworkCommentModalProps> = ({
  isOpen,
  onClose,
  artwork,
  appUser,
}) => {
  const navigate = useNavigate();
  const [comments, setComments] = useState<ArtworkComment[]>([]);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ArtworkComment | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const isArtistOwner =
    Boolean(appUser && artwork && appUser.uid === artwork.artistId);

  const commentsByParent = useMemo(() => groupCommentsByParent(comments), [comments]);

  /** One-level reply only, and not to the artist's own top-level comment. */
  const showReplyComposer = useMemo(() => {
    if (!replyingTo || !isArtistOwner || !artwork) return false;
    return !replyingTo.parentCommentId && replyingTo.userId !== artwork.artistId;
  }, [replyingTo, isArtistOwner, artwork]);

  useEffect(() => {
    if (!isOpen || !artwork?.id) return;

    const unsub = subscribeToArtworkComments(
      artwork.id,
      (list) => setComments(list),
      () => {
        toast.error("Could not load comments");
      }
    );
    return () => unsub();
  }, [isOpen, artwork?.id]);

  useEffect(() => {
    if (!isOpen) {
      setDraft("");
      setComments([]);
      setReplyingTo(null);
      setShowEmojiPicker(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!showEmojiPicker) return;
      const target = e.target as Node;
      const insidePicker = emojiPickerRef.current?.contains(target);
      const insideButton = emojiButtonRef.current?.contains(target);
      if (!insidePicker && !insideButton) setShowEmojiPicker(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  const submitComment = useCallback(async () => {
    if (!appUser || !artwork?.id) return;
    const text = draft.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    try {
      const replyParentId =
        showReplyComposer && replyingTo ? replyingTo.id : undefined;
      await addArtworkComment(
        artwork.id,
        appUser.uid,
        appUser.name,
        appUser.avatar,
        text,
        replyParentId
      );
      setDraft("");
      setReplyingTo(null);
      setShowEmojiPicker(false);
    } catch {
      toast.error("Could not post comment");
    } finally {
      setSubmitting(false);
    }
  }, [
    appUser,
    artwork,
    draft,
    submitting,
    showReplyComposer,
    replyingTo,
  ]);

  useLayoutEffect(() => {
    if (!isOpen || !artwork) return;
    const ta = inputRef.current;
    if (!ta) return;
    const style = getComputedStyle(ta);
    const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const max = parseFloat(style.maxHeight) || 200;
    ta.style.height = "0px";
    const contentHeight = ta.scrollHeight - paddingY;
    ta.style.height = `${Math.min(Math.max(contentHeight, 0), max)}px`;
  }, [draft, isOpen, artwork]);

  useEffect(() => {
    if (!listRef.current || comments.length === 0) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [comments.length]);

  if (!isOpen || !artwork) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitComment();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitComment();
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setDraft((prev) => prev + emojiData.emoji);
  };

  const handleDelete = async (comment: ArtworkComment) => {
    if (!appUser || comment.userId !== appUser.uid) return;
    try {
      await deleteArtworkComment(comment.id, artwork.id);
      if (replyingTo?.id === comment.id) {
        setReplyingTo(null);
      }
    } catch {
      toast.error("Could not delete comment");
    }
  };

  const renderCommentBranch = (parentId: string | null, depth: number): React.ReactNode => {
    const items = commentsByParent.get(parentId) ?? [];
    return items.map((c) => (
      <div key={c.id} className="artwork-comment-thread">
        <div
          className={`artwork-comment-row ${depth > 0 ? "artwork-comment-row--reply" : ""}`}
          style={depth > 0 ? { marginLeft: Math.min(depth, 8) * 12 } : undefined}
        >
          <div className="artwork-comment-avatar">
            <LazyImage src={c.userAvatar} alt="" />
          </div>
          <div className="artwork-comment-body">
            <div className="artwork-comment-meta">
              <span className="artwork-comment-name">{c.userName}</span>
              <span className="artwork-comment-time">{formatCommentTime(c.createdAt)}</span>
            </div>
            <p className="artwork-comment-text">{c.text}</p>
          </div>
          {((isArtistOwner && depth === 0 && c.userId !== artwork.artistId) ||
            (appUser && c.userId === appUser.uid)) && (
            <div className="artwork-comment-actions">
              {isArtistOwner &&
                depth === 0 &&
                c.userId !== artwork.artistId && (
                  <button
                    type="button"
                    className="artwork-comment-reply"
                    onClick={() => {
                      setReplyingTo(c);
                      setTimeout(() => inputRef.current?.focus(), 0);
                    }}
                  >
                    Reply
                  </button>
                )}
              {appUser && c.userId === appUser.uid && (
                <button
                  type="button"
                  className="artwork-comment-delete"
                  onClick={() => handleDelete(c)}
                  aria-label="Delete comment"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
        {depth === 0 ? renderCommentBranch(c.id, 1) : null}
      </div>
    ));
  };

  return createPortal(
    <div className="artwork-comment-modal-overlay" onClick={handleOverlayClick}>
      <div
        className="artwork-comment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="artwork-comment-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="artwork-comment-modal-header">
          <h2 id="artwork-comment-modal-title" className="artwork-comment-modal-title">
            Comments
          </h2>
          <p className="artwork-comment-modal-subtitle">{artwork.title}</p>
          <button
            type="button"
            className="artwork-comment-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="artwork-comment-modal-list" ref={listRef}>
          {comments.length === 0 ? (
            <p className="artwork-comment-modal-empty">No comments yet.</p>
          ) : (
            renderCommentBranch(null, 0)
          )}
        </div>

        {appUser ? (
          <form className="artwork-comment-modal-form" onSubmit={handleSubmit}>
            {showReplyComposer ? (
              <div className="artwork-comment-reply-banner">
                <span className="artwork-comment-reply-banner-text">
                  Replying to <strong>{replyingTo!.userName}</strong>
                </span>
                <button
                  type="button"
                  className="artwork-comment-reply-cancel"
                  onClick={() => setReplyingTo(null)}
                >
                  Cancel
                </button>
              </div>
            ) : null}
            {showEmojiPicker && (
              <div ref={emojiPickerRef} className="artwork-comment-emoji-picker-wrapper">
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  width="100%"
                  height={320}
                  previewConfig={{ showPreview: false }}
                  skinTonesDisabled
                />
              </div>
            )}
            <div className="artwork-comment-input-row">
              <textarea
                ref={inputRef}
                id="artwork-comment-input"
                className="artwork-comment-chat-input"
                placeholder={
                  showReplyComposer
                    ? "Write your reply…"
                    : "Add a comment…"
                }
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={submitting}
                maxLength={2000}
                rows={1}
                autoFocus
                aria-label={showReplyComposer ? "Your reply" : "Add a comment"}
              />
              <button
                ref={emojiButtonRef}
                type="button"
                className="artwork-comment-emoji-btn"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                disabled={submitting}
                aria-label="Emoji"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </button>
              <button
                type="submit"
                className="artwork-comment-send-btn"
                disabled={submitting || !draft.trim()}
                aria-label={showReplyComposer ? "Send reply" : "Post comment"}
                aria-busy={submitting}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </form>
        ) : (
          <div className="artwork-comment-modal-guest">
            <button
              type="button"
              className="artwork-comment-modal-signin"
              onClick={() => {
                onClose();
                navigate("/signup");
              }}
            >
              Sign in to comment
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ArtworkCommentModal;

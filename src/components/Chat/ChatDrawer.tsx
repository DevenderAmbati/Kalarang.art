import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../hooks/useChat';
import { useDrawerBackNavigation } from '../../hooks/useDrawerBackNavigation';
import { markChatRead, markMessagesAsSeen, getChatId } from '../../services/chatService';
import { useChatContext } from '../../context/ChatContext';
import { getUserProfile } from '../../services/userService';
import { createNotification } from '../../services/notificationService';
import { notifyServiceWorkerActiveChatId } from '../../services/fcmService';
import { downloadImageFromUrl, suggestedChatImageFilename } from '../../utils/downloadImage';
import './ChatDrawer.css';

export interface ChatContact {
  uid: string;
  name: string;
  avatar?: string;
}

/** Cache participant profiles so we don't refetch every time the drawer opens. */
const profileCache: Record<string, ChatContact> = {};

function avatarSrc(avatar?: string): string {
  return avatar || '/artist.png';
}

export interface ReachOutMetadata {
  artworkId: string;
  artworkTitle: string;
  artworkImage?: string;
  artworkPrice?: number;
}

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-selected contact — skips to chat view immediately (used from CardDetail) */
  initialContact?: ChatContact | null;
  /** Pre-filled message for the chat input (used from reach-out flow) */
  initialMessage?: string;
  /** Artwork metadata for reach-out notification (used when message is sent) */
  reachOutMetadata?: ReachOutMetadata | null;
}

/* ──────────────────────────────────────────────
   Conversation list (left/default view)
   ────────────────────────────────────────────── */

const ConversationList: React.FC<{
  onSelect: (contact: ChatContact) => void;
  activeUid?: string;
  activeChatId?: string;
}> = ({ onSelect, activeUid, activeChatId }) => {
  const { appUser } = useAuth();
  const { chats, loading } = useChatContext();
  const [contacts, setContacts] = useState<Record<string, ChatContact>>({});

  useEffect(() => {
    if (!appUser?.uid || chats.length === 0) return;

    const initial: Record<string, ChatContact> = {};
    const toFetch: string[] = [];
    chats.forEach((chat) => {
      const otherUid = chat.participants.find((p) => p !== appUser.uid);
      if (!otherUid) return;
      const cached = profileCache[otherUid];
      if (cached) {
        initial[otherUid] = cached;
      } else {
        toFetch.push(otherUid);
      }
    });
    if (Object.keys(initial).length > 0) setContacts((prev) => ({ ...prev, ...initial }));

    toFetch.forEach((otherUid) => {
      getUserProfile(otherUid).then((profile) => {
        if (profile) {
          const contact: ChatContact = { uid: otherUid, name: profile.name, avatar: profile.avatar };
          profileCache[otherUid] = contact;
          setContacts((prev) => ({ ...prev, [otherUid]: contact }));
        }
      });
    });
  }, [appUser?.uid, chats]);

  const formatChatTime = (ts: any) => {
    if (!ts?.toDate) return '';
    const date = ts.toDate() as Date;
    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading) {
    return <div className="cd-list-empty">Loading conversations...</div>;
  }

  if (chats.length === 0) {
    return (
      <div className="cd-list-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <p>No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="cd-list">
      {chats.map((chat) => {
        const otherUid = chat.participants.find((p) => p !== appUser?.uid) || '';
        const c = contacts[otherUid];
        const isActive = activeChatId ? chat.id === activeChatId : otherUid === activeUid;
        const unread = isActive ? 0 : (chat.unreadFor?.[appUser?.uid ?? ''] ?? 0);

        return (
          <div
            key={chat.id}
            className={`cd-list-item ${isActive ? 'cd-list-item-active' : ''}`}
            onClick={() => {
              if (!c) return;
              markChatRead(chat.id, appUser!.uid);
              onSelect(c);
            }}
          >
            <div className="cd-list-avatar">
              <img src={avatarSrc(c?.avatar)} alt={c?.name || 'Kalarang User'} />
            </div>
            <div className="cd-list-meta">
              <div className="cd-list-row">
                <span className="cd-list-name">{c?.name || 'Kalarang User'}</span>
                {unread > 0 && (
                  <span className="cd-list-unread" aria-label={`${unread} unread`}>
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </div>
              <div className="cd-list-row-bottom">
                <p className="cd-list-preview">{chat.lastMessage || 'Tap to start chatting'}</p>
                <span className="cd-list-time">{formatChatTime(chat.updatedAt)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ──────────────────────────────────────────────
   Chat view (right panel / active chat)
   ────────────────────────────────────────────── */

const ChatView: React.FC<{
  contact: ChatContact;
  initialMessage?: string;
  reachOutMetadata?: ReachOutMetadata | null;
  onClose: () => void;
}> = ({ contact, initialMessage, reachOutMetadata, onClose }) => {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const { messages, loading, sending, hasMore, ready, sendMessage, loadMore } = useChat(
    appUser?.uid,
    contact.uid
  );

  // Debounced mark-as-read — avoids excessive writes when many messages arrive quickly
  const lastMsgId = messages.length > 0 ? messages[messages.length - 1].id : null;
  const markReadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!appUser?.uid || !contact.uid) return;
    if (markReadTimeoutRef.current) clearTimeout(markReadTimeoutRef.current);
    markReadTimeoutRef.current = setTimeout(async () => {
      markReadTimeoutRef.current = null;
      const chatId = getChatId(appUser.uid, contact.uid);
      await markChatRead(chatId, appUser.uid);
      // Mark messages as seen by the current user
      await markMessagesAsSeen(chatId, appUser.uid);
    }, 400);
    return () => {
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current);
        markReadTimeoutRef.current = null;
      }
    };
  }, [appUser?.uid, contact.uid, lastMsgId]);

  const [inputText, setInputText] = useState(initialMessage || '');
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [imageDownloadBusy, setImageDownloadBusy] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [artworkSent, setArtworkSent] = useState(false);
  const reachOutNotificationSentRef = useRef(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const pendingImagePreview = useMemo(
    () => (pendingImage ? URL.createObjectURL(pendingImage) : null),
    [pendingImage],
  );
  useEffect(() => {
    return () => {
      if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
    };
  }, [pendingImagePreview]);

  // Close emoji picker when clicking outside it (including on textarea, send button). Do not close when clicking the emoji button (let its toggle handle that).
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!showEmojiPicker) return;
      const target = e.target as Node;
      const insidePicker = emojiPickerRef.current?.contains(target);
      const insideButton = emojiButtonRef.current?.contains(target);
      if (!insidePicker && !insideButton) setShowEmojiPicker(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevLastIdRef = useRef<string | null>(null);
  const isFirstRenderRef = useRef(true);
  const loadMoreScrollRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);
  const smoothScrollToEndRef = useRef(false);

  // Auto-grow textarea: content-box means scrollHeight includes padding, so subtract it for content height
  useLayoutEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    const style = getComputedStyle(ta);
    const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const max = parseFloat(style.maxHeight) || 200;
    ta.style.height = '0px';
    const contentHeight = ta.scrollHeight - paddingY;
    ta.style.height = `${Math.min(Math.max(contentHeight, 0), max)}px`;
  }, [inputText]);

  // Run before paint: restore scroll after "Load more", or pin to bottom on initial open
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || messages.length === 0) return;

    if (loadMoreScrollRef.current) {
      const { scrollTop, scrollHeight } = loadMoreScrollRef.current;
      loadMoreScrollRef.current = null;
      const deltaHeight = el.scrollHeight - scrollHeight;
      el.scrollTop = scrollTop + deltaHeight;
      prevLastIdRef.current = messages[messages.length - 1]?.id ?? null;
      return;
    }

    const lastId = messages[messages.length - 1]?.id ?? null;
    const isNewMessage = lastId !== prevLastIdRef.current;

    if (isFirstRenderRef.current) {
      el.scrollTop = el.scrollHeight;
      isFirstRenderRef.current = false;
      prevLastIdRef.current = lastId;
      return;
    }

    if (isNewMessage) {
      smoothScrollToEndRef.current = true;
    }
    prevLastIdRef.current = lastId;
  }, [messages]);

  // Smooth scroll to bottom when a new message arrives (sent or received)
  useEffect(() => {
    if (smoothScrollToEndRef.current && messagesEndRef.current) {
      smoothScrollToEndRef.current = false;
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setInputText((prev) => prev + emojiData.emoji);
  };

  const handleLoadMore = () => {
    const el = listRef.current;
    if (el) {
      loadMoreScrollRef.current = { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight };
    }
    loadMore();
  };

  const handlePickImage = () => {
    imageInputRef.current?.click();
  };

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file?.type.startsWith('image/')) return;
    setPendingImage(file);
  };

  const clearPendingImage = () => setPendingImage(null);

  const handleDownloadChatImage = async (url: string, messageId: string) => {
    setImageDownloadBusy(messageId);
    try {
      await downloadImageFromUrl(url, suggestedChatImageFilename('kalarang-chat'));
    } catch {
      // ignore
    } finally {
      setImageDownloadBusy(null);
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text && !pendingImage) return;
    
    // eslint-disable-next-line no-console
    console.log('handleSend called', { text, ready, loading, sending });
    
    if (!ready) {
      // eslint-disable-next-line no-console
      console.warn('Cannot send: chat not ready');
      return;
    }
    
    const imageToSend = pendingImage;
    setInputText('');
    setPendingImage(null);
    try {
      // Pass artwork metadata if it exists and hasn't been sent yet
      // Only include artworkPrice if it's defined to avoid Firestore errors
      const metadata = reachOutMetadata && !artworkSent ? {
        artworkId: reachOutMetadata.artworkId,
        artworkTitle: reachOutMetadata.artworkTitle,
        artworkImage: reachOutMetadata.artworkImage,
        ...(reachOutMetadata.artworkPrice !== undefined && { artworkPrice: reachOutMetadata.artworkPrice }),
      } : undefined;
      
      // eslint-disable-next-line no-console
      console.log('ChatDrawer - reachOutMetadata:', reachOutMetadata);
      // eslint-disable-next-line no-console
      console.log('ChatDrawer - artworkSent:', artworkSent);
      // eslint-disable-next-line no-console
      console.log('ChatDrawer - metadata to send:', metadata);
      
      await sendMessage(text, metadata, imageToSend || undefined);
      
      if (metadata) {
        setArtworkSent(true);
      }
      
      if (reachOutMetadata && appUser && !reachOutNotificationSentRef.current) {
        reachOutNotificationSentRef.current = true;
        try {
          await createNotification(
            contact.uid,
            'reachout',
            appUser.uid,
            appUser.name,
            appUser.avatar,
            reachOutMetadata.artworkId,
            reachOutMetadata.artworkTitle,
            reachOutMetadata.artworkImage
          );
        } catch {
          // Reach-out notification failed; ignore
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error sending message:', error);
      setInputText(text);
      if (imageToSend) setPendingImage(imageToSend);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatMessageTime = (ts: any) => {
    if (!ts?.toDate) return '';
    const date = ts.toDate() as Date;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessageText = (text: string) => {
    const emojiRegex = /(\p{Extended_Pictographic}+)/gu;
    const parts = text.split(emojiRegex);
    return parts.map((part, i) =>
      /^\p{Extended_Pictographic}+$/u.test(part) ? (
        <span key={i} className="cd-emoji-inline">{part}</span>
      ) : (
        part
      )
    );
  };

  const getDateDivider = (date: Date | null, prevDate: Date | null): string | null => {
    if (!date) return null;
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (prevDate && sameDay(date, prevDate)) return null;
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (sameDay(date, now)) return 'Today';
    if (sameDay(date, yesterday)) return 'Yesterday';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="cd-chat">
      {/* Messages */}
      <div className="cd-chat-messages" ref={listRef}>
        {hasMore && (
          <button className="cd-chat-load-more" onClick={handleLoadMore} disabled={loading}>
            {loading ? 'Loading...' : 'Load older messages'}
          </button>
        )}

        {loading && messages.length === 0 ? (
          <div className="cd-chat-empty">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="cd-chat-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const msgDate = msg.createdAt?.toDate?.() ?? null;
              const prevDate = i > 0 ? (messages[i - 1].createdAt?.toDate?.() ?? null) : null;
              const divider = getDateDivider(msgDate, prevDate);
              const isMine = msg.senderId === appUser?.uid;
              
              // Find the last message sent by me that the contact has seen
              const lastSeenMessageIndex = messages
                .map((m, idx) => (m.senderId === appUser?.uid && Array.isArray(m.seenBy) && m.seenBy.includes(contact.uid)) ? idx : -1)
                .filter(idx => idx !== -1)
                .pop();
              const isSeen = isMine && i === lastSeenMessageIndex;
              
              return (
                <React.Fragment key={msg.id}>
                  {divider && <div className="cd-chat-divider">{divider}</div>}
                  <div className={`cd-bubble-wrapper ${isMine ? 'cd-bubble-wrapper-mine' : ''}`}>
                    <div className={`cd-bubble ${isMine ? 'cd-bubble-mine' : 'cd-bubble-theirs'}`}>
                      {msg.artworkId && msg.artworkTitle && (
                        <div className="cd-message-artwork-banner">
                          <div className="cd-message-artwork-image">
                            <img src={msg.artworkImage || '/logo.jpeg'} alt={msg.artworkTitle} />
                          </div>
                          <div className="cd-message-artwork-details">
                            <span className="cd-message-artwork-title">{msg.artworkTitle}</span>
                            {msg.artworkPrice !== undefined && (
                              <span className="cd-message-artwork-price">₹{msg.artworkPrice.toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      )}
                      {msg.imageUrl && (
                        <div className="cd-chat-attachment">
                          <img src={msg.imageUrl} alt="" className="cd-chat-attachment-img" loading="lazy" />
                          <button
                            type="button"
                            className="cd-chat-attachment-download"
                            onClick={() => handleDownloadChatImage(msg.imageUrl!, msg.id)}
                            disabled={imageDownloadBusy === msg.id}
                            aria-label="Download full image"
                          >
                            {imageDownloadBusy === msg.id ? (
                              '…'
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                            )}
                          </button>
                        </div>
                      )}
                      {Boolean(msg.text?.trim()) && (
                        <p className="cd-bubble-text">{renderMessageText(msg.text)}</p>
                      )}
                      <span className="cd-bubble-time">{formatMessageTime(msg.createdAt)}</span>
                    </div>
                    {isSeen && <span className="cd-bubble-seen">Seen</span>}
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <footer className="cd-chat-input-area">
        <div style={{ display: 'contents' }}>
        {/* Artwork banner for reach-out context */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="cd-chat-file-input"
          onChange={handleImageSelected}
          aria-hidden
          tabIndex={-1}
        />
        {pendingImagePreview && (
          <div className="cd-pending-image">
            <img src={pendingImagePreview} alt="" />
            <button type="button" className="cd-pending-image-remove" onClick={clearPendingImage} aria-label="Remove image">
              ×
            </button>
          </div>
        )}
        {reachOutMetadata && !artworkSent && (
          <div className="cd-artwork-banner">
            <div className="cd-artwork-banner-image">
              <img src={reachOutMetadata.artworkImage || '/logo.jpeg'} alt={reachOutMetadata.artworkTitle} />
            </div>
            <div className="cd-artwork-banner-details">
              <span className="cd-artwork-banner-label">Reaching out about</span>
              <span className="cd-artwork-banner-title">{reachOutMetadata.artworkTitle}</span>
            </div>
          </div>
        )}
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="cd-emoji-picker-wrapper">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              width="100%"
              height={320}
              previewConfig={{ showPreview: false }}
              skinTonesDisabled
            />
          </div>
        )}
        <div className="cd-chat-input-row">
          <textarea
            ref={inputRef}
            className="cd-chat-input"
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending || !ready}
            autoFocus
            rows={1}
            aria-label="Message input"
          />
          <button
            type="button"
            className="cd-chat-attach-btn"
            onClick={handlePickImage}
            disabled={sending || !ready}
            aria-label="Attach image"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
          <button
            ref={emojiButtonRef}
            type="button"
            className="cd-chat-emoji-btn"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            disabled={sending || !ready}
            aria-label="Emoji"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
          <button
            className="cd-chat-send"
            onClick={handleSend}
            disabled={(!inputText.trim() && !pendingImage) || sending || !ready}
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        </div>
      </footer>
    </div>
  );
};

/* ──────────────────────────────────────────────
   Main ChatDrawer — unified WhatsApp-style panel
   ────────────────────────────────────────────── */

const CLOSE_ANIMATION_MS = 260;

const ChatDrawer: React.FC<ChatDrawerProps> = ({ isOpen, onClose, initialContact, initialMessage, reachOutMetadata }) => {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const { setActiveChatId, setIsChatDrawerOpen } = useChatContext();
  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const isClosingRef = useRef(false);

  const activeChatId = activeContact && appUser
    ? getChatId(appUser.uid, activeContact.uid)
    : null;

  // Update ChatContext with drawer open state only when this is the global drawer (no initialContact).
  // When opened with initialContact (e.g. Reach Out from CardDetail), we don't sync — otherwise
  // Layout's drawer would also open and sit on top showing only the list.
  useEffect(() => {
    if (!initialContact) {
      setIsChatDrawerOpen(isOpen);
    }
  }, [isOpen, initialContact, setIsChatDrawerOpen]);

  // Update ChatContext with active chat ID when it changes
  // Also notify service workers
  useEffect(() => {
    setActiveChatId(activeChatId);
    notifyServiceWorkerActiveChatId(activeChatId);
    return () => {
      // Clear active chat when component unmounts or chat changes
      if (activeChatId) {
        setActiveChatId(null);
        notifyServiceWorkerActiveChatId(null);
      }
    };
  }, [activeChatId, setActiveChatId]);

  const clearActiveContact = useCallback(() => {
    if (activeContact && appUser) {
      const chatId = getChatId(appUser.uid, activeContact.uid);
      markChatRead(chatId, appUser.uid).then(() => setActiveContact(null));
    } else {
      setActiveContact(null);
    }
  }, [activeContact, appUser]);

  // Animated close (for UI buttons / overlay click)
  const closeDrawer = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsClosing(true);
    setTimeout(() => onClose(), CLOSE_ANIMATION_MS);
  }, [onClose]);

  useDrawerBackNavigation({
    drawerOpen: isOpen,
    activeChatId,
    onCloseDrawer: closeDrawer,
    onExitChat: () => {
      if (initialContact) {
        closeDrawer();
      } else {
        clearActiveContact();
      }
    },
  });

  // When opened with an initialContact (from CardDetail), jump straight to chat and mark read
  useEffect(() => {
    if (isOpen && initialContact && appUser) {
      setActiveContact(initialContact);
      const chatId = getChatId(appUser.uid, initialContact.uid);
      markChatRead(chatId, appUser.uid);
    }
  }, [isOpen, initialContact, appUser]);

  // Reset when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setActiveContact(null);
      setIsClosing(false);
      isClosingRef.current = false;
    }
  }, [isOpen]);

  const handleClose = closeDrawer;

  // Lock body scroll + set viewport interactive-widget so keyboard resizes the fixed overlay
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const viewport = document.querySelector('meta[name="viewport"]');
    const prevContent = viewport?.getAttribute('content') ?? '';
    viewport?.setAttribute('content', prevContent + ', interactive-widget=resizes-content');
    return () => {
      document.body.style.overflow = '';
      if (viewport) viewport.setAttribute('content', prevContent);
    };
  }, [isOpen]);

  const handleBack = () => {
    if (initialContact) {
      closeDrawer();
    } else {
      clearActiveContact();
    }
  };

  const handleOpenContactProfile = () => {
    if (!activeContact || !appUser) return;
    sessionStorage.setItem('artworkSourceRoute', window.location.pathname || '/home');
    if (activeContact.uid === appUser.uid) {
      navigate('/portfolio');
      return;
    }
    navigate(`/portfolio/${activeContact.uid}`);
  };

  if (!isOpen) return null;

  const showingChat = !!activeContact;
  const showListPanel = !initialContact; // hide list when opened as a direct chat

  return createPortal(
    <div className={`cd-overlay ${isClosing ? 'cd-overlay-closing' : ''}`} onClick={handleClose}>
      <aside
        className={`cd-drawer ${showingChat && showListPanel ? 'cd-drawer-expanded' : ''} ${isClosing ? 'cd-drawer-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Messages"
      >
        {/* Single drawer header — list view: title + close; chat view: back + avatar + name + close */}
        <header className="cd-drawer-header">
          {activeContact ? (
            <>
              <button className="cd-drawer-back" onClick={handleBack} aria-label="Back to list">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="cd-drawer-user">
                <img src={avatarSrc(activeContact.avatar)} alt={activeContact.name} className="cd-drawer-avatar" />
                <button type="button" className="cd-drawer-name-link" onClick={handleOpenContactProfile}>
                  {activeContact.name}
                </button>
              </div>
            </>
          ) : (
            <h2 className="cd-drawer-title">Messages</h2>
          )}
          <button className="cd-drawer-close" onClick={handleClose} aria-label="Close messages">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="cd-body">
          {/* Conversation list panel */}
          {showListPanel && (
            <div className={`cd-panel-list ${showingChat ? 'cd-panel-list-hidden' : ''}`}>
              <ConversationList
                onSelect={(c) => {
                  if (appUser) markChatRead(getChatId(appUser.uid, c.uid), appUser.uid);
                  setActiveContact(c);
                }}
                activeUid={activeContact?.uid}
                activeChatId={activeContact && appUser ? getChatId(appUser.uid, activeContact.uid) : undefined}
              />
            </div>
          )}

          {/* Chat panel */}
          {showingChat && activeContact && (
            <div className="cd-panel-chat">
              <ChatView
                contact={activeContact}
                initialMessage={
                  initialMessage &&
                  initialContact &&
                  activeContact.uid === initialContact.uid
                    ? initialMessage
                    : undefined
                }
                reachOutMetadata={
                  reachOutMetadata &&
                  initialContact &&
                  activeContact.uid === initialContact.uid
                    ? reachOutMetadata
                    : undefined
                }
                onClose={closeDrawer}
              />
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
};

export default ChatDrawer;

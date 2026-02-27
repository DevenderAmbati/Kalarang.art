import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../hooks/useChat';
import { markChatRead, getChatId } from '../../services/chatService';
import { useChatContext } from '../../context/ChatContext';
import { getUserProfile } from '../../services/userService';
import { createNotification } from '../../services/notificationService';
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
              <img src={avatarSrc(c?.avatar)} alt={c?.name || 'User'} />
            </div>
            <div className="cd-list-meta">
              <div className="cd-list-row">
                <span className="cd-list-name">{c?.name || 'Loading...'}</span>
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
}> = ({ contact, initialMessage, reachOutMetadata }) => {
  const { appUser } = useAuth();
  const { messages, loading, sending, hasMore, sendMessage, loadMore } = useChat(
    appUser?.uid,
    contact.uid
  );

  // Debounced mark-as-read — avoids excessive writes when many messages arrive quickly
  const lastMsgId = messages.length > 0 ? messages[messages.length - 1].id : null;
  const markReadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!appUser?.uid || !contact.uid) return;
    if (markReadTimeoutRef.current) clearTimeout(markReadTimeoutRef.current);
    markReadTimeoutRef.current = setTimeout(() => {
      markReadTimeoutRef.current = null;
      const chatId = getChatId(appUser.uid, contact.uid);
      markChatRead(chatId, appUser.uid);
    }, 400);
    return () => {
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current);
        markReadTimeoutRef.current = null;
      }
    };
  }, [appUser?.uid, contact.uid, lastMsgId]);

  const [inputText, setInputText] = useState(initialMessage || '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const reachOutNotificationSentRef = useRef(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    try {
      await sendMessage(text);
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
        } catch (err) {
          console.error('[ChatView] Error creating reach-out notification:', err);
        }
      }
    } catch {
      setInputText(text);
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
              return (
                <React.Fragment key={msg.id}>
                  {divider && <div className="cd-chat-divider">{divider}</div>}
                  <div className={`cd-bubble ${isMine ? 'cd-bubble-mine' : 'cd-bubble-theirs'}`}>
                    <p className="cd-bubble-text">{renderMessageText(msg.text)}</p>
                    <span className="cd-bubble-time">{formatMessageTime(msg.createdAt)}</span>
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
            disabled={sending}
            autoFocus
            rows={1}
            aria-label="Message input"
          />
          <button
            ref={emojiButtonRef}
            type="button"
            className="cd-chat-emoji-btn"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            disabled={sending}
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
            disabled={!inputText.trim() || sending}
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

const ChatDrawer: React.FC<ChatDrawerProps> = ({ isOpen, onClose, initialContact, initialMessage, reachOutMetadata }) => {
  const { appUser } = useAuth();
  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);

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
    }
  }, [isOpen]);

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
    // If we were opened with an initialContact, back = close drawer
    if (initialContact) {
      onClose();
    } else {
      if (activeContact && appUser) {
        const chatId = getChatId(appUser.uid, activeContact.uid);
        markChatRead(chatId, appUser.uid).then(() => setActiveContact(null));
      } else {
        setActiveContact(null);
      }
    }
  };

  if (!isOpen) return null;

  const showingChat = !!activeContact;
  const showListPanel = !initialContact; // hide list when opened as a direct chat

  return createPortal(
    <div className="cd-overlay" onClick={onClose}>
      <aside
        className={`cd-drawer ${showingChat && showListPanel ? 'cd-drawer-expanded' : ''}`}
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
                <span className="cd-drawer-name">{activeContact.name}</span>
              </div>
            </>
          ) : (
            <h2 className="cd-drawer-title">Messages</h2>
          )}
          <button className="cd-drawer-close" onClick={onClose} aria-label="Close messages">
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

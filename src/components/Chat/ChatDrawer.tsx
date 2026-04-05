import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../hooks/useChat';
import { useDrawerBackNavigation } from '../../hooks/useDrawerBackNavigation';
import { markChatRead, markMessagesAsSeen, getChatId, sendReachOutOfferMessage, acceptReachOutOffer, sendAddressCard, markArtworkShipped } from '../../services/chatService';
import { useChatContext } from '../../context/ChatContext';
import { getUserProfile } from '../../services/userService';
import { createNotification } from '../../services/notificationService';
import { notifyServiceWorkerActiveChatId } from '../../services/fcmService';
import { toast } from 'react-toastify';
import { downloadImageFromUrl, suggestedChatImageFilename } from '../../utils/downloadImage';
import '../../components/Modals/ConfirmModal.css';
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
  const { chats } = useChatContext();
  const { messages, loading, sending, hasMore, ready, sendMessage, loadMore } = useChat(
    appUser?.uid,
    contact.uid
  );

  // shippedArtworkIds from the live chat doc (artist-side filter only)
  const chatId = appUser ? getChatId(appUser.uid, contact.uid) : null;
  const activeChatDoc = chats.find((c) => c.id === chatId);
  const shippedArtworkIds = new Set<string>(activeChatDoc?.shippedArtworkIds ?? []);

  // Debounced mark-as-read — avoids excessive writes when many messages arrive quickly
  const lastMsgId = messages.length > 0 ? messages[messages.length - 1].id : null;
  const markReadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!appUser?.uid || !contact.uid) return;
    if (markReadTimeoutRef.current) clearTimeout(markReadTimeoutRef.current);
    markReadTimeoutRef.current = setTimeout(async () => {
      markReadTimeoutRef.current = null;
      const chatId = getChatId(appUser.uid, contact.uid);
      try {
        await markChatRead(chatId, appUser.uid);
        await markMessagesAsSeen(chatId, appUser.uid);
      } catch {
        // Non-critical — ignore read-state errors silently
      }
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
  // Collapsible artwork cards drawer
  const [cardsExpanded, setCardsExpanded] = useState(true);
  // Per-artwork independent state
  const [offerFormArtworkId, setOfferFormArtworkId] = useState<string | null>(null);
  const [offerFinalPrice, setOfferFinalPrice] = useState('');
  const [offerDeliveryDate, setOfferDeliveryDate] = useState('');
  const [sendingOfferArtworkId, setSendingOfferArtworkId] = useState<string | null>(null);
  const [makeShipmentCard, setMakeShipmentCard] = useState<ReachOutMetadata | null>(null);
  const [trackingInput, setTrackingInput] = useState('');
  const [makeShipmentBusy, setMakeShipmentBusy] = useState(false);
  const [offerAcceptMsgId, setOfferAcceptMsgId] = useState<string | null>(null);
  const [acceptingOfferId, setAcceptingOfferId] = useState<string | null>(null);
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [buyerAddressForm, setBuyerAddressForm] = useState({ name: '', line1: '', line2: '', city: '', pincode: '', phone: '' });
  const [artistUpiId, setArtistUpiId] = useState<string | null>(null);
  const [fetchingArtistUpi, setFetchingArtistUpi] = useState(false);

  // Set of artworkIds that already have an accepted offer —
  // includes both accepted reachout_offer messages AND Buy Now purchases (from acceptedOffers on chat doc)
  const acceptedArtworkIds = new Set([
    ...messages
      .filter((m) => m.messageType === 'reachout_offer' && m.offerStatus === 'accepted' && m.artworkId)
      .map((m) => m.artworkId!),
    ...(activeChatDoc?.acceptedOffers ?? []).map((o) => o.artworkId),
  ]);
  const hasAcceptedOffer = acceptedArtworkIds.size > 0;

  // Ordered array of all unique artworks referenced in this chat.
  // Scan messages chronologically so earlier artworks appear first,
  // then add/update with the current reachOutMetadata prop (buyer side).
  const artworkCards: ReachOutMetadata[] = (() => {
    const map = new Map<string, ReachOutMetadata>();
    for (const m of messages) {
      if (m.artworkId && m.artworkTitle && !map.has(m.artworkId)) {
        map.set(m.artworkId, {
          artworkId: m.artworkId,
          artworkTitle: m.artworkTitle,
          artworkImage: m.artworkImage,
          artworkPrice: m.artworkPrice,
        });
      }
    }
    if (reachOutMetadata?.artworkId) {
      map.set(reachOutMetadata.artworkId, reachOutMetadata);
    }
    return Array.from(map.values()).filter((c) => !shippedArtworkIds.has(c.artworkId));
  })();

  // Close offer form when its artwork is accepted
  useEffect(() => {
    if (offerFormArtworkId && acceptedArtworkIds.has(offerFormArtworkId)) {
      setOfferFormArtworkId(null);
      setOfferFinalPrice('');
    }
  }, [offerFormArtworkId, hasAcceptedOffer]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Fetch artist UPI ID when offer acceptance modal opens
  useEffect(() => {
    if (offerAcceptMsgId && contact?.uid) {
      setFetchingArtistUpi(true);
      getUserProfile(contact.uid)
        .then((profile) => {
          setArtistUpiId(profile?.upiId || null);
          
          // Send notification if UPI ID is not set
          if ((!profile?.upiId || profile.upiId.trim() === '') && appUser) {
            createNotification(
              contact.uid,
              'payment_failed_no_upi',
              appUser.uid,
              appUser.name || 'A buyer',
              appUser.avatar,
              reachOutMetadata?.artworkId,
              reachOutMetadata?.artworkTitle
            ).catch(() => {}); // Silent fail
          }
        })
        .catch(() => {
          setArtistUpiId(null);
        })
        .finally(() => {
          setFetchingArtistUpi(false);
        });
    } else {
      setArtistUpiId(null);
      setFetchingArtistUpi(false);
    }
  }, [offerAcceptMsgId, contact?.uid, appUser, reachOutMetadata]);

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

  const handleSubmitOffer = async (card: ReachOutMetadata) => {
    if (!appUser) return;
    const fp = offerFinalPrice.trim();
    if (!fp) return;
    setSendingOfferArtworkId(card.artworkId);
    try {
      const chatId = getChatId(appUser.uid, contact.uid);
      await sendReachOutOfferMessage(
        chatId,
        appUser.uid,
        card.artworkId,
        card.artworkTitle,
        card.artworkImage,
        fp,
        offerDeliveryDate || undefined,
      );
      createNotification(
        contact.uid,
        'commission_offer',
        appUser.uid,
        appUser.name,
        appUser.avatar,
        card.artworkId,
        card.artworkTitle,
        card.artworkImage,
        undefined,
        undefined,
        card.artworkTitle,
      ).catch(() => {});
      setOfferFormArtworkId(null);
      setOfferFinalPrice('');
      setOfferDeliveryDate('');
    } catch {
      // ignore
    } finally {
      setSendingOfferArtworkId(null);
    }
  };

  const formatOfferDeliveryLabel = (iso: string | undefined): string => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) return iso || '—';
    const [y, m, d] = iso.trim().split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleConfirmAccept = async () => {
    if (!appUser || !offerAcceptMsgId) return;
    const offerMsg = messages.find((m) => m.id === offerAcceptMsgId);
    const paymentAmount = offerMsg?.offerFinalPrice || '';
    setAcceptingOfferId(offerAcceptMsgId);
    try {
      const chatId = getChatId(appUser.uid, contact.uid);
      await acceptReachOutOffer(chatId, offerAcceptMsgId, paymentAmount, offerMsg?.artworkId ? {
        artworkId: offerMsg.artworkId,
        artworkTitle: offerMsg.artworkTitle ?? '',
        artworkImage: offerMsg.artworkImage,
        artistId: contact.uid,
      } : undefined);

      // Send automated messages
      await sendMessage(`🎉 Offer accepted! Please prepare the shipment.`);
      await sendAddressCard(chatId, appUser.uid, buyerAddressForm, contact.uid);

      // Notify the artist — payment done, start shipping
      createNotification(
        contact.uid,
        'commission_offer_accepted',
        appUser.uid,
        appUser.name,
        appUser.avatar,
        offerMsg?.artworkId,
        offerMsg?.artworkTitle,
        offerMsg?.artworkImage,
        undefined,
        undefined,
        offerMsg?.artworkTitle,
        'payment_done',
      ).catch(() => {});

      setShowPaymentConfirm(false);
      setOfferAcceptMsgId(null);
      setBuyerAddressForm({ name: '', line1: '', line2: '', city: '', pincode: '', phone: '' });
      
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to accept offer:', err);
      toast.error('Could not accept offer. Please try again.');
    } finally {
      setAcceptingOfferId(null);
    }
  };

  const handleMakeShipment = (card: ReachOutMetadata) => {
    setMakeShipmentCard(card);
    setTrackingInput('');
  };

  const handleConfirmShipment = async () => {
    if (!appUser || !makeShipmentCard || !trackingInput.trim()) return;
    setMakeShipmentBusy(true);
    try {
      await sendMessage(`📦 "${makeShipmentCard.artworkTitle}" has been shipped! Tracking ID: ${trackingInput.trim()}`);
      createNotification(
        contact.uid,
        'commission_shipped',
        appUser.uid,
        appUser.name,
        appUser.avatar,
        makeShipmentCard.artworkId,
        makeShipmentCard.artworkTitle,
        makeShipmentCard.artworkImage,
        undefined,       // contactMethod
        undefined,       // commissionId
        undefined,       // commissionTitle
        trackingInput.trim(), // commentSnippet — used as tracking ID
      ).catch(() => {});
      if (chatId) await markArtworkShipped(chatId, makeShipmentCard.artworkId, trackingInput.trim());
      setMakeShipmentCard(null);
      
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to confirm shipment:', err);
      toast.error('Could not send shipment update. Please try again.');
    } finally {
      setMakeShipmentBusy(false);
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
      {/* ── Per-artwork context cards ── */}
      {artworkCards.length > 0 && (() => {
        const paidArtworkIdSet = new Set<string>(activeChatDoc?.paidArtworkIds ?? []);
        const cardNodes = artworkCards.map((card) => {
          const isAccepted = acceptedArtworkIds.has(card.artworkId);
          const isPaymentDone = paidArtworkIdSet.has(card.artworkId)
            || (activeChatDoc?.acceptedOffers ?? []).some((o) => o.artworkId === card.artworkId);
          const showShipmentBtn = isAccepted || isPaymentDone;
          const isFormOpen = offerFormArtworkId === card.artworkId;
          const isSendingOffer = sendingOfferArtworkId === card.artworkId;
          const cardLabel = isPaymentDone
            ? 'Artwork · Payment received'
            : isAccepted
              ? 'Artwork · Offer accepted'
              : 'Artwork';
          return (
            <React.Fragment key={card.artworkId}>
              <div className={`cd-reachout-context-card${showShipmentBtn ? ' cd-reachout-context-card--locked' : ''}`}>
                <img src={card.artworkImage || '/logo.jpeg'} alt={card.artworkTitle} />
                <div className="cd-reachout-context-stack">
                  <div className="cd-reachout-context-main">
                    <div>
                      <p className="cd-reachout-context-label">{cardLabel}</p>
                      <p className="cd-reachout-context-title">{card.artworkTitle}</p>
                    </div>
                    {appUser?.role === 'artist' && (
                      showShipmentBtn ? (
                        <button
                          type="button"
                          className="cd-reachout-hire-btn"
                          onClick={() => handleMakeShipment(card)}
                          disabled={makeShipmentBusy && makeShipmentCard?.artworkId === card.artworkId}
                        >
                          Make shipment
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="cd-reachout-hire-btn"
                          onClick={() => setOfferFormArtworkId((prev) => prev === card.artworkId ? null : card.artworkId)}
                          disabled={isSendingOffer}
                        >
                          Send offer
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
              {isFormOpen && !showShipmentBtn && appUser?.role === 'artist' && (
                <div className="cd-reachout-offer-form">
                  <p className="cd-reachout-offer-form-title">Your offer</p>
                  <p className="cd-reachout-offer-form-note">
                    💡 Include delivery charges in the total price. Add shipping days to your delivery date.
                  </p>
                  <label className="cd-reachout-offer-field">
                    <span>Delivery date</span>
                    <input
                      type="date"
                      value={offerDeliveryDate}
                      onChange={(e) => setOfferDeliveryDate(e.target.value)}
                      disabled={isSendingOffer}
                    />
                  </label>
                  <label className="cd-reachout-offer-field">
                    <span>Final price (₹)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 5000"
                      value={offerFinalPrice}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow only numbers
                        if (value === '' || /^\d+$/.test(value)) {
                          setOfferFinalPrice(value);
                        }
                      }}
                      disabled={isSendingOffer}
                      autoComplete="off"
                    />
                  </label>
                  <div className="cd-reachout-offer-form-actions">
                    <button
                      type="button"
                      className="cd-reachout-offer-cancel"
                      disabled={isSendingOffer}
                      onClick={() => { setOfferFormArtworkId(null); setOfferFinalPrice(''); setOfferDeliveryDate(''); }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="cd-reachout-offer-submit"
                      disabled={isSendingOffer || !offerFinalPrice.trim()}
                      onClick={() => void handleSubmitOffer(card)}
                    >
                      {isSendingOffer ? 'Sending…' : 'Send offer to buyer'}
                    </button>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        });

        if (artworkCards.length === 1) {
          return <>{cardNodes}</>;
        }

        return (
          <div className="cd-cards-drawer">
            <button
              type="button"
              className="cd-cards-drawer-toggle"
              onClick={() => setCardsExpanded((p) => !p)}
              aria-expanded={cardsExpanded}
            >
              <span className="cd-cards-drawer-toggle-label">
                {`${artworkCards.length} artworks`}
        
              </span>
              <svg
                className={`cd-cards-drawer-chevron${cardsExpanded ? ' cd-cards-drawer-chevron--open' : ''}`}
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {cardsExpanded && (
              <div className="cd-cards-drawer-body">{cardNodes}</div>
            )}
          </div>
        );
      })()}

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
                    <div className={`cd-bubble ${isMine ? 'cd-bubble-mine' : 'cd-bubble-theirs'}${msg.messageType === 'reachout_offer' ? ' cd-bubble-offer' : ''}`}>
                      {msg.messageType === 'reachout_offer' && (
                        <div className="cd-offer-card">
                          <p className="cd-offer-card-title">Price offer</p>
                          {msg.offerStatus === 'accepted' && (
                            <span className="cd-offer-card-status">Accepted</span>
                          )}
                          <ul className="cd-offer-card-details">
                            <li>
                              <span>Artwork</span>
                              <strong>{msg.artworkTitle || '—'}</strong>
                            </li>
                            {msg.offerDeliveryDate && (
                              <li>
                                <span>Delivery</span>
                                <strong>{formatOfferDeliveryLabel(msg.offerDeliveryDate)}</strong>
                              </li>
                            )}
                            <li>
                              <span>Final price</span>
                              <strong>₹{msg.offerFinalPrice || '—'}</strong>
                            </li>
                          </ul>
                          {appUser?.role === 'buyer' &&
                            msg.offerStatus !== 'accepted' &&
                            !acceptedArtworkIds.has(msg.artworkId ?? '') &&
                            !isMine && (
                              <button
                                type="button"
                                className="cd-offer-accept-btn"
                                disabled={acceptingOfferId === msg.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOfferAcceptMsgId(msg.id);
                                  setShowPaymentConfirm(false);
                                }}
                              >
                                Accept offer
                              </button>
                            )}
                        </div>
                      )}
                      {msg.messageType === 'address_card' && (
                        <div className="cd-address-card">
                          <span className="cd-address-card-label">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            Delivery address
                          </span>
                          {msg.addressName && <span className="cd-address-card-name">{msg.addressName}</span>}
                          <span className="cd-address-card-lines">
                            {[msg.addressLine1, msg.addressLine2].filter(Boolean).join(', ')}
                          </span>
                          <span className="cd-address-card-lines">
                            {[msg.addressCity, msg.addressPincode].filter(Boolean).join(' – ')}
                          </span>
                          {msg.addressPhone && <span className="cd-address-card-phone">{msg.addressPhone}</span>}
                        </div>
                      )}
                      {msg.messageType !== 'reachout_offer' && msg.messageType !== 'address_card' && msg.artworkId && msg.artworkTitle && (
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
                      {Boolean(msg.text?.trim()) && msg.messageType !== 'reachout_offer' && msg.messageType !== 'address_card' && (
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

      {/* Accept offer modal — same flow as commission chat */}
      {offerAcceptMsgId && (() => {
        const UPI_ID = artistUpiId || null;
        const offerMsg = messages.find((m) => m.id === offerAcceptMsgId);
        const advanceAmount = offerMsg?.offerFinalPrice || '';
        const upiUri = UPI_ID ? `upi://pay?pa=${UPI_ID}&pn=Kalarang%20Art${advanceAmount ? `&am=${advanceAmount}` : ''}&cu=INR` : '';
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const addressComplete =
          buyerAddressForm.name.trim() !== '' &&
          buyerAddressForm.line1.trim() !== '' &&
          buyerAddressForm.city.trim() !== '' &&
          buyerAddressForm.pincode.trim() !== '' &&
          buyerAddressForm.phone.trim() !== '';
        return createPortal(
          <div
            className="confirm-modal-overlay"
            role="presentation"
            style={{ zIndex: 10002 }}
            onClick={() => { if (!acceptingOfferId) setOfferAcceptMsgId(null); }}
          >
            <div
              className="confirm-modal-content commission-accept-offer-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cd-accept-offer-title"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="commission-accept-offer-close"
                aria-label="Close"
                disabled={Boolean(acceptingOfferId)}
                onClick={() => { setOfferAcceptMsgId(null); setShowPaymentConfirm(false); }}
              >
                ×
              </button>
              <h2 id="cd-accept-offer-title" className="confirm-modal-title">Accept offer</h2>
              <p className="confirm-modal-message">
                Once you accept, the artist will be notified and can begin working on your piece.
              </p>

              <div className="commission-accept-address-form">
                <p className="commission-accept-address-form-title">Delivery address</p>
                <input type="text" className="commission-accept-address-input" placeholder="Full name"
                  value={buyerAddressForm.name} onChange={(e) => setBuyerAddressForm((p) => ({ ...p, name: e.target.value }))} disabled={Boolean(acceptingOfferId)} />
                <input type="text" className="commission-accept-address-input" placeholder="Flat / House / Building"
                  value={buyerAddressForm.line1} onChange={(e) => setBuyerAddressForm((p) => ({ ...p, line1: e.target.value }))} disabled={Boolean(acceptingOfferId)} />
                <input type="text" className="commission-accept-address-input" placeholder="Street / Area / Locality"
                  value={buyerAddressForm.line2} onChange={(e) => setBuyerAddressForm((p) => ({ ...p, line2: e.target.value }))} disabled={Boolean(acceptingOfferId)} />
                <div className="commission-accept-address-row">
                  <input type="text" className="commission-accept-address-input" placeholder="City"
                    value={buyerAddressForm.city} onChange={(e) => setBuyerAddressForm((p) => ({ ...p, city: e.target.value }))} disabled={Boolean(acceptingOfferId)} />
                  <input type="text" className="commission-accept-address-input" placeholder="Pincode"
                    value={buyerAddressForm.pincode} onChange={(e) => setBuyerAddressForm((p) => ({ ...p, pincode: e.target.value }))} disabled={Boolean(acceptingOfferId)} />
                </div>
                <input type="tel" className="commission-accept-address-input" placeholder="Phone number"
                  value={buyerAddressForm.phone} onChange={(e) => setBuyerAddressForm((p) => ({ ...p, phone: e.target.value }))} disabled={Boolean(acceptingOfferId)} />
              </div>

              {fetchingArtistUpi ? (
                <div className="commission-accept-offer-payment">
                  <p className="commission-accept-offer-payment-label">Loading payment details...</p>
                </div>
              ) : !UPI_ID ? (
                <div className="commission-accept-offer-payment">
                  <p className="commission-accept-offer-payment-label" style={{ color: 'var(--color-error, #dc2626)' }}>⚠️ Payment Not Available</p>
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem', textAlign: 'center' }}>The artist hasn't set up their UPI ID yet. Please ask them to add it in their profile.</p>
                </div>
              ) : (
                <div className="commission-accept-offer-payment">
                  <p className="commission-accept-offer-payment-label">Pay advance and accept</p>
                  {advanceAmount && <div className="commission-accept-offer-amount">₹{advanceAmount}</div>}
                  <p className="commission-accept-offer-upiid">UPI ID: <strong>{UPI_ID}</strong></p>
                  {isMobile ? (
                    <a href={upiUri} className="button button-primary commission-accept-offer-upi-btn" style={{ textAlign: 'center' }}>Open UPI App to Pay</a>
                  ) : (
                    <div className="commission-accept-offer-qr">
                      <QRCodeSVG value={upiUri} size={180} />
                      <p className="commission-accept-offer-qr-hint">Scan to pay via UPI</p>
                    </div>
                  )}
                </div>
              )}

              {!addressComplete && (
                <p className="commission-accept-address-required-hint">* Fill in all address fields to continue</p>
              )}

              {showPaymentConfirm ? (
                <div className="commission-make-payment-confirm-block">
                  <p className="commission-payment-confirm-tooltip-q">Have you made the payment?</p>
                  <div className="confirm-modal-actions confirm-modal-actions--row">
                    <button type="button" className="confirm-modal-btn confirm-modal-btn-cancel"
                      disabled={Boolean(acceptingOfferId)} onClick={() => setShowPaymentConfirm(false)}>
                      No
                    </button>
                    <button type="button" className="confirm-modal-btn confirm-modal-btn-confirm confirm-modal-btn-info"
                      disabled={Boolean(acceptingOfferId)} onClick={() => void handleConfirmAccept()}>
                      <span className="commission-hire-tooltip-confirm-inner">
                        {acceptingOfferId && <span className="commission-inline-spinner commission-inline-spinner--outline" aria-hidden />}
                        {acceptingOfferId ? 'Please wait…' : 'Yes'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="confirm-modal-actions confirm-modal-actions--row">
                  <button type="button" className="confirm-modal-btn confirm-modal-btn-cancel"
                    disabled={Boolean(acceptingOfferId)} onClick={() => { setOfferAcceptMsgId(null); setShowPaymentConfirm(false); }}>
                    Cancel
                  </button>
                  <button type="button" className="confirm-modal-btn confirm-modal-btn-confirm confirm-modal-btn-info"
                    disabled={Boolean(acceptingOfferId) || !addressComplete || !UPI_ID || fetchingArtistUpi}
                    title={!addressComplete ? 'Please fill in all address fields' : !UPI_ID ? 'Artist UPI ID not available' : undefined}
                    onClick={() => setShowPaymentConfirm(true)}>
                    Accept
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Make shipment modal */}
      {makeShipmentCard && createPortal(
        <div
          className="confirm-modal-overlay"
          role="presentation"
          style={{ zIndex: 10002 }}
          onClick={() => { if (!makeShipmentBusy) setMakeShipmentCard(null); }}
        >
          <div
            className="confirm-modal-content commission-make-payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cd-make-shipment-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="commission-accept-offer-close"
              aria-label="Close"
              disabled={makeShipmentBusy}
              onClick={() => setMakeShipmentCard(null)}
            >
              ×
            </button>
            <h2 id="cd-make-shipment-title" className="confirm-modal-title">Make Shipment</h2>
            <p className="confirm-modal-message">
              Enter the tracking ID for <strong>{makeShipmentCard.artworkTitle}</strong>.
            </p>
            <input
              type="text"
              className="commission-accept-address-input"
              placeholder="Tracking ID (e.g. DTDC1234567890)"
              value={trackingInput}
              disabled={makeShipmentBusy}
              onChange={(e) => setTrackingInput(e.target.value)}
              style={{ marginTop: '0.75rem' }}
            />
            <div className="confirm-modal-actions confirm-modal-actions--row" style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                className="confirm-modal-btn confirm-modal-btn-cancel"
                disabled={makeShipmentBusy}
                onClick={() => setMakeShipmentCard(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-modal-btn confirm-modal-btn-confirm confirm-modal-btn-info"
                disabled={makeShipmentBusy || !trackingInput.trim()}
                onClick={() => void handleConfirmShipment()}
              >
                <span className="commission-hire-tooltip-confirm-inner">
                  {makeShipmentBusy && <span className="commission-inline-spinner commission-inline-spinner--outline" aria-hidden />}
                  {makeShipmentBusy ? 'Shipping…' : 'Confirm'}
                </span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
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
  const [layoutHeaderHeight, setLayoutHeaderHeight] = useState(0);

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
      markChatRead(chatId, appUser.uid).then(() => setActiveContact(null)).catch(() => setActiveContact(null));
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
      markChatRead(chatId, appUser.uid).catch(() => {});
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

  // Keep the drawer header height visually aligned with the Layout header.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const layoutHeaderEl = document.querySelector('.layout-header') as HTMLElement | null;
    if (!layoutHeaderEl) return;

    const update = () => {
      const h = Math.round(layoutHeaderEl.getBoundingClientRect().height);
      if (Number.isFinite(h) && h > 0) setLayoutHeaderHeight(h);
    };

    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(layoutHeaderEl);
    window.addEventListener('resize', update);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
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
        style={{
          ['--cd-layout-header-height' as any]: layoutHeaderHeight ? `${layoutHeaderHeight}px` : undefined,
        }}
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
                  if (appUser) markChatRead(getChatId(appUser.uid, c.uid), appUser.uid).catch(() => {});
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

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { MdContentCopy } from 'react-icons/md';
import { Timestamp, QueryDocumentSnapshot, DocumentData, onSnapshot, doc as firestoreDoc, query, collection, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import Lottie from 'lottie-react';
import CustomDropdown from '../../components/Filters/CustomDropdown';
import UploadDropzone from '../../components/Forms/UploadDropzone';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import {
  CommissionRequest,
  createCommissionRequest,
  getCommissionDocumentsByIds,
  getCommissionsPaginated,
  getBrowseCommissionRequestsCached,
  getBuyerCommissionRequestsCached,
  getCommissionsForArtistApplicationsCached,
  getCommissionsForHiredArtistCached,
  acceptCommissionOfferFromChat,
  markAdvancePaid,
  saveReadyToShipImage,
  markCommissionSharedToPublic,
  markFullPaymentDone,
  markShipped,
  markCommissionCompletedByBuyer,
  registerArtistApplication,
  removeCommissionShortlistBookmark,
  invalidateCommissionsBrowseCache,
  invalidateCommissionsUserCaches,
  searchOpenCommissionsServer,
  setCommissionShortlistBookmark,
} from '../../services/commissionService';
import { cache, cacheKeys } from '../../utils/cache';
import {
  CommissionChat,
  CommissionChatMessage,
  COMMISSION_HIRED_ELSEWHERE_MESSAGE,
  COMMISSION_HIRED_ELSEWHERE_MESSAGE_ARTIST,
  COMMISSION_WORK_COMPLETED_MESSAGE,
  closeHiredArtistChatWhenCommissionCompleted,
  createOrGetCommissionChat,
  markCommissionChatRead,
  markCommissionMessagesSeen,
  sendCommissionMessage,
  sendCommissionOfferMessage,
  sendCommissionAddressCard,
  subscribeCommissionMessages,
  subscribeToUserCommissionChats,
} from '../../services/commissionChatService';
import { uploadChatMessageImage } from '../../services/chatImageUpload';
import { notifyServiceWorkerActiveChatId } from '../../services/fcmService';
import { getUserProfile } from '../../services/userService';
import { createNotification } from '../../services/notificationService';
import {
  CommissionReview,
  getReviewsForBuyer,
  getReviewsForArtist,
  submitReview,
  submitArtistReply,
} from '../../services/reviewService';
import { downloadImageFromUrl, suggestedChatImageFilename } from '../../utils/downloadImage';
import ChatImageModal from '../../components/Modals/ChatImageModal';
import { savePublicShare } from '../../services/publicShareService';
import EmptyState from '../../components/State/EmptyState';
import LoadingState from '../../components/State/LoadingState';
import { useScrollDirection } from '../../hooks/useScrollDirection';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import PullToRefreshIndicator from '../../components/Common/PullToRefreshIndicator';
import africanAmericanArtAnimation from '../../animations/African American Art.json';
import noContentAnimation from '../../animations/no content.json';
import artPostLoaderAnimation from '../../animations/Line art (1).json';
import CommissionFlowInfoModal from '../../components/Modals/CommissionFlowInfoModal';
import '../../components/Modals/ConfirmModal.css';
import './Commissions.css';

/** Detects phone numbers in a string. Matches Indian mobile numbers and generic 10+ digit sequences. */
const containsPhoneNumber = (text: string): boolean => {
  const phoneRegex = /(\+?91[\s.\-]?)?[6-9]\d{9}|\b\d(?:[\s\-.]?\d){9,}\b/;
  return phoneRegex.test(text);
};

/** Form (`mode="form"`) and board (`mode="list"`) are separate mounts in `App.tsx`; the list instance must refetch when a request is created from the post tab. */
const COMMISSION_LISTS_UPDATED_EVENT = 'kalarang:commission-lists-updated';

const COMMISSIONS_PAGE_SIZE = 15;
const VIRTUALIZE_THRESHOLD = 20;

const getCommissionGridColumnCount = (width: number): number => {
  if (width >= 1024) return 2;
  return 1;
};
const COMMISSION_CARD_HEIGHT_ESTIMATE = 260;

const TYPE_OPTIONS = ['Digital', 'Painting', 'Sketch'] as const;
const DEFAULT_STYLE_OPTIONS = ['Realistic', 'Anime', 'Cartoon', 'Abstract', 'Minimal'];
const DEFAULT_SUBJECT_OPTIONS = ['Portrait', 'Pet', 'Nature', 'God'];

type BudgetOption = '₹500–₹1,000' | '₹1,000–₹3,000' | '₹3,000–₹5,000' | '₹5,000+' | 'Custom';
type DeadlineOption = 'Flexible' | '3 days' | '1 week' | '2–3 weeks' | 'Custom';
type SizeOption = 'A4' | 'A3' | 'A2' | 'Custom';
type TypeOption = (typeof TYPE_OPTIONS)[number];

const budgetOptions: BudgetOption[] = ['₹500–₹1,000', '₹1,000–₹3,000', '₹3,000–₹5,000', '₹5,000+', 'Custom'];
const deadlineOptions: DeadlineOption[] = ['Flexible', '3 days', '1 week', '2–3 weeks', 'Custom'];
const sizeOptions: SizeOption[] = ['A4', 'A3', 'A2', 'Custom'];

function formatAgreedDateLine(iso: string | undefined): string {
  if (!iso?.trim()) return '';
  const t = iso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const [y, m, d] = t.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatCommissionStatus(status?: string): string {
  const s = String(status || '').toLowerCase();
  if (s === 'open') return 'Open';
  if (s === 'inprogress') return 'In progress';
  if (s === 'completed' || s === 'closed') return 'Closed';
  return status || '';
}

/** CSS suffix for status pill: completed jobs use the same closed styling. */
function commissionStatusBadgeClassSuffix(status?: string): string {
  const n = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  if (n === 'completed') return 'closed';
  return n;
}

function normalizeStatus(status?: string): string {
  return String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function isCommissionInProgress(status?: string): boolean {
  return normalizeStatus(status) === 'inprogress';
}

function isCommissionOpen(status?: string): boolean {
  return normalizeStatus(status) === 'open';
}

function isCommissionCompleted(status?: string): boolean {
  const n = normalizeStatus(status);
  return n === 'completed' || n === 'closed';
}

/** Sort key for browse lists: prefer createdAt, fall back to updatedAt. */
function commissionRecencyMs(c: CommissionRequest): number {
  if (c.createdAt instanceof Timestamp) return c.createdAt.toMillis();
  if (c.updatedAt instanceof Timestamp) return c.updatedAt.toMillis();
  return 0;
}

function sortCommissionsNewestFirst(list: CommissionRequest[]): CommissionRequest[] {
  return [...list].sort((a, b) => commissionRecencyMs(b) - commissionRecencyMs(a));
}

const ChipSelector: React.FC<{
  options: string[];
  selected: string[];
  onToggle: (item: string) => void;
}> = ({ options, selected, onToggle }) => {
  return (
    <div className="commission-chip-wrap">
      {options.map((item) => {
        const isActive = selected.includes(item);
        return (
          <button
            key={item}
            type="button"
            onClick={() => onToggle(item)}
            className={`commission-chip ${isActive ? 'active' : ''}`}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
};

type CommissionChatContact = {
  uid: string;
  name: string;
  avatar?: string;
};

type CommissionChatMetadata = {
  artworkId: string;
  artworkTitle: string;
  artworkImage?: string;
  agreedFinalPrice?: string;
  agreedAdvanceAmount?: string;
  agreedDeliveryDate?: string;
  hiredArtistId?: string;
  readyToShipImageUrl?: string;
  fullPaymentDone?: boolean;
};

const ACCEPT_OFFER_COPY =
  'Accepting this offer will close any open chats you have with other artists for this commission.';

const CommissionChatModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  currentUserRole?: 'artist' | 'buyer';
  chatId: string;
  contact: CommissionChatContact | null;
  initialMessage?: string;
  metadata: CommissionChatMetadata | null;
  commissionStatus?: string;
  chatClosed?: boolean;
  chatClosedReason?: string;
  /** When set and commission is no longer open to all artists, only this thread may accept (buyer). */
  commissionHiredArtistId?: string | null;
  acceptingOfferMessageId?: string | null;
  onAcceptOffer?: (messageId: string) => Promise<void>;
  onReadyToShip?: () => void;
  onMakePayment?: () => void;
  onMakeShipment?: () => void;
}> = ({
  isOpen,
  onClose,
  currentUserId,
  currentUserRole,
  chatId,
  contact,
  initialMessage = '',
  metadata,
  commissionStatus = 'open',
  chatClosed = false,
  chatClosedReason,
  commissionHiredArtistId = null,
  acceptingOfferMessageId = null,
  onAcceptOffer,
  onReadyToShip,
  onMakePayment,
  onMakeShipment,
}) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<CommissionChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [phoneWarning, setPhoneWarning] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [sendHD, setSendHD] = useState(false);
  const [imageDownloadBusy, setImageDownloadBusy] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; hd?: boolean; msgId: string } | null>(null);
  const [metaSent, setMetaSent] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const markReadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [offerFormOpen, setOfferFormOpen] = useState(false);
  const [offerDeliveryDate, setOfferDeliveryDate] = useState('');
  const [offerFinalPrice, setOfferFinalPrice] = useState('');
  const [offerAdvanceAmount, setOfferAdvanceAmount] = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);
  const [offerAcceptConfirmMessageId, setOfferAcceptConfirmMessageId] = useState<string | null>(null);
  const [offerAcceptConfirmAdvance, setOfferAcceptConfirmAdvance] = useState('');
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [buyerAddressForm, setBuyerAddressForm] = useState({ name: '', line1: '', line2: '', city: '', pincode: '', phone: '' });
  const [artistUpiId, setArtistUpiId] = useState<string | null>(null);
  const [fetchingArtistUpi, setFetchingArtistUpi] = useState(false);

  const showClosedCommissionNoticeFooter = Boolean(
    (chatClosed && (chatClosedReason === 'other_hired' || chatClosedReason === 'commission_completed')) ||
      isCommissionCompleted(commissionStatus),
  );

  const closedFooterMessage = (() => {
    if (chatClosedReason === 'other_hired') {
      return currentUserRole === 'buyer'
        ? COMMISSION_HIRED_ELSEWHERE_MESSAGE
        : COMMISSION_HIRED_ELSEWHERE_MESSAGE_ARTIST;
    }
    return COMMISSION_WORK_COMPLETED_MESSAGE;
  })();
  const commissionInProgress = isCommissionInProgress(commissionStatus);
  const commissionCompleted = isCommissionCompleted(commissionStatus);
  const showSendOfferButton =
    currentUserRole === 'artist' && !commissionInProgress && !commissionCompleted && !chatClosed;

  const showAgreedOfferInContext =
    Boolean(metadata) &&
    Boolean(
      metadata?.agreedFinalPrice?.trim() ||
        metadata?.agreedAdvanceAmount?.trim() ||
        metadata?.agreedDeliveryDate?.trim(),
    ) &&
    Boolean(metadata?.hiredArtistId) &&
    ((currentUserRole === 'buyer' && contact?.uid === metadata?.hiredArtistId) ||
      (currentUserRole === 'artist' && currentUserId === metadata?.hiredArtistId));

  useEffect(() => {
    if (commissionInProgress || commissionCompleted || chatClosed) {
      setOfferFormOpen(false);
    }
  }, [commissionInProgress, commissionCompleted, chatClosed]);

  useEffect(() => {
    if (isOpen && chatId) {
      notifyServiceWorkerActiveChatId(chatId);
      return () => notifyServiceWorkerActiveChatId(null);
    }
    notifyServiceWorkerActiveChatId(null);
  }, [isOpen, chatId]);

 useEffect(() => {
    if (!isOpen) {
      setOfferFormOpen(false);
      setOfferDeliveryDate('');
      setOfferFinalPrice('');
      setOfferAdvanceAmount('');
      setOfferAcceptConfirmMessageId(null);
      setOfferAcceptConfirmAdvance('');
      setShowPaymentConfirm(false);
      setBuyerAddressForm({ name: '', line1: '', line2: '', city: '', pincode: '', phone: '' });
      setArtistUpiId(null);
      setFetchingArtistUpi(false);
    }
  }, [isOpen]);

  // Fetch artist UPI ID when offer acceptance modal opens
  useEffect(() => {
    if (offerAcceptConfirmMessageId && contact?.uid) {
      setFetchingArtistUpi(true);
      getUserProfile(contact.uid)
        .then((profile) => {
          setArtistUpiId(profile?.upiId || null);
        })
        .catch(() => {
          setArtistUpiId(null);
        })
        .finally(() => {
          setFetchingArtistUpi(false);
        });
    } else if (!offerAcceptConfirmMessageId) {
      setArtistUpiId(null);
      setFetchingArtistUpi(false);
    }
  }, [offerAcceptConfirmMessageId, contact?.uid]);

  // Lock body scroll when drawer is open (iOS Safari needs position:fixed trick)
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevWidth = document.body.style.width;
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.width = prevWidth;
      document.body.style.top = '';
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (m) =>
          m.text.trim() !== COMMISSION_HIRED_ELSEWHERE_MESSAGE &&
          m.text.trim() !== COMMISSION_HIRED_ELSEWHERE_MESSAGE_ARTIST,
      ),
    [messages],
  );

  const hasAcceptedOfferInThread = useMemo(
    () =>
      messages.some(
        (m) => m.messageType === 'commission_offer' && m.offerStatus === 'accepted',
      ),
    [messages],
  );

  const pendingImagePreview = useMemo(
    () => (pendingImage ? URL.createObjectURL(pendingImage) : null),
    [pendingImage],
  );
  useEffect(() => {
    return () => {
      if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
    };
  }, [pendingImagePreview]);

  useEffect(() => {
    if (!isOpen) {
      setPendingImage(null);
      return;
    }
    setInputText(initialMessage);
    setMetaSent(false);
  }, [isOpen, initialMessage, contact?.uid]);

  useEffect(() => {
    if (!isOpen || !chatId) return;
    setLoadingMessages(true);
    const unsubscribe = subscribeCommissionMessages(chatId, (items) => {
      setMessages(items);
      setLoadingMessages(false);
    });
    return () => unsubscribe();
  }, [isOpen, chatId]);

  const lastMsgId = messages.length > 0 ? messages[messages.length - 1].id : null;

  useEffect(() => {
    if (!isOpen || !chatId || !currentUserId) return;
    if (markReadTimeoutRef.current) clearTimeout(markReadTimeoutRef.current);
    markReadTimeoutRef.current = setTimeout(async () => {
      markReadTimeoutRef.current = null;
      await markCommissionChatRead(chatId, currentUserId).catch(() => {});
      await markCommissionMessagesSeen(chatId, currentUserId).catch(() => {});
    }, 400);

    return () => {
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current);
        markReadTimeoutRef.current = null;
      }
    };
  }, [isOpen, chatId, currentUserId, lastMsgId]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen, chatId, visibleMessages.length, loadingMessages]);

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

  if (!isOpen || !contact) return null;

  const handleViewProfile = () => {
    sessionStorage.setItem('artworkSourceRoute', '/commissions');
    onClose();
    navigate(`/portfolio/${contact.uid}`);
  };

  const topCommissionTitle =
    metadata?.artworkTitle ||
    messages.find((m) => Boolean(m.commissionTitle))?.commissionTitle ||
    'Commission';
  const topCommissionImage =
    metadata?.artworkImage ||
    messages.find((m) => Boolean(m.commissionImage))?.commissionImage ||
    '/logo.jpeg';

  const handlePickCommissionImage = () => {
    imageInputRef.current?.click();
  };

  const handleCommissionImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file?.type.startsWith('image/')) return;
    setSendHD(false);
    setPendingImage(file);
  };

  const handleDownloadCommissionImage = async (url: string, messageId: string) => {
    setImageDownloadBusy(messageId);
    try {
      await downloadImageFromUrl(url, suggestedChatImageFilename('kalarang-commission'));
    } catch {
      // ignore
    } finally {
      setImageDownloadBusy(null);
    }
  };

  const handleSend = async () => {
    if (chatClosed) return;
    if (!currentUserId || !chatId || !metadata) return;
    const text = inputText.trim();
    if (!text && !pendingImage) return;
    if (phoneWarning) return;
    const imageToSend = pendingImage;
    const isHD = sendHD;
    setInputText('');
    setPendingImage(null);
    setSendHD(false);
    setSending(true);
    try {
      let imageUrl: string | undefined;
      if (imageToSend) {
        imageUrl = await uploadChatMessageImage(currentUserId, 'commissionChats', chatId, imageToSend, isHD);
      }
      await sendCommissionMessage(
        chatId,
        currentUserId,
        text,
        metadata.artworkId,
        metadata.artworkTitle,
        metadata.artworkImage,
        imageUrl,
        isHD && !!imageToSend,
      );
      if (metadata && !metaSent) setMetaSent(true);
    } catch {
      setInputText(text);
      if (imageToSend) setPendingImage(imageToSend);
    } finally {
      setSending(false);
    }
  };

  const handleSubmitOffer = async () => {
    if (!currentUserId || !chatId || !metadata || chatClosed) return;
    setSendingOffer(true);
    try {
      await sendCommissionOfferMessage(
        chatId,
        currentUserId,
        metadata.artworkId,
        metadata.artworkTitle,
        metadata.artworkImage,
        {
          finalPrice: offerFinalPrice,
          advanceAmount: offerAdvanceAmount,
          deliveryDate: offerDeliveryDate,
        },
      );
      setOfferFormOpen(false);
      setOfferDeliveryDate('');
      setOfferFinalPrice('');
      setOfferAdvanceAmount('');
      if (metadata && !metaSent) setMetaSent(true);
      if (contact && currentUserRole === 'artist') {
        getUserProfile(currentUserId).then((profile) => {
          createNotification(
            contact.uid,
            'commission_offer',
            currentUserId,
            profile?.name || 'An artist',
            profile?.avatar,
            undefined, undefined, undefined, undefined,
            metadata.artworkId,
            metadata.artworkTitle,
          ).catch(() => {});
        }).catch(() => {});
      }
      toast.success('Offer sent to the buyer.');
    } catch {
      toast.error('Could not send offer. Check all fields and try again.');
    } finally {
      setSendingOffer(false);
    }
  };

  const formatOfferDeliveryLabel = (iso: string | undefined): string => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) return iso || '—';
    const [y, m, d] = iso.trim().split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatMessageTime = (value?: { toDate?: () => Date } | null): string => {
    if (!value?.toDate) return '';
    const date = value.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDateDivider = (current?: { toDate?: () => Date } | null, previous?: { toDate?: () => Date } | null) => {
    if (!current?.toDate) return null;
    const curr = current.toDate();
    const prev = previous?.toDate ? previous.toDate() : null;
    if (
      prev &&
      curr.getFullYear() === prev.getFullYear() &&
      curr.getMonth() === prev.getMonth() &&
      curr.getDate() === prev.getDate()
    ) {
      return null;
    }
    const now = new Date();
    if (
      curr.getFullYear() === now.getFullYear() &&
      curr.getMonth() === now.getMonth() &&
      curr.getDate() === now.getDate()
    ) {
      return 'Today';
    }
    return curr.toLocaleDateString('en-GB');
  };

  return createPortal(
    <>
    <div className="commission-chat-modal-overlay" onClick={onClose}>
      <div className="commission-chat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="commission-chat-modal-header">
          <div className="commission-chat-modal-drag-handle" aria-hidden="true" />
          <div className="commission-chat-modal-header-row">
          <div className="commission-chat-user">
            <img src={contact.avatar || '/artist.png'} alt={contact.name} className="commission-chat-user-avatar" />
            {currentUserRole === 'buyer' ? (
              <button type="button" className="commission-chat-user-name-link" onClick={handleViewProfile}>
                {contact.name}
              </button>
            ) : (
              <span className="commission-chat-user-name-link">{contact.name}</span>
            )}
          </div>
          <button type="button" className="commission-chat-close" onClick={onClose}>
            ×
          </button>
          </div>
        </div>

        {(metadata || messages.some((m) => Boolean(m.commissionTitle))) && (
          <div className="commission-chat-context-card">
            <img src={topCommissionImage} alt={topCommissionTitle} />
            <div className="commission-chat-context-stack">
              {!showAgreedOfferInContext && (
                <div className="commission-chat-context-main">
                  <div>
                    <p className="commission-chat-context-label">Commission</p>
                    <p className="commission-chat-context-title">{topCommissionTitle}</p>
                  </div>
                  {showSendOfferButton && (
                    <button
                      type="button"
                      className="button button-outline-green commission-chat-hire-btn"
                      disabled={sendingOffer}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOfferFormOpen((o) => !o);
                      }}
                    >
                      Send offer
                    </button>
                  )}
                </div>
              )}
              {showAgreedOfferInContext && metadata && (
                <div className="commission-chat-context-agreed" role="region" aria-label="Agreed offer terms">
                  <div className="commission-chat-context-agreed-left">
                    <span className="commission-chat-context-agreed-title">Agreed offer</span>
                    <div className="commission-chat-context-agreed-grid">
                      {metadata.agreedDeliveryDate?.trim() ? (
                        <span>Delivery: {formatAgreedDateLine(metadata.agreedDeliveryDate)}</span>
                      ) : null}
                      {metadata.agreedFinalPrice?.trim() ? (
                        <span>Final Price: ₹{metadata.agreedFinalPrice}</span>
                      ) : null}
                      {metadata.agreedAdvanceAmount?.trim() ? (
                        <span>Advance: ₹{metadata.agreedAdvanceAmount}</span>
                      ) : null}
                    </div>
                  </div>
                  {currentUserRole === 'artist' && commissionInProgress && onReadyToShip && !metadata?.fullPaymentDone && (
                    <button
                      type="button"
                      className="button button-outline-green commission-ready-to-ship-chat-btn"
                      onClick={onReadyToShip}
                    >
                      Ready to ship
                    </button>
                  )}
                  {currentUserRole === 'artist' && commissionInProgress && metadata?.fullPaymentDone && onMakeShipment && (
                    <button
                      type="button"
                      className="button button-outline-green commission-ready-to-ship-chat-btn"
                      onClick={onMakeShipment}
                    >
                      Make Shipment
                    </button>
                  )}
                  {currentUserRole === 'buyer' && commissionInProgress && metadata?.readyToShipImageUrl && !metadata?.fullPaymentDone && onMakePayment && (
                    <button
                      type="button"
                      className="button button-outline-green commission-ready-to-ship-chat-btn"
                      onClick={onMakePayment}
                    >
                       Make Payment
                    </button>
                  )}
                  {currentUserRole === 'buyer' && metadata?.fullPaymentDone && (
                    <span className="commission-full-payment-done-badge">✓ Full payment</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {showSendOfferButton && offerFormOpen && metadata && (
          <div className="commission-chat-offer-form" onClick={(e) => e.stopPropagation()}>
            <p className="commission-chat-offer-form-title">Your offer</p>
            <p className="commission-chat-offer-form-note">
              💡 Include delivery charges in the total price. Add shipping days to your delivery date.
            </p>
            <label className="commission-chat-offer-field">
              <span>Delivery date</span>
              <input
                type="date"
                value={offerDeliveryDate}
                onChange={(e) => setOfferDeliveryDate(e.target.value)}
                disabled={sendingOffer}
              />
            </label>
            <div className="commission-chat-offer-price-row">
              <label className="commission-chat-offer-field">
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
                  disabled={sendingOffer}
                  autoComplete="off"
                />
              </label>
              <label className="commission-chat-offer-field">
                <span>Advance amount (₹)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 2000"
                  value={offerAdvanceAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow only numbers
                    if (value === '' || /^\d+$/.test(value)) {
                      setOfferAdvanceAmount(value);
                    }
                  }}
                  disabled={sendingOffer}
                  autoComplete="off"
                />
              </label>
            </div>
            <div className="commission-chat-offer-form-actions">
              <button
                type="button"
                className="button button-outline-green"
                disabled={sendingOffer}
                onClick={() => setOfferFormOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={sendingOffer}
                onClick={() => void handleSubmitOffer()}
              >
                {sendingOffer ? (
                  <span className="commission-button-primary-inner">
                    <span className="commission-inline-spinner" aria-hidden />
                    Sending…
                  </span>
                ) : (
                  'Send offer to buyer'
                )}
              </button>
            </div>
          </div>
        )}

        <div className="commission-chat-messages">
          {loadingMessages && messages.length === 0 ? (
            <p className="commission-chat-empty">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="commission-chat-empty">No messages yet.</p>
          ) : (
            messages.map((msg, index) => {
              const isMine = msg.senderId === currentUserId;
              const previous = index > 0 ? messages[index - 1] : undefined;
              const divider = getDateDivider(msg.createdAt as any, previous?.createdAt as any);
              const seen = isMine && visibleMessages
                .filter((m) => m.senderId === currentUserId)
                .slice(-1)[0]?.id === msg.id && Boolean(msg.seenBy?.includes(contact.uid));
              return (
                <React.Fragment key={msg.id}>
                  {divider && <div className="commission-chat-divider">{divider}</div>}
                  <div className={`commission-chat-bubble-wrap ${isMine ? 'mine' : ''}`}>
                    <div
                      className={`commission-chat-bubble ${isMine ? 'mine' : 'theirs'}${msg.messageType === 'commission_offer' ? ' commission-chat-bubble--offer' : ''}`}
                    >
                      {msg.messageType === 'commission_offer' ? (
                        <div className="commission-chat-offer-card">
                          <p className="commission-chat-offer-card-title">Commission offer</p>
                          {msg.offerStatus === 'accepted' && (
                            <span className="commission-chat-offer-status">Accepted</span>
                          )}
                          <ul className="commission-chat-offer-details">
                            <li>
                              <span>Delivery</span>
                              <strong>{formatOfferDeliveryLabel(msg.offerDeliveryDate)}</strong>
                            </li>
                            <li>
                              <span>Final price</span>
                              <strong>₹{msg.offerFinalPrice || '—'}</strong>
                            </li>
                            <li>
                              <span>Advance</span>
                              <strong>₹{msg.offerAdvanceAmount || '—'}</strong>
                            </li>
                          </ul>
                          {currentUserRole === 'buyer' &&
                            msg.offerStatus === 'pending' &&
                            !isMine &&
                            onAcceptOffer &&
                            isCommissionOpen(commissionStatus) &&
                            !chatClosed &&
                            !hasAcceptedOfferInThread &&
                            (!commissionHiredArtistId || commissionHiredArtistId === contact?.uid) && (
                              <button
                                type="button"
                                className="button button-primary commission-chat-offer-accept"
                                disabled={acceptingOfferMessageId === msg.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOfferAcceptConfirmMessageId(msg.id);
                                  setOfferAcceptConfirmAdvance(msg.offerAdvanceAmount || '');
                                }}
                              >
                                Accept offer
                              </button>
                            )}
                        </div>
                      ) : msg.messageType === 'address_card' ? (
                        <div className="commission-chat-address-card">
                          <span className="commission-chat-address-card-label">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/>
                              <circle cx="12" cy="10" r="3"/>
                            </svg>
                            Delivery address
                          </span>
                          {msg.addressName && <span className="commission-chat-address-card-name">{msg.addressName}</span>}
                          <span className="commission-chat-address-card-lines">
                            {[msg.addressLine1, msg.addressLine2].filter(Boolean).join(', ')}
                          </span>
                          <span className="commission-chat-address-card-lines">
                            {[msg.addressCity, msg.addressPincode].filter(Boolean).join(' – ')}
                          </span>
                          {msg.addressPhone && <span className="commission-chat-address-card-phone">{msg.addressPhone}</span>}
                        </div>
                      ) : (
                        <>
                          {msg.imageUrl && (
                            <div
                              className="commission-chat-attachment commission-chat-attachment--clickable"
                              onClick={() => setPreviewImage({ url: msg.imageUrl!, hd: msg.imageHd, msgId: msg.id })}
                              role="button"
                              tabIndex={0}
                              aria-label="View image"
                              onKeyDown={(e) => e.key === 'Enter' && setPreviewImage({ url: msg.imageUrl!, hd: msg.imageHd, msgId: msg.id })}
                            >
                              {msg.imageHd && <span className="commission-chat-hd-badge">HD</span>}
                              <img src={msg.imageUrl} alt="" className="commission-chat-attachment-img" loading="lazy" />
                            </div>
                          )}
                          {Boolean(msg.text?.trim()) && <p>{msg.text}</p>}
                        </>
                      )}
                      <span className="commission-chat-bubble-time">{formatMessageTime(msg.createdAt as any)}</span>
                    </div>
                    {seen && <span className="commission-chat-seen">Seen</span>}
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <footer
          className={`commission-chat-input-area${showClosedCommissionNoticeFooter ? ' commission-chat-input-area-replaced' : ''}`}
        >
          {showClosedCommissionNoticeFooter ? (
            <p className="commission-chat-hired-elsewhere-notice" role="status">
              {closedFooterMessage}
            </p>
          ) : (
            <>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="commission-chat-file-input"
                onChange={handleCommissionImageSelected}
                aria-hidden
                tabIndex={-1}
              />
              {pendingImagePreview && (
                <div className="commission-chat-pending-image">
                  <img src={pendingImagePreview} alt="" />
                  <button
                    type="button"
                    className="commission-chat-pending-remove"
                    onClick={() => { setPendingImage(null); setSendHD(false); }}
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                  <button
                    type="button"
                    className={`commission-chat-hd-toggle${sendHD ? ' commission-chat-hd-toggle--active' : ''}`}
                    onClick={() => setSendHD((v) => !v)}
                    aria-label={sendHD ? 'Sending as HD — tap to switch to standard' : 'Send as HD'}
                    title={sendHD ? 'HD on — tap to switch to standard' : 'Send as HD'}
                  >
                    HD
                  </button>
                </div>
              )}
              {phoneWarning && (
                <div className="cd-phone-warning">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  Please don't share phone numbers for your safety.
                </div>
              )}
              <div className="commission-chat-input-row">
              <textarea
                ref={inputRef}
                className="commission-chat-input"
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setPhoneWarning(containsPhoneNumber(e.target.value));
                }}
                placeholder="Type a message..."
                rows={1}
                disabled={sending || chatClosed}
              />
              <button
                type="button"
                className="commission-chat-attach"
                onClick={handlePickCommissionImage}
                disabled={sending || chatClosed}
                aria-label="Attach image"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>
              <button
                type="button"
                className={`commission-chat-send${sending ? ' commission-chat-send--busy' : ''}`}
                onClick={handleSend}
                disabled={(!inputText.trim() && !pendingImage) || sending || chatClosed || phoneWarning}
                aria-label={sending ? 'Sending message' : 'Send message'}
              >
                {sending ? (
                  <span className="commission-inline-spinner commission-inline-spinner--outline" aria-hidden />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
            </>
          )}
        </footer>
      </div>
    </div>
    {previewImage && (
      <ChatImageModal
        url={previewImage.url}
        isHd={previewImage.hd}
        downloading={imageDownloadBusy === previewImage.msgId}
        onDownload={() => handleDownloadCommissionImage(previewImage.url, previewImage.msgId)}
        onClose={() => setPreviewImage(null)}
      />
    )}
    {offerAcceptConfirmMessageId && onAcceptOffer && (() => {
      const UPI_ID = artistUpiId || null;
      const upiUri = UPI_ID ? `upi://pay?pa=${UPI_ID}&pn=Kalarang%20Art${offerAcceptConfirmAdvance ? `&am=${offerAcceptConfirmAdvance}` : ''}&cu=INR` : '';
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const addressComplete =
        buyerAddressForm.name.trim() !== '' &&
        buyerAddressForm.line1.trim() !== '' &&
        buyerAddressForm.city.trim() !== '' &&
        buyerAddressForm.pincode.trim() !== '' &&
        buyerAddressForm.phone.trim() !== '';
      return (
        <div
          className="confirm-modal-overlay"
          role="presentation"
          onClick={() => {
            if (!acceptingOfferMessageId) setOfferAcceptConfirmMessageId(null);
          }}
        >
          <div
            className="confirm-modal-content commission-accept-offer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="commission-accept-offer-title"
            aria-describedby="commission-accept-offer-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="commission-accept-offer-close"
              aria-label="Close"
              disabled={Boolean(acceptingOfferMessageId)}
              onClick={() => {
                setOfferAcceptConfirmMessageId(null);
                setShowPaymentConfirm(false);
              }}
            >
              ×
            </button>
            <h2 id="commission-accept-offer-title" className="confirm-modal-title">
              Accept offer
            </h2>
            <p id="commission-accept-offer-desc" className="confirm-modal-message">
              {ACCEPT_OFFER_COPY}
            </p>
            <div className="commission-accept-address-form">
              <p className="commission-accept-address-form-title">Delivery address</p>
              <input
                type="text"
                className="commission-accept-address-input"
                placeholder="Full name"
                value={buyerAddressForm.name}
                onChange={(e) => setBuyerAddressForm((p) => ({ ...p, name: e.target.value }))}
                disabled={Boolean(acceptingOfferMessageId)}
              />
              <input
                type="text"
                className="commission-accept-address-input"
                placeholder="Flat / House / Building"
                value={buyerAddressForm.line1}
                onChange={(e) => setBuyerAddressForm((p) => ({ ...p, line1: e.target.value }))}
                disabled={Boolean(acceptingOfferMessageId)}
              />
              <input
                type="text"
                className="commission-accept-address-input"
                placeholder="Street / Area / Locality"
                value={buyerAddressForm.line2}
                onChange={(e) => setBuyerAddressForm((p) => ({ ...p, line2: e.target.value }))}
                disabled={Boolean(acceptingOfferMessageId)}
              />
              <div className="commission-accept-address-row">
                <input
                  type="text"
                  className="commission-accept-address-input"
                  placeholder="City"
                  value={buyerAddressForm.city}
                  onChange={(e) => setBuyerAddressForm((p) => ({ ...p, city: e.target.value }))}
                  disabled={Boolean(acceptingOfferMessageId)}
                />
                <input
                  type="text"
                  className="commission-accept-address-input"
                  placeholder="Pincode"
                  value={buyerAddressForm.pincode}
                  onChange={(e) => setBuyerAddressForm((p) => ({ ...p, pincode: e.target.value }))}
                  disabled={Boolean(acceptingOfferMessageId)}
                />
              </div>
              <input
                type="tel"
                className="commission-accept-address-input"
                placeholder="Phone number"
                value={buyerAddressForm.phone}
                onChange={(e) => setBuyerAddressForm((p) => ({ ...p, phone: e.target.value }))}
                disabled={Boolean(acceptingOfferMessageId)}
              />
            </div>
            <div className="commission-accept-offer-payment">
              <p className="commission-accept-offer-payment-label">
                Pay advance and accept
              </p>
              {offerAcceptConfirmAdvance && (
                <div className="commission-accept-offer-amount">₹{offerAcceptConfirmAdvance}</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                <p className="commission-accept-offer-upiid" style={{ margin: 0 }}>UPI ID: <strong>{UPI_ID}</strong></p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(UPI_ID!);
                    toast.success('UPI ID copied to clipboard!');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0.25rem',
                    cursor: 'pointer',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Copy UPI ID"
                >
                  {MdContentCopy({ size: 18 })}
                </button>
              </div>
              <div className="commission-accept-offer-qr">
                <QRCodeSVG value={upiUri} size={180} />
                <p className="commission-accept-offer-qr-hint">Scan to pay via UPI</p>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '0.5rem' }}>💡 You are directly paying to the artist</p>
            </div>
            {!addressComplete && (
              <p className="commission-accept-address-required-hint">* Fill in all address fields to continue</p>
            )}
            {showPaymentConfirm ? (
              <div className="commission-make-payment-confirm-block">
                <p className="commission-payment-confirm-tooltip-q">Have you made the payment?</p>
                <div className="confirm-modal-actions confirm-modal-actions--row">
                  <button
                    type="button"
                    className="confirm-modal-btn confirm-modal-btn-cancel"
                    disabled={Boolean(acceptingOfferMessageId)}
                    onClick={() => setShowPaymentConfirm(false)}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className="confirm-modal-btn confirm-modal-btn-confirm confirm-modal-btn-info"
                    disabled={Boolean(acceptingOfferMessageId)}
                    onClick={async () => {
                      const id = offerAcceptConfirmMessageId;
                      if (!id || !onAcceptOffer) return;
                      try {
                        await onAcceptOffer(id);
                        if (metadata?.artworkId && chatId) {
                          const formattedAddress = [
                            buyerAddressForm.name,
                            buyerAddressForm.line1,
                            buyerAddressForm.line2,
                            buyerAddressForm.city,
                            buyerAddressForm.pincode,
                            buyerAddressForm.phone,
                          ].filter(Boolean).join(', ');
                          await markAdvancePaid(
                            metadata.artworkId,
                            offerAcceptConfirmAdvance,
                            formattedAddress || undefined,
                          ).catch(() => {});
                          
                          // Send address as a card message in the chat
                          await sendCommissionAddressCard(
                            chatId,
                            currentUserId!,
                            metadata.artworkId,
                            buyerAddressForm,
                            metadata.artworkTitle,
                            metadata.artworkImage,
                          ).catch(() => {});
                        }
                        setShowPaymentConfirm(false);
                        setOfferAcceptConfirmMessageId(null);
                        setOfferAcceptConfirmAdvance('');
                        setBuyerAddressForm({ name: '', line1: '', line2: '', city: '', pincode: '', phone: '' });
                      } catch {
                        // Parent shows toast
                      }
                    }}
                  >
                    <span className="commission-hire-tooltip-confirm-inner">
                      {acceptingOfferMessageId && <span className="commission-inline-spinner commission-inline-spinner--outline" aria-hidden />}
                      {acceptingOfferMessageId ? 'Please wait…' : 'Yes'}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="confirm-modal-actions confirm-modal-actions--row">
                <button
                  type="button"
                  className="confirm-modal-btn confirm-modal-btn-cancel"
                  disabled={Boolean(acceptingOfferMessageId)}
                  onClick={() => {
                    setOfferAcceptConfirmMessageId(null);
                    setShowPaymentConfirm(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="confirm-modal-btn confirm-modal-btn-confirm confirm-modal-btn-info"
                  disabled={Boolean(acceptingOfferMessageId) || !addressComplete}
                  title={!addressComplete ? 'Please fill in all address fields' : undefined}
                  onClick={() => setShowPaymentConfirm(true)}
                >
                  Accept
                </button>
              </div>
            )}
          </div>
        </div>
      );
    })()}
    </>,
    document.body,
  );
};

interface CommissionsProps {
  mode?: 'form' | 'list';
}

interface CommissionListUiState {
  mainTab: MainListTab;
  artistSubTab: ArtistSubTab;
  buyerSubTab: BuyerSubTab;
}

interface CommissionDraftData {
  title: string;
  description: string;
  budget: BudgetOption | '';
  customBudget: string;
  deadline: DeadlineOption | '';
  customDate: string;
  size: SizeOption | '';
  customHeight: string;
  customWidth: string;
  type: TypeOption | '';
  style: string[];
  subject: string[];
  deliveryType: '' | 'Digital file' | 'Physical artwork';
  cityOrPincode: string;
  styleOptions: string[];
  subjectOptions: string[];
}

interface ArtistCommissionActions {
  [commissionId: string]: {
    applied?: boolean;
    shortlisted?: boolean;
  };
}

type MainListTab = 'commissions' | 'my-applications';
type ArtistSubTab = 'shortlisted' | 'applied' | 'inprogress' | 'completed';
type BuyerSubTab = 'posted' | 'inprogress' | 'completed';

function buyerSubTabForStatus(status: string | undefined): BuyerSubTab {
  const n = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  if (n === 'inprogress') return 'inprogress';
  if (n === 'completed') return 'completed';
  return 'posted';
}

/** Which Applications sub-tab a row belongs to — mirrors `listRequests` artist filters. */
function artistSubTabForItem(
  item: CommissionRequest,
  uid: string,
  artistActions: ArtistCommissionActions,
): ArtistSubTab | null {
  const action = artistActions[item.id] || {};
  const itemStatus = String(item.status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const hiredYou =
    item.hiredArtistId === uid &&
    (itemStatus === 'inprogress' || itemStatus === 'completed');

  if (itemStatus === 'completed' && item.hiredArtistId === uid) return 'completed';
  if (itemStatus === 'inprogress' && item.hiredArtistId === uid) return 'inprogress';
  if (Boolean(action.applied) && !hiredYou) return 'applied';
  if (Boolean(action.shortlisted) && !Boolean(action.applied) && !hiredYou) return 'shortlisted';
  return null;
}

function commissionUnreadTotalForUser(
  chats: CommissionChat[],
  commissionId: string,
  uid: string,
): number {
  return chats
    .filter((ch) => ch.commissionId === commissionId && ch.participants.includes(uid))
    .reduce((sum, ch) => sum + (ch.unreadFor?.[uid] ?? 0), 0);
}

const Commissions: React.FC<CommissionsProps> = ({ mode = 'form' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const onCommissionsRoute = location.pathname === '/commissions';
  const { appUser } = useAuth();
  const maxImages = 2;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [budget, setBudget] = useState<BudgetOption | ''>('');
  const [customBudget, setCustomBudget] = useState('');
  const [deadline, setDeadline] = useState<DeadlineOption | ''>('');
  const [customDate, setCustomDate] = useState('');
  const [size, setSize] = useState<SizeOption | ''>('');
  const [customHeight, setCustomHeight] = useState('');
  const [customWidth, setCustomWidth] = useState('');
  const [type, setType] = useState<TypeOption | ''>('');
  const [style, setStyle] = useState<string[]>([]);
  const [subject, setSubject] = useState<string[]>([]);
  const [deliveryType, setDeliveryType] = useState<'' | 'Digital file' | 'Physical artwork'>('');
  const [cityOrPincode, setCityOrPincode] = useState('');

  const [styleOptions, setStyleOptions] = useState<string[]>(DEFAULT_STYLE_OPTIONS);
  const [subjectOptions, setSubjectOptions] = useState<string[]>(DEFAULT_SUBJECT_OPTIONS);
  const [showStyleInput, setShowStyleInput] = useState(false);
  const [showSubjectInput, setShowSubjectInput] = useState(false);
  const [newStyle, setNewStyle] = useState('');
  const [newSubject, setNewSubject] = useState('');

  const [isDesktop, setIsDesktop] = useState(false);
  const { hidden: tabsHidden, anchorRef: tabsAnchorRef } = useScrollDirection();
  const containerRef = useRef<HTMLElement | null>(null);
  const [isContainerReady, setIsContainerReady] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const [imagePreviews, setImagePreviews] = useState<Array<{ name: string; url: string }>>([]);
  const [postedRequests, setPostedRequests] = useState<CommissionRequest[]>([]);
  const [buyerRequests, setBuyerRequests] = useState<CommissionRequest[]>([]);
  const [artistApplicationCommissions, setArtistApplicationCommissions] = useState<CommissionRequest[]>([]);
  const [hiredArtistCommissions, setHiredArtistCommissions] = useState<CommissionRequest[]>([]);
  const [commissionDocsFromChats, setCommissionDocsFromChats] = useState<CommissionRequest[]>([]);
  /** Shortlist-without-apply: bookmark + getDoc; not returned by applications query — keep separate from refetches. */
  const [shortlistOnlyCommissions, setShortlistOnlyCommissions] = useState<CommissionRequest[]>([]);
  const [commissionStatusForChat, setCommissionStatusForChat] = useState<string>('open');
  const [commissionHiredArtistIdForChat, setCommissionHiredArtistIdForChat] = useState<string | null>(null);
  const [commissionChatClosed, setCommissionChatClosed] = useState(false);
  const [commissionChatClosedReason, setCommissionChatClosedReason] = useState<string | undefined>(undefined);
  const [acceptingOfferMessageId, setAcceptingOfferMessageId] = useState<string | null>(null);
  const [markingCompletedId, setMarkingCompletedId] = useState<string | null>(null);
  const [completeConfirmItem, setCompleteConfirmItem] = useState<CommissionRequest | null>(null);
  const [addressTooltipId, setAddressTooltipId] = useState<string | null>(null);
  const [readyToShipItem, setReadyToShipItem] = useState<CommissionRequest | null>(null);
  const [readyToShipFile, setReadyToShipFile] = useState<File | null>(null);
  const [readyToShipPreview, setReadyToShipPreview] = useState<string | null>(null);
  const [readyToShipUploading, setReadyToShipUploading] = useState(false);
  const [makePaymentOpen, setMakePaymentOpen] = useState(false);
  const [makePaymentConfirm, setMakePaymentConfirm] = useState(false);
  const [makePaymentBusy, setMakePaymentBusy] = useState(false);
  const [artistUpiIdForPayment, setArtistUpiIdForPayment] = useState<string | null>(null);
  const [fetchingUpiIdForPayment, setFetchingUpiIdForPayment] = useState(false);
  const [makePaymentCommissionId, setMakePaymentCommissionId] = useState<string | null>(null);
  const [makePaymentCommissionTitle, setMakePaymentCommissionTitle] = useState<string | null>(null);
  const [makeShipmentItem, setMakeShipmentItem] = useState<CommissionRequest | null>(null);
  const [trackingInput, setTrackingInput] = useState('');
  const [shipmentReceiptFile, setShipmentReceiptFile] = useState<File | null>(null);
  const [shipmentReceiptPreview, setShipmentReceiptPreview] = useState<string | null>(null);
  const [makeShipmentBusy, setMakeShipmentBusy] = useState(false);
  const shipmentReceiptInputRef = useRef<HTMLInputElement>(null);
  const [reviewsMap, setReviewsMap] = useState<Record<string, CommissionReview | null>>({});
  const [reviewOpenId, setReviewOpenId] = useState<string | null>(null);
  const [reviewInputs, setReviewInputs] = useState<Record<string, string>>({});
  const [ratingInputs, setRatingInputs] = useState<Record<string, number>>({});
  const [reviewSubmitting, setReviewSubmitting] = useState<string | null>(null);
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [replySubmitting, setReplySubmitting] = useState<string | null>(null);
  const [shareToPublicItem, setShareToPublicItem] = useState<CommissionRequest | null>(null);
  const [shareToPublicImage, setShareToPublicImage] = useState<File | null>(null);
  const [shareToPublicImagePreview, setShareToPublicImagePreview] = useState<string | null>(null);
  const [shareToPublicText, setShareToPublicText] = useState('');
  const [shareToPublicBusy, setShareToPublicBusy] = useState(false);
  const reviewsLoadedRef = useRef(false);
  const [artistActionBusy, setArtistActionBusy] = useState<{
    commissionId: string;
    kind: 'apply' | 'shortlist';
  } | null>(null);
  const [applicationsEmptyCtaLoading, setApplicationsEmptyCtaLoading] = useState(false);
  const [showPortfolioRequiredModal, setShowPortfolioRequiredModal] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [artistActions, setArtistActions] = useState<ArtistCommissionActions>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const allowNavigationRef = useRef(false);
  const commissionPostLottieRef = useRef<any>(null);
  const [activeMainTab, setActiveMainTab] = useState<MainListTab>('commissions');
  const [commissionSearchQuery, setCommissionSearchQuery] = useState('');
  const [debouncedCommissionSearch, setDebouncedCommissionSearch] = useState('');
  const [commissionSearchResults, setCommissionSearchResults] = useState<CommissionRequest[]>([]);
  const [isCommissionSearchLoading, setIsCommissionSearchLoading] = useState(false);
  const [activeArtistSubTab, setActiveArtistSubTab] = useState<ArtistSubTab>('shortlisted');
  const [activeBuyerSubTab, setActiveBuyerSubTab] = useState<BuyerSubTab>('posted');
  const [commissionChats, setCommissionChats] = useState<CommissionChat[]>([]);
  const [commissionChatOpen, setCommissionChatOpen] = useState(false);
  const [commissionChatId, setCommissionChatId] = useState('');
  const [commissionChatContact, setCommissionChatContact] = useState<CommissionChatContact | null>(null);
  const [commissionChatInitialMessage, setCommissionChatInitialMessage] = useState('');
  const [commissionChatMetadata, setCommissionChatMetadata] = useState<CommissionChatMetadata | null>(null);
  const [chatContactsByUid, setChatContactsByUid] = useState<Record<string, CommissionChatContact>>({});
  const hasRestoredListUiRef = useRef(false);
  const backfillApplicationRef = useRef<Set<string>>(new Set());
  const [showCommissionFlowInfo, setShowCommissionFlowInfo] = useState(false);

  // Pagination state for the browse "Commissions" tab
  const [browseLastVisible, setBrowseLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [browseHasMore, setBrowseHasMore] = useState(true);
  const [browseLoadingMore, setBrowseLoadingMore] = useState(false);
  const commissionListScrollRef = useRef<HTMLElement | null>(null);

  // Virtualization state for the commission card grid
  const commissionGridShellRef = useRef<HTMLDivElement | null>(null);
  const [commGridWidth, setCommGridWidth] = useState(0);
  const [commGridScrollTop, setCommGridScrollTop] = useState(0);
  const [commGridOffsetTop, setCommGridOffsetTop] = useState(0);
  const [commGridViewportHeight, setCommGridViewportHeight] = useState(0);

  const mergedArtistCommissions = useMemo(() => {
    const map = new Map<string, CommissionRequest>();
    for (const c of postedRequests) map.set(c.id, c);
    for (const c of artistApplicationCommissions) map.set(c.id, c);
    for (const c of hiredArtistCommissions) map.set(c.id, c);
    for (const c of commissionDocsFromChats) map.set(c.id, c);
    for (const c of shortlistOnlyCommissions) map.set(c.id, c);
    return sortCommissionsNewestFirst(Array.from(map.values()));
  }, [
    postedRequests,
    artistApplicationCommissions,
    hiredArtistCommissions,
    commissionDocsFromChats,
    shortlistOnlyCommissions,
  ]);

  /** Global browse feed (all statuses) + buyer's own rows (deduped by id). */
  const buyerBrowseMerged = useMemo(() => {
    const map = new Map<string, CommissionRequest>();
    for (const c of postedRequests) map.set(c.id, c);
    for (const c of buyerRequests) map.set(c.id, c);
    return sortCommissionsNewestFirst(Array.from(map.values()));
  }, [postedRequests, buyerRequests]);

  const commissionsBrowsePool = useMemo((): CommissionRequest[] => {
    if (appUser?.role === 'buyer') return buyerBrowseMerged;
    if (appUser?.role === 'artist') return mergedArtistCommissions;
    return sortCommissionsNewestFirst(postedRequests);
  }, [appUser?.role, buyerBrowseMerged, mergedArtistCommissions, postedRequests]);

  const getDraftKey = (uid: string) => `commissionDraft_${uid}`;
  const getArtistActionsKey = (uid: string) => `commission_actions_${uid}`;
  const getListUiKey = (uid: string) => `commission_list_ui_${uid}`;

  useEffect(() => {
    if (mode !== 'list') {
      containerRef.current = null;
      setIsContainerReady(false);
      return;
    }

    // Use a slight delay to ensure the DOM is fully rendered
    const timeoutId = setTimeout(() => {
      const commissionElement = document.querySelector('.commission-page');
      if (!commissionElement) {
        setIsContainerReady(false);
        return;
      }

      // First check for main element as it's commonly used for scrolling
      const mainElement = document.querySelector('main');
      if (mainElement) {
        const mainStyle = window.getComputedStyle(mainElement);
        if (mainStyle.overflowY === 'auto' || mainStyle.overflowY === 'scroll') {
          containerRef.current = mainElement as HTMLElement;
          setIsContainerReady(true);
          return;
        }
      }

      // Then check parent hierarchy
      let parent = commissionElement.parentElement;
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          containerRef.current = parent as HTMLElement;
          setIsContainerReady(true);
          return;
        }
        parent = parent.parentElement;
      }

      // Fallback to document.body if no scrollable parent found
      containerRef.current = document.body as HTMLElement;
      setIsContainerReady(true);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [mode]);

  const refreshCommissionLists = useCallback(async () => {
    if (mode !== 'list' || !appUser?.uid) return;

    invalidateCommissionsBrowseCache();
    invalidateCommissionsUserCaches(appUser.uid);

    const role = appUser.role;

    const [browseResult, ownItems, appItems, hiredItems] = await Promise.all([
      getCommissionsPaginated(COMMISSIONS_PAGE_SIZE).catch(() => null),
      role === 'buyer' ? getBuyerCommissionRequestsCached(appUser.uid) : Promise.resolve([]),
      role === 'artist' ? getCommissionsForArtistApplicationsCached(appUser.uid) : Promise.resolve([]),
      role === 'artist' ? getCommissionsForHiredArtistCached(appUser.uid) : Promise.resolve([]),
    ]);

    if (browseResult) {
      setPostedRequests(browseResult.commissions);
      setBrowseLastVisible(browseResult.lastVisible);
      setBrowseHasMore(browseResult.hasMore);
      cache.set(cacheKeys.commissionsBrowse(), browseResult.commissions, 10 * 60 * 1000, 30 * 60 * 1000);
    }
    setBuyerRequests(ownItems);
    setArtistApplicationCommissions(appItems);
    setHiredArtistCommissions(hiredItems);
  }, [appUser?.role, appUser?.uid, mode]);

  useEffect(() => {
    if (mode !== 'list') return;
    const onListsUpdated = () => {
      void refreshCommissionLists();
    };
    window.addEventListener(COMMISSION_LISTS_UPDATED_EVENT, onListsUpdated);
    return () => window.removeEventListener(COMMISSION_LISTS_UPDATED_EVENT, onListsUpdated);
  }, [mode, refreshCommissionLists]);

  const handlePullRefresh = useCallback(async () => {
    await refreshCommissionLists();
  }, [refreshCommissionLists]);

  const pullToRefreshState = usePullToRefresh(containerRef, {
    onRefresh: handlePullRefresh,
    isRealtimeActive: false,
    pullThreshold: 80,
    debounceDuration: 300,
    maxPullDistance: 120,
    containerReady:
      isContainerReady &&
      mode === 'list',
  });

  const loadMoreCommissions = useCallback(async () => {
    if (!browseHasMore || browseLoadingMore || !browseLastVisible) return;
    setBrowseLoadingMore(true);
    try {
      const result = await getCommissionsPaginated(COMMISSIONS_PAGE_SIZE, browseLastVisible);
      const updated = [...postedRequests, ...result.commissions];
      setPostedRequests(updated);
      setBrowseLastVisible(result.lastVisible);
      setBrowseHasMore(result.hasMore);
      cache.set(cacheKeys.commissionsBrowse(), updated, 10 * 60 * 1000, 30 * 60 * 1000);
    } catch {
      toast.error('Failed to load more commissions');
    } finally {
      setBrowseLoadingMore(false);
    }
  }, [browseHasMore, browseLoadingMore, browseLastVisible, postedRequests]);

  // Infinite scroll: detect when near bottom to load next page
  useEffect(() => {
    if (mode !== 'list' || activeMainTab !== 'commissions') return;
    const el = containerRef.current;
    if (!el) return;
    commissionListScrollRef.current = el;
    const handleScroll = () => {
      if (!browseHasMore || browseLoadingMore) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if ((scrollTop + clientHeight) / scrollHeight > 0.8) {
        loadMoreCommissions();
      }
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [mode, activeMainTab, browseHasMore, browseLoadingMore, loadMoreCommissions]);

  useEffect(() => {
    const previews = images.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setImagePreviews(previews);

    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [images]);

  useEffect(() => {
    if (!isSubmitting) return;
    const t = setTimeout(() => commissionPostLottieRef.current?.setSpeed?.(2), 50);
    return () => clearTimeout(t);
  }, [isSubmitting]);

  // Fetch artist UPI ID when make payment modal opens (buyer paying final amount to hired artist)
  useEffect(() => {
    if (makePaymentOpen && commissionChatMetadata?.hiredArtistId) {
      setFetchingUpiIdForPayment(true);
      getUserProfile(commissionChatMetadata.hiredArtistId)
        .then((profile) => {
          setArtistUpiIdForPayment(profile?.upiId || null);
          
          // Send notification if UPI ID is not set
          if ((!profile?.upiId || profile.upiId.trim() === '') && appUser && commissionChatMetadata.hiredArtistId && makePaymentCommissionId) {
            createNotification(
              commissionChatMetadata.hiredArtistId,
              'payment_failed_no_upi',
              appUser.uid,
              appUser.name || 'A buyer',
              appUser.avatar,
              undefined,
              undefined,
              undefined,
              undefined,
              makePaymentCommissionId,
              makePaymentCommissionTitle || undefined
            ).catch(() => {}); // Silent fail
          }
        })
        .catch(() => {
          setArtistUpiIdForPayment(null);
        })
        .finally(() => {
          setFetchingUpiIdForPayment(false);
        });
    } else if (!makePaymentOpen) {
      setArtistUpiIdForPayment(null);
      setFetchingUpiIdForPayment(false);
    }
  }, [makePaymentOpen, commissionChatMetadata?.hiredArtistId, appUser, makePaymentCommissionId, makePaymentCommissionTitle]);

  useEffect(() => {
    const updateSize = () => setIsDesktop(window.innerWidth >= 1024);
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Auto-open commission flow info modal on first visit
  useEffect(() => {
    if (mode !== 'list' || !appUser?.uid || !onCommissionsRoute) return;
    
    const storageKey = `commission-flow-info-seen-${appUser.uid}`;
    const hasSeen = localStorage.getItem(storageKey);
    
    if (!hasSeen) {
      // Small delay to let the page render first
      const timer = setTimeout(() => {
        setShowCommissionFlowInfo(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [appUser?.uid, mode, onCommissionsRoute]);

  useEffect(() => {
    if (mode !== 'form' || !appUser?.uid) return;
    try {
      const raw = localStorage.getItem(getDraftKey(appUser.uid));
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<CommissionDraftData>;
      setTitle(draft.title || '');
      setDescription(draft.description || '');
      setBudget((draft.budget as BudgetOption | '') || '');
      setCustomBudget(draft.customBudget || '');
      setDeadline((draft.deadline as DeadlineOption | '') || '');
      setCustomDate(draft.customDate || '');
      setSize((draft.size as SizeOption | '') || '');
      setCustomHeight(draft.customHeight || '');
      setCustomWidth(draft.customWidth || '');
      setType((draft.type as TypeOption | '') || '');
      setStyle(Array.isArray(draft.style) ? draft.style : []);
      setSubject(Array.isArray(draft.subject) ? draft.subject : []);
      if (draft.deliveryType === 'Digital file' || draft.deliveryType === 'Physical artwork') {
        setDeliveryType(draft.deliveryType);
      } else {
        setDeliveryType('');
      }
      setCityOrPincode(draft.cityOrPincode || '');
      setStyleOptions(
        Array.isArray(draft.styleOptions) && draft.styleOptions.length > 0
          ? draft.styleOptions
          : DEFAULT_STYLE_OPTIONS,
      );
      setSubjectOptions(
        Array.isArray(draft.subjectOptions) && draft.subjectOptions.length > 0
          ? draft.subjectOptions
          : DEFAULT_SUBJECT_OPTIONS,
      );
     
    } catch {
      // ignore malformed draft
    }
  }, [appUser?.uid, mode]);

  useEffect(() => {
    const loadRequests = async () => {
      if (mode !== 'list' || !appUser?.uid) return;

      const uid = appUser.uid;
      const role = appUser.role;

      const browseCached = cache.get<CommissionRequest[]>(cacheKeys.commissionsBrowse());
      const buyerCached =
        role === 'buyer' ? cache.get<CommissionRequest[]>(cacheKeys.commissionsBuyer(uid)) : null;
      const appsCached =
        role === 'artist'
          ? cache.get<CommissionRequest[]>(cacheKeys.commissionsArtistApps(uid))
          : null;
      const hiredCached =
        role === 'artist'
          ? cache.get<CommissionRequest[]>(cacheKeys.commissionsArtistHired(uid))
          : null;
      const isBrowseFresh = browseCached.exists && !browseCached.isStale;
      const isBuyerFresh = Boolean(buyerCached?.exists && !buyerCached?.isStale);
      const isArtistAppsFresh = Boolean(appsCached?.exists && !appsCached?.isStale);
      const isArtistHiredFresh = Boolean(hiredCached?.exists && !hiredCached?.isStale);

      const allFresh =
        isBrowseFresh &&
        (role !== 'buyer' || isBuyerFresh) &&
        (role !== 'artist' || (isArtistAppsFresh && isArtistHiredFresh));

      const hasAnyCached =
        browseCached.exists ||
        (buyerCached?.exists ?? false) ||
        (appsCached?.exists ?? false) ||
        (hiredCached?.exists ?? false);

      if (browseCached.exists && browseCached.data) {
        setPostedRequests(browseCached.data);
      }
      if (role === 'buyer' && buyerCached?.exists && buyerCached.data) {
        setBuyerRequests(buyerCached.data);
      }
      if (role === 'artist') {
        if (appsCached?.exists && appsCached.data) {
          setArtistApplicationCommissions(appsCached.data);
        }
        if (hiredCached?.exists && hiredCached.data) {
          setHiredArtistCommissions(hiredCached.data);
        }
      } else {
        setArtistApplicationCommissions([]);
        setHiredArtistCommissions([]);
      }

      if (allFresh) {
        setIsLoadingRequests(false);
        return;
      }

      if (!hasAnyCached) {
        setIsLoadingRequests(true);
      }

      try {
        if (!isBrowseFresh) {
          try {
            const result = await getCommissionsPaginated(COMMISSIONS_PAGE_SIZE);
            setPostedRequests(result.commissions);
            setBrowseLastVisible(result.lastVisible);
            setBrowseHasMore(result.hasMore);
            cache.set(cacheKeys.commissionsBrowse(), result.commissions, 10 * 60 * 1000, 30 * 60 * 1000);
          } catch {
            try {
              const openItems = await getBrowseCommissionRequestsCached();
              setPostedRequests(openItems);
              setBrowseHasMore(false);
            } catch {
              setPostedRequests([]);
              setBrowseHasMore(false);
            }
          }
        }
        try {
          if (role === 'buyer') {
            if (!isBuyerFresh) {
              const ownItems = await getBuyerCommissionRequestsCached(uid);
              setBuyerRequests(ownItems);
            }
          } else {
            setBuyerRequests([]);
          }
        } catch {
          setBuyerRequests([]);
        }
        if (role === 'artist') {
          if (!isArtistAppsFresh) {
            try {
              const artistAppItems = await getCommissionsForArtistApplicationsCached(uid);
              setArtistApplicationCommissions(artistAppItems);
            } catch {
              setArtistApplicationCommissions([]);
            }
          }
          if (!isArtistHiredFresh) {
            try {
              const hiredItems = await getCommissionsForHiredArtistCached(uid);
              setHiredArtistCommissions(hiredItems);
            } catch {
              setHiredArtistCommissions([]);
            }
          }
        } else {
          setArtistApplicationCommissions([]);
          setHiredArtistCommissions([]);
        }
      } finally {
        setIsLoadingRequests(false);
      }
    };

    loadRequests();
  }, [appUser?.uid, appUser?.role, mode]);

  useEffect(() => {
    if (!appUser?.uid || appUser.role !== 'artist') return;
    // Avoid duplicate fetches while chats subscription is still empty; loadRequests already loads lists.
    if (commissionChats.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const appRows = await getCommissionsForArtistApplicationsCached(appUser.uid);
        if (!cancelled) setArtistApplicationCommissions(appRows);
      } catch {
        if (!cancelled) setArtistApplicationCommissions([]);
      }
      try {
        const hiredRows = await getCommissionsForHiredArtistCached(appUser.uid);
        if (!cancelled) setHiredArtistCommissions(hiredRows);
      } catch {
        if (!cancelled) setHiredArtistCommissions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appUser?.uid, appUser?.role, commissionChats]);

  useEffect(() => {
    if (!appUser?.uid || appUser.role !== 'artist') {
      setCommissionDocsFromChats([]);
      return;
    }
    const ids = [...new Set(commissionChats.map((c) => c.commissionId).filter(Boolean))] as string[];
    if (ids.length === 0) {
      setCommissionDocsFromChats([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      getCommissionDocumentsByIds(ids).then((rows) => {
        if (!cancelled) setCommissionDocsFromChats(rows);
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [commissionChats, appUser?.uid, appUser?.role]);

  useEffect(() => {
    if (!commissionChatOpen || !commissionChatId) return;
    const c = commissionChats.find((ch) => ch.id === commissionChatId);
    if (c) {
      setCommissionChatClosed(Boolean(c.closed));
      setCommissionChatClosedReason(c.closedReason);
    }
  }, [commissionChatOpen, commissionChatId, commissionChats]);

  useEffect(() => {
    if (!commissionChatOpen || !commissionChatMetadata?.artworkId) return;
    const id = commissionChatMetadata.artworkId;
    const pool =
      appUser?.role === 'buyer'
        ? buyerRequests
        : mergedArtistCommissions;
    const row = pool.find((r) => r.id === id);
    if (row?.status) setCommissionStatusForChat(row.status);
    if (appUser?.role === 'buyer') {
      setCommissionHiredArtistIdForChat(row?.hiredArtistId ?? null);
    } else {
      setCommissionHiredArtistIdForChat(null);
    }
    if (row) {
      setCommissionChatMetadata((prev) => {
        if (!prev || prev.artworkId !== row.id) return prev;
        const agreedFinalPrice = row.agreedFinalPrice;
        const agreedAdvanceAmount = row.agreedAdvanceAmount;
        const agreedDeliveryDate = row.agreedDeliveryDate;
        const hiredArtistId = row.hiredArtistId;
        const readyToShipImageUrl = row.readyToShipImageUrl;
        const fullPaymentDone = row.fullPaymentDone;
        if (
          prev.agreedFinalPrice === agreedFinalPrice &&
          prev.agreedAdvanceAmount === agreedAdvanceAmount &&
          prev.agreedDeliveryDate === agreedDeliveryDate &&
          prev.hiredArtistId === hiredArtistId &&
          prev.readyToShipImageUrl === readyToShipImageUrl &&
          prev.fullPaymentDone === fullPaymentDone
        ) {
          return prev;
        }
        return {
          ...prev,
          agreedFinalPrice,
          agreedAdvanceAmount,
          agreedDeliveryDate,
          hiredArtistId,
          readyToShipImageUrl,
          fullPaymentDone,
        };
      });
    }
  }, [commissionChatOpen, commissionChatMetadata?.artworkId, buyerRequests, mergedArtistCommissions, appUser?.role]);

  // Live-sync readyToShipImageUrl + fullPaymentDone from commission doc while chat is open
  useEffect(() => {
    if (!commissionChatOpen || !commissionChatMetadata?.artworkId) return;
    const ref = firestoreDoc(db, 'commissions', commissionChatMetadata.artworkId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setCommissionChatMetadata((prev) => {
        if (!prev) return prev;
        if (prev.readyToShipImageUrl === data.readyToShipImageUrl && prev.fullPaymentDone === data.fullPaymentDone) return prev;
        return { ...prev, readyToShipImageUrl: data.readyToShipImageUrl, fullPaymentDone: data.fullPaymentDone };
      });
      // Sync back to buyerRequests so card list + next chat open reflect latest data
      setBuyerRequests((prev) =>
        prev.map((r) =>
          r.id === snap.id &&
          (r.readyToShipImageUrl !== data.readyToShipImageUrl || r.fullPaymentDone !== data.fullPaymentDone)
            ? { ...r, readyToShipImageUrl: data.readyToShipImageUrl, fullPaymentDone: data.fullPaymentDone }
            : r
        )
      );
    });
    return () => unsub();
  }, [commissionChatOpen, commissionChatMetadata?.artworkId]);

  // Load reviews when entering my-applications so dot can be computed for any sub-tab
  useEffect(() => {
    if (!appUser?.uid || activeMainTab !== 'my-applications') return;
    if (reviewsLoadedRef.current) return;
    reviewsLoadedRef.current = true;
    const loader = appUser.role === 'buyer'
      ? getReviewsForBuyer(appUser.uid)
      : getReviewsForArtist(appUser.uid);
    loader.then((reviews) => {
      const map: Record<string, CommissionReview | null> = {};
      for (const r of reviews) map[r.commissionId] = r;
      setReviewsMap(map);
    }).catch(() => {});
  }, [appUser?.uid, appUser?.role, activeMainTab]);

  // Live-sync status, readyToShipImageUrl, fullPaymentDone, trackingId for all buyer commissions
  useEffect(() => {
    if (!appUser?.uid || appUser.role !== 'buyer') return;
    const q = query(
      collection(db, 'commissions'),
      where('buyerId', '==', appUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'removed') return;
        const data = change.doc.data();
        const id = change.doc.id;
        setBuyerRequests((prev) =>
          prev.map((r) => {
            if (r.id !== id) return r;
            if (
              r.status === data.status &&
              r.readyToShipImageUrl === data.readyToShipImageUrl &&
              r.fullPaymentDone === data.fullPaymentDone &&
              r.trackingId === data.trackingId
            ) return r;
            return {
              ...r,
              status: data.status ?? r.status,
              readyToShipImageUrl: data.readyToShipImageUrl,
              fullPaymentDone: data.fullPaymentDone,
              trackingId: data.trackingId,
            };
          })
        );
      });
    });
    return () => unsub();
  }, [appUser?.uid, appUser?.role]);

  useEffect(() => {
    if (!appUser?.uid || appUser.role !== 'artist') return;
    for (const chat of commissionChats) {
      if (!chat.commissionId || backfillApplicationRef.current.has(chat.id)) continue;
      const other = chat.participants.find((u) => u !== appUser.uid);
      if (!other) continue;
      backfillApplicationRef.current.add(chat.id);
      registerArtistApplication(chat.commissionId, appUser.uid)
        .then(() => {
          setArtistActions((prev) => {
            if (prev[chat.commissionId]?.applied) return prev;
            const next: ArtistCommissionActions = {
              ...prev,
              [chat.commissionId]: { ...prev[chat.commissionId], applied: true },
            };
            localStorage.setItem(getArtistActionsKey(appUser.uid), JSON.stringify(next));
            return next;
          });
        })
        .catch(() => {});
    }
  }, [appUser?.uid, appUser?.role, commissionChats]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedCommissionSearch(commissionSearchQuery), 300);
    return () => window.clearTimeout(t);
  }, [commissionSearchQuery]);

  useEffect(() => {
    if (activeMainTab !== 'commissions') {
      setIsCommissionSearchLoading(false);
      return;
    }
    const q = debouncedCommissionSearch.trim();
    if (!q) {
      setCommissionSearchResults([]);
      setIsCommissionSearchLoading(false);
      return;
    }
    let cancelled = false;
    setIsCommissionSearchLoading(true);
    searchOpenCommissionsServer(q)
      .then((rows) => {
        if (!cancelled) setCommissionSearchResults(rows);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Search failed. Try again.');
          setCommissionSearchResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsCommissionSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedCommissionSearch, activeMainTab]);

  useEffect(() => {
    if (!appUser?.uid) {
      setCommissionChats([]);
      return;
    }
    if (mode !== 'list') {
      return;
    }
    // Per-card chat rows + unread badges (all Applications child tabs) need live `commissionChats`.
    // Subscribe only on the Commissions route and the My applications main tab so the listener
    // attaches as soon as the user switches here (and tears down when they leave or browse Open requests).
    if (!onCommissionsRoute || activeMainTab !== 'my-applications') {
      return;
    }
    const unsubscribe = subscribeToUserCommissionChats(appUser.uid, (items) => {
      setCommissionChats(items);
    });
    return () => unsubscribe();
  }, [appUser?.uid, mode, activeMainTab, onCommissionsRoute]);

  useEffect(() => {
    if (!appUser?.uid || commissionChats.length === 0) return;

    const otherUids = Array.from(
      new Set(
        commissionChats
          .map((chat) => chat.participants.find((uid) => uid !== appUser.uid))
          .filter((uid): uid is string => Boolean(uid)),
      ),
    ).filter((uid) => !chatContactsByUid[uid]);

    if (otherUids.length === 0) return;

    Promise.all(otherUids.map((uid) => getUserProfile(uid)))
      .then((profiles) => {
        const next: Record<string, CommissionChatContact> = {};
        profiles.forEach((profile, idx) => {
          const uid = otherUids[idx];
          if (!uid || !profile) return;
          next[uid] = {
            uid,
            name: profile.name || 'Kalarang User',
            avatar: profile.avatar,
          };
        });
        if (Object.keys(next).length > 0) {
          setChatContactsByUid((prev) => ({ ...prev, ...next }));
        }
      })
      .catch(() => {
        // ignore
      });
  }, [appUser?.uid, commissionChats, chatContactsByUid]);

  useEffect(() => {
    if (!appUser?.uid || appUser.role !== 'artist') return;
    try {
      const raw = localStorage.getItem(getArtistActionsKey(appUser.uid));
      if (!raw) return;
      const parsed = JSON.parse(raw) as ArtistCommissionActions;
      setArtistActions(parsed || {});
    } catch {
      // ignore malformed cache
    }
  }, [appUser?.uid, appUser?.role]);

  /** Shortlist-only artists need an applications/* stub so Firestore still allows reading the commission after it leaves open. */
  useEffect(() => {
    if (!appUser?.uid || appUser.role !== 'artist') return;
    const ids = Object.entries(artistActions)
      .filter(([, a]) => Boolean(a?.shortlisted) && !Boolean(a?.applied))
      .map(([id]) => id);
    if (ids.length === 0) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      (async () => {
        await Promise.all(ids.map((id) => setCommissionShortlistBookmark(id, appUser.uid).catch(() => {})));
        if (cancelled) return;
        const rows = await getCommissionDocumentsByIds(ids);
        if (cancelled || rows.length === 0) return;
        setShortlistOnlyCommissions((prev) => {
          const map = new Map(prev.map((c) => [c.id, c]));
          for (const r of rows) map.set(r.id, r);
          return Array.from(map.values());
        });
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [artistActions, appUser?.uid, appUser?.role]);

  useEffect(() => {
    if (mode !== 'list' || !appUser?.uid || hasRestoredListUiRef.current) return;
    hasRestoredListUiRef.current = true;
    try {
      const raw = sessionStorage.getItem(getListUiKey(appUser.uid));
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<CommissionListUiState>;
      if (saved.mainTab === 'commissions' || saved.mainTab === 'my-applications') {
        setActiveMainTab(saved.mainTab);
      }
      if (
        saved.artistSubTab === 'shortlisted' ||
        saved.artistSubTab === 'applied' ||
        saved.artistSubTab === 'inprogress' ||
        saved.artistSubTab === 'completed'
      ) {
        setActiveArtistSubTab(saved.artistSubTab);
      }
      if (
        saved.buyerSubTab === 'posted' ||
        saved.buyerSubTab === 'inprogress' ||
        saved.buyerSubTab === 'completed'
      ) {
        setActiveBuyerSubTab(saved.buyerSubTab);
      }
    } catch {
      // ignore malformed session data
    }
  }, [mode, appUser?.uid]);

  useEffect(() => {
    if (mode !== 'list' || !appUser?.uid) return;
    const payload: CommissionListUiState = {
      mainTab: activeMainTab,
      artistSubTab: activeArtistSubTab,
      buyerSubTab: activeBuyerSubTab,
    };
    sessionStorage.setItem(getListUiKey(appUser.uid), JSON.stringify(payload));
  }, [mode, appUser?.uid, activeMainTab, activeArtistSubTab, activeBuyerSubTab]);

  const confirmMarkCommissionCompleted = async () => {
    const item = completeConfirmItem;
    if (!item || !appUser?.uid || appUser.role !== 'buyer') return;
    setMarkingCompletedId(item.id);
    try {
      await markCommissionCompletedByBuyer(item.id, appUser.uid);
      invalidateCommissionsBrowseCache();
      invalidateCommissionsUserCaches(appUser.uid);
      if (item.hiredArtistId) {
        invalidateCommissionsUserCaches(item.hiredArtistId);
      }
      const completed: CommissionRequest = { ...item, status: 'completed' };
      if (completed.hiredArtistId) {
        try {
          await closeHiredArtistChatWhenCommissionCompleted(
            item.id,
            appUser.uid,
            completed.hiredArtistId,
          );
        } catch {
          toast.warn('Commission is completed, but the chat could not be closed. Try refreshing.');
        }
      }
      setBuyerRequests((prev) => prev.map((r) => (r.id === item.id ? completed : r)));
      setHiredArtistCommissions((prev) => prev.map((r) => (r.id === item.id ? completed : r)));
      setCommissionDocsFromChats((prev) => prev.map((r) => (r.id === item.id ? completed : r)));
      setArtistApplicationCommissions((prev) => prev.map((r) => (r.id === item.id ? completed : r)));
      if (completed.hiredArtistId) {
        createNotification(
          completed.hiredArtistId,
          'commission_completed',
          appUser.uid,
          appUser.name || 'Buyer',
          appUser.avatar,
          undefined, undefined, undefined, undefined,
          item.id,
          item.title,
        ).catch(() => {});
      }
      if (commissionChatOpen && commissionChatMetadata?.artworkId === item.id) {
        setCommissionChatClosed(true);
        setCommissionChatClosedReason('commission_completed');
        setCommissionStatusForChat('completed');
      }
      setActiveBuyerSubTab('completed');
      setCompleteConfirmItem(null);
    } catch {
      toast.error('Could not update commission. Please try again.');
    } finally {
      setMarkingCompletedId(null);
    }
  };

  const toggleArtistAction = async (commissionId: string, key: 'applied' | 'shortlisted') => {
    if (!appUser?.uid || appUser.role !== 'artist') return;
    if (key !== 'shortlisted') return;
    if (artistActionBusy) return;

    let snap = { wasShortlisted: false, applied: false };
    setArtistActions((prev) => {
      const wasShortlisted = Boolean(prev[commissionId]?.shortlisted);
      const next: ArtistCommissionActions = {
        ...prev,
        [commissionId]: {
          ...prev[commissionId],
          shortlisted: !wasShortlisted,
        },
      };
      snap = { wasShortlisted, applied: Boolean(next[commissionId]?.applied) };
      localStorage.setItem(getArtistActionsKey(appUser.uid), JSON.stringify(next));
      return next;
    });

    const nowShortlisted = !snap.wasShortlisted;

    setArtistActionBusy({ commissionId, kind: 'shortlist' });
    try {
      if (!snap.wasShortlisted && nowShortlisted) {
        await setCommissionShortlistBookmark(commissionId, appUser.uid);
        const rows = await getCommissionDocumentsByIds([commissionId]);
        if (rows[0]) {
          setShortlistOnlyCommissions((p) => {
            const map = new Map(p.map((c) => [c.id, c]));
            map.set(rows[0].id, rows[0]);
            return Array.from(map.values());
          });
        }
      } else if (snap.wasShortlisted && !nowShortlisted) {
        await removeCommissionShortlistBookmark(commissionId, appUser.uid);
        if (!snap.applied) {
          setShortlistOnlyCommissions((prev) => prev.filter((c) => c.id !== commissionId));
        }
      }
    } catch {
      toast.error('Could not update shortlist. Please try again.');
      setArtistActions((prev) => {
        const next: ArtistCommissionActions = {
          ...prev,
          [commissionId]: {
            ...prev[commissionId],
            shortlisted: snap.wasShortlisted,
          },
        };
        localStorage.setItem(getArtistActionsKey(appUser.uid), JSON.stringify(next));
        return next;
      });
    } finally {
      setArtistActionBusy(null);
    }
  };

  const getCommissionChats = (commissionId: string): CommissionChat[] => {
    if (!appUser?.uid) return [];
    return commissionChats.filter(
      (chat) =>
        chat.commissionId === commissionId &&
        chat.participants.includes(appUser.uid),
    );
  };

  const applicationsSubTabUnread = useMemo(() => {
    const emptyArtist: Record<ArtistSubTab, boolean> = {
      shortlisted: false,
      applied: false,
      inprogress: false,
      completed: false,
    };
    const emptyBuyer: Record<BuyerSubTab, boolean> = {
      posted: false,
      inprogress: false,
      completed: false,
    };
    if (!appUser?.uid) {
      return { artist: emptyArtist, buyer: emptyBuyer };
    }
    const uid = appUser.uid;

    if (appUser.role === 'artist') {
      const dots = { ...emptyArtist };
      for (const item of mergedArtistCommissions) {
        const tab = artistSubTabForItem(item, uid, artistActions);
        if (!tab) continue;
        if (commissionUnreadTotalForUser(commissionChats, item.id, uid) > 0) {
          dots[tab] = true;
        }
      }
      return { artist: dots, buyer: emptyBuyer };
    }
    if (appUser.role === 'buyer') {
      const dots = { ...emptyBuyer };
      for (const item of buyerRequests) {
        const tab = buyerSubTabForStatus(item.status);
        if (commissionUnreadTotalForUser(commissionChats, item.id, uid) > 0) {
          dots[tab] = true;
        }
      }
      // No dot on completed for buyer
      return { artist: emptyArtist, buyer: dots };
    }
    return { artist: emptyArtist, buyer: emptyBuyer };
  }, [appUser?.uid, appUser?.role, mergedArtistCommissions, buyerRequests, commissionChats, artistActions, reviewsMap]);

  const openCommissionChat = (
    chatId: string,
    contact: CommissionChatContact,
    metadata: CommissionChatMetadata,
    initialMessage = '',
    opts?: {
      commissionStatus?: string;
      chatClosed?: boolean;
      closedReason?: string;
      hiredArtistId?: string;
    },
  ) => {
    setCommissionChatId(chatId);
    setCommissionChatContact(contact);
    setCommissionChatMetadata(metadata);
    setCommissionChatInitialMessage(initialMessage);
    setCommissionChatOpen(true);
    if (opts?.commissionStatus) setCommissionStatusForChat(opts.commissionStatus);
    if (opts?.chatClosed) setCommissionChatClosed(opts.chatClosed);
    if (opts?.closedReason !== undefined) setCommissionChatClosedReason(opts.closedReason);
    if (opts?.hiredArtistId !== undefined) setCommissionHiredArtistIdForChat(opts.hiredArtistId);
    notifyServiceWorkerActiveChatId(chatId);
  };

  const handleCommissionFlowInfoClose = useCallback(() => {
    setShowCommissionFlowInfo(false);
    if (appUser?.uid) {
      const storageKey = `commission-flow-info-seen-${appUser.uid}`;
      localStorage.setItem(storageKey, 'true');
    }
  }, [appUser?.uid]);

  const handleApplyClick = async (item: CommissionRequest) => {
    if (!appUser?.uid || appUser.role !== 'artist') return;
    if (artistActionBusy) return;
    if (!isCommissionOpen(item.status)) {
      toast.info('This commission is no longer open.');
      return;
    }
    if (!item.buyerId) {
      toast.error('Buyer info is missing for this commission.');
      return;
    }
    if (item.buyerId === appUser.uid) {
      toast.info('You cannot apply to your own commission.');
      return;
    }

    // Check if artist has at least 4 works (published or in gallery)
    try {
      const { getArtistArtworks } = await import('../../services/artworkService');
      const allWorks = await getArtistArtworks(appUser.uid, false);
      if (allWorks.length < 4) {
        setShowPortfolioRequiredModal(true);
        return;
      }
    } catch {
      // If check fails, allow proceeding
    }

    // Check if artist has UPI ID configured
    if (!appUser.upiId || appUser.upiId.trim() === '') {
      setShowPortfolioRequiredModal(true);
      return;
    }

    setArtistActionBusy({ commissionId: item.id, kind: 'apply' });
    try {
      await registerArtistApplication(item.id, appUser.uid);
      invalidateCommissionsBrowseCache();
      invalidateCommissionsUserCaches(appUser.uid);
      createNotification(
        item.buyerId,
        'commission_application',
        appUser.uid,
        appUser.name || 'An artist',
        appUser.avatar,
        undefined, undefined, undefined, undefined,
        item.id,
        item.title,
      ).catch(() => {});
    } catch {
      toast.error('Could not apply. This commission may no longer be open.');
      setArtistActionBusy(null);
      return;
    }
    try {
      const chatId = await createOrGetCommissionChat(
        item.id,
        appUser.uid,
        item.buyerId,
        item.title,
        item.referenceImages?.[0] || '',
      );

      setArtistActions((prev) => {
        const next: ArtistCommissionActions = {
          ...prev,
          [item.id]: {
            ...prev[item.id],
            applied: true,
          },
        };
        localStorage.setItem(getArtistActionsKey(appUser.uid), JSON.stringify(next));
        return next;
      });
      setShortlistOnlyCommissions((prev) => prev.filter((c) => c.id !== item.id));

      openCommissionChat(
        chatId,
        {
          uid: item.buyerId,
          name: item.buyerName || 'Buyer',
          avatar: item.buyerAvatar,
        },
        {
          artworkId: item.id,
          artworkTitle: item.title,
          artworkImage: item.referenceImages?.[0],
          agreedFinalPrice: item.agreedFinalPrice,
          agreedAdvanceAmount: item.agreedAdvanceAmount,
          agreedDeliveryDate: item.agreedDeliveryDate,
          hiredArtistId: item.hiredArtistId,
          readyToShipImageUrl: item.readyToShipImageUrl,
          fullPaymentDone: item.fullPaymentDone,
        },
        `Hi ${item.buyerName || 'there'}, I would like to apply for your commission "${item.title}".`,
        {
          commissionStatus: item.status,
          chatClosed: false,
          hiredArtistId: item.hiredArtistId,
        },
      );
    } catch {
      toast.error('Failed to open chat. Please try again.');
    } finally {
      setArtistActionBusy(null);
    }
  };

  const handleOpenExistingCommissionChat = (item: CommissionRequest, chat: CommissionChat) => {
    if (!appUser?.uid) return;
    const otherUid = chat.participants.find((uid) => uid !== appUser.uid);
    if (!otherUid) return;
    const fallbackName = otherUid === item.buyerId ? item.buyerName : 'Kalarang User';
    const fallbackAvatar = otherUid === item.buyerId ? item.buyerAvatar : undefined;
    openCommissionChat(
      chat.id,
      chatContactsByUid[otherUid] || {
        uid: otherUid,
        name: fallbackName || 'Kalarang User',
        avatar: fallbackAvatar,
      },
      {
        artworkId: item.id,
        artworkTitle: item.title,
        artworkImage: item.referenceImages?.[0],
        agreedFinalPrice: item.agreedFinalPrice,
        agreedAdvanceAmount: item.agreedAdvanceAmount,
        agreedDeliveryDate: item.agreedDeliveryDate,
        hiredArtistId: item.hiredArtistId,
      },
      '',
      {
        commissionStatus: item.status,
        chatClosed: Boolean(chat.closed),
        closedReason: chat.closedReason,
        hiredArtistId: item.hiredArtistId,
      },
    );
  };

  const getStatusKey = (status?: string): 'posted' | 'inprogress' | 'completed' => {
    const n = String(status || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
    if (n === 'inprogress') return 'inprogress';
    if (n === 'completed') return 'completed';
    return 'posted';
  };

  const runApplicationsEmptyCta = useCallback((fn: () => void) => {
    setApplicationsEmptyCtaLoading(true);
    try {
      fn();
    } finally {
      window.setTimeout(() => setApplicationsEmptyCtaLoading(false), 450);
    }
  }, []);

  const getApplicationsEmptyConfig = (): {
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
  } => {
    if (appUser?.role === 'artist') {
      switch (activeArtistSubTab) {
        case 'shortlisted':
          return {
            title: 'No shortlisted commissions',
            description:
              'Shortlist requests from the Commissions tab to compare options and apply when you are ready.',
            actionLabel: 'Browse commissions',
            onAction: () => runApplicationsEmptyCta(() => setActiveMainTab('commissions')),
          };
        case 'applied':
          return {
            title: 'No applications yet',
            description: 'Apply to open requests from the commissions list. Submitted applications appear here.',
            actionLabel: 'Browse commissions',
            onAction: () => runApplicationsEmptyCta(() => setActiveMainTab('commissions')),
          };
        case 'inprogress':
          return {
            title: 'No work in progress',
            description: 'When a buyer hires you, active commissions show up here until they are completed.',
            actionLabel: 'Browse commissions',
            onAction: () => runApplicationsEmptyCta(() => setActiveMainTab('commissions')),
          };
        case 'completed':
          return {
            title: 'No completed commissions',
            description: 'Finished work you were hired for will be listed here.',
            actionLabel: 'Browse commissions',
            onAction: () => runApplicationsEmptyCta(() => setActiveMainTab('commissions')),
          };
        default:
          return { title: 'Nothing here', description: 'No items in this category.' };
      }
    }
    if (appUser?.role === 'buyer') {
      switch (activeBuyerSubTab) {
        case 'posted':
          return {
            title: 'No commission requests posted',
            description: 'Describe what you need so artists can apply and you can hire the right match.',
            actionLabel: 'Post a commission',
            onAction: () => runApplicationsEmptyCta(() => navigate('/post')),
          };
        case 'inprogress':
          return {
            title: 'Nothing in progress',
            description: 'After you hire an artist, ongoing work appears here until you mark it complete.',
            actionLabel: 'Post a commission',
            onAction: () => runApplicationsEmptyCta(() => navigate('/post')),
          };
        case 'completed':
          return {
            title: 'No completed commissions',
            description: 'Commissions you mark as completed will show up here.',
            actionLabel: 'Post a commission',
            onAction: () => runApplicationsEmptyCta(() => navigate('/post')),
          };
        default:
          return { title: 'Nothing here', description: 'No items in this category.' };
      }
    }
    return { title: 'Nothing here', description: 'No items in this category.' };
  };

  const listRequests = useMemo((): CommissionRequest[] => {
    let rows: CommissionRequest[];
    if (activeMainTab === 'commissions') {
      if (debouncedCommissionSearch.trim()) {
        rows = commissionSearchResults;
      } else {
        rows = commissionsBrowsePool;
      }
    } else if (appUser?.role === 'artist') {
      rows = mergedArtistCommissions.filter((item) => {
        const action = artistActions[item.id] || {};
        const itemStatus = String(item.status || '')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '');
        const hiredYou =
          item.hiredArtistId === appUser.uid &&
          (itemStatus === 'inprogress' || itemStatus === 'completed');
        if (activeArtistSubTab === 'shortlisted')
          return (
            Boolean(action.shortlisted) &&
            !Boolean(action.applied) &&
            !hiredYou
          );
        if (activeArtistSubTab === 'applied')
          return Boolean(action.applied) && !hiredYou;
        if (activeArtistSubTab === 'inprogress')
          return itemStatus === 'inprogress' && item.hiredArtistId === appUser.uid;
        if (activeArtistSubTab === 'completed')
          return itemStatus === 'completed' && item.hiredArtistId === appUser.uid;
        return false;
      });
    } else {
      rows = buyerRequests.filter((item) => getStatusKey(item.status) === activeBuyerSubTab);
    }
    return sortCommissionsNewestFirst(rows);
  }, [
    activeMainTab, debouncedCommissionSearch, commissionSearchResults,
    commissionsBrowsePool, appUser?.role, appUser?.uid, mergedArtistCommissions,
    artistActions, activeArtistSubTab, buyerRequests, activeBuyerSubTab,
  ]);

  const shouldVirtualizeCommissions = listRequests.length > VIRTUALIZE_THRESHOLD;

  const commGridColumnCount = useMemo(
    () => getCommissionGridColumnCount(commGridWidth || window.innerWidth),
    [commGridWidth],
  );

  const commRowCount = useMemo(
    () => Math.ceil(listRequests.length / commGridColumnCount),
    [listRequests.length, commGridColumnCount],
  );

  const commRelativeScrollTop = Math.max(0, commGridScrollTop - commGridOffsetTop);
  const commVisibleStartRow = Math.max(
    0,
    Math.floor(commRelativeScrollTop / COMMISSION_CARD_HEIGHT_ESTIMATE) - 2,
  );
  const commVisibleEndRow = Math.min(
    Math.max(0, commRowCount - 1),
    Math.ceil(
      (commRelativeScrollTop + (commGridViewportHeight || 900)) / COMMISSION_CARD_HEIGHT_ESTIMATE,
    ) + 2,
  );
  const commStartIndex = commVisibleStartRow * commGridColumnCount;
  const commEndIndex = Math.min(
    listRequests.length,
    (commVisibleEndRow + 1) * commGridColumnCount,
  );

  const virtualizedCommissions = shouldVirtualizeCommissions
    ? listRequests.slice(commStartIndex, commEndIndex)
    : listRequests;
  const commTopSpacerHeight = shouldVirtualizeCommissions
    ? commVisibleStartRow * COMMISSION_CARD_HEIGHT_ESTIMATE
    : 0;
  const commRenderedRows = Math.ceil(virtualizedCommissions.length / commGridColumnCount);
  const commTotalGridHeight = commRowCount * COMMISSION_CARD_HEIGHT_ESTIMATE;
  const commBottomSpacerHeight = shouldVirtualizeCommissions
    ? Math.max(0, commTotalGridHeight - commTopSpacerHeight - commRenderedRows * COMMISSION_CARD_HEIGHT_ESTIMATE)
    : 0;

  const updateCommGridMetrics = useCallback(() => {
    const scrollContainer = containerRef.current;
    const shell = commissionGridShellRef.current;
    if (!scrollContainer || !shell) return;
    setCommGridScrollTop(scrollContainer.scrollTop);
    setCommGridViewportHeight(scrollContainer.clientHeight);
    const containerRect = scrollContainer.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    const offsetTop = shellRect.top - containerRect.top + scrollContainer.scrollTop;
    setCommGridOffsetTop(offsetTop);
  }, []);

  useEffect(() => {
    if (!shouldVirtualizeCommissions) return;
    const shell = commissionGridShellRef.current;
    if (!shell || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setCommGridWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, [shouldVirtualizeCommissions, listRequests.length]);

  useEffect(() => {
    if (!shouldVirtualizeCommissions) return;
    let rafId = 0;
    const scrollContainer = containerRef.current;
    if (!scrollContainer) return;
    const scheduleMeasure = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateCommGridMetrics();
      });
    };
    scheduleMeasure();
    scrollContainer.addEventListener('scroll', scheduleMeasure, { passive: true });
    window.addEventListener('resize', scheduleMeasure);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      scrollContainer.removeEventListener('scroll', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [shouldVirtualizeCommissions, updateCommGridMetrics, listRequests.length]);

  const validationErrors = {
    title: !title.trim() ? 'Title is required' : '',
    description: !description.trim() ? 'Description is required' : '',
    budget: !budget ? 'Budget is required' : '',
    customBudget: budget === 'Custom' && !customBudget.trim() ? 'Custom budget amount is required' : '',
    deadline: !deadline ? 'Deadline is required' : '',
    customDate: deadline === 'Custom' && !customDate ? 'Custom deadline date is required' : '',
    customHeight: size === 'Custom' && !customHeight.trim() ? 'Height is required' : '',
    customWidth: size === 'Custom' && !customWidth.trim() ? 'Width is required' : '',
    type: !type ? 'Artwork type is required' : '',
    cityOrPincode: !cityOrPincode.trim() ? 'City or pincode is required' : '',
  };

  const isFormValid =
    !validationErrors.title &&
    !validationErrors.description &&
    !validationErrors.budget &&
    !validationErrors.customBudget &&
    !validationErrors.deadline &&
    !validationErrors.customDate &&
    !validationErrors.customHeight &&
    !validationErrors.customWidth &&
    !validationErrors.type &&
    !validationErrors.cityOrPincode;

  const toggleMulti = (current: string[], setValue: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    setValue(current.includes(item) ? current.filter((v) => v !== item) : [...current, item]);
  };

  const handleDropzoneSelect = (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/')).slice(0, maxImages);
    setImages(imageFiles);
    setIsDragActive(false);
  };

  const removeImage = (name: string) => {
    setImages((prev) => prev.filter((file) => file.name !== name));
  };

  const handleClearForm = () => {
    setTitle('');
    setDescription('');
    setImages([]);
    setBudget('');
    setCustomBudget('');
    setDeadline('');
    setCustomDate('');
    setSize('');
    setCustomHeight('');
    setCustomWidth('');
    setType('');
    setStyle([]);
    setSubject([]);
    setDeliveryType('');
    setCityOrPincode('');
    setShowStyleInput(false);
    setShowSubjectInput(false);
    setNewStyle('');
    setNewSubject('');
    setStyleOptions(DEFAULT_STYLE_OPTIONS);
    setSubjectOptions(DEFAULT_SUBJECT_OPTIONS);
    setShowErrors(false);
    if (appUser?.uid) {
      localStorage.removeItem(getDraftKey(appUser.uid));
    }
  };

  const hasDraftableContent = Boolean(
    title.trim() ||
      description.trim() ||
      budget ||
      customBudget.trim() ||
      deadline ||
      customDate ||
      size ||
      customHeight.trim() ||
      customWidth.trim() ||
      type ||
      style.length ||
      subject.length ||
      cityOrPincode.trim(),
  );

  const saveDraft = (showToast = false) => {
    if (!appUser?.uid || mode !== 'form') return;
    if (!hasDraftableContent) {
      localStorage.removeItem(getDraftKey(appUser.uid));
      return;
    }
    const draft: CommissionDraftData = {
      title,
      description,
      budget,
      customBudget,
      deadline,
      customDate,
      size,
      customHeight,
      customWidth,
      type,
      style,
      subject,
      deliveryType,
      cityOrPincode,
      styleOptions,
      subjectOptions,
    };
    localStorage.setItem(getDraftKey(appUser.uid), JSON.stringify(draft));
    if (showToast) {
      toast.success('Draft saved.');
    }
  };

  // Prompt before browser refresh/close if there are unsaved changes.
  useEffect(() => {
    if (mode !== 'form') return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasDraftableContent || isSubmitting) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [mode, hasDraftableContent, isSubmitting]);

  // Intercept browser back/forward navigation.
  useEffect(() => {
    if (mode !== 'form' || !hasDraftableContent || isSubmitting) return;
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false;
        return;
      }
      window.history.pushState(null, '', window.location.href);
      setShowDraftModal(true);
      setPendingNavigation(() => () => {
        allowNavigationRef.current = true;
        window.history.back();
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [mode, hasDraftableContent, isSubmitting]);

  // Intercept internal link clicks.
  useEffect(() => {
    if (mode !== 'form' || !hasDraftableContent || isSubmitting) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      e.preventDefault();
      e.stopPropagation();
      setShowDraftModal(true);
      setPendingNavigation(() => () => navigate(href));
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [mode, hasDraftableContent, isSubmitting, navigate]);

  const addCustomChip = (
    value: string,
    setValue: React.Dispatch<React.SetStateAction<string>>,
    setOptions: React.Dispatch<React.SetStateAction<string[]>>,
    setSelected: React.Dispatch<React.SetStateAction<string[]>>,
    closeInput: () => void,
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setSelected((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setValue('');
    closeInput();
  };

  const formatDisplayDate = (value: unknown): string => {
    if (!value) return 'Recently';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null && 'toDate' in value) {
      try {
        const date = (value as { toDate: () => Date }).toDate();
        return date.toLocaleDateString();
      } catch {
        return 'Recently';
      }
    }
    return 'Recently';
  };

  const formatChatUpdatedAt = (value: unknown): string => {
    if (!value || typeof value !== 'object' || !('toDate' in value)) return '';
    try {
      const date = (value as { toDate: () => Date }).toDate();
      const now = new Date();
      const isToday =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString('en-GB');
    } catch {
      return '';
    }
  };

  const handlePostCommission = async () => {
    if (!appUser?.uid) {
      toast.error('Please login to post a commission request.');
      return;
    }
    if (!isFormValid) {
      setShowErrors(true);
      return;
    }

    const finalBudget = budget === 'Custom' ? customBudget.trim() : budget;
    const finalDeadline = deadline === 'Custom' ? customDate : deadline;
    const finalSize = size === 'Custom' ? 'Custom' : size;
    const finalCustomHeight = size === 'Custom' ? customHeight.trim() : '';
    const finalCustomWidth = size === 'Custom' ? customWidth.trim() : '';
    const finalDeliveryType = deliveryType as '' | 'Digital file' | 'Physical artwork';
    const finalDeliveryLocation = cityOrPincode.trim();

    setIsSubmitting(true);
    try {
      await createCommissionRequest(
        appUser.uid,
        appUser.name,
        appUser.avatar,
        {
          title: title.trim(),
          description: description.trim(),
          budget: finalBudget || '',
          deadline: finalDeadline || '',
          size: finalSize || '',
          customHeight: finalCustomHeight,
          customWidth: finalCustomWidth,
          type: type || '',
          style,
          subject,
          deliveryType: finalDeliveryType,
          cityOrPincode: finalDeliveryLocation,
        },
        images,
      );

      toast.success('Commission request posted.');
      localStorage.removeItem(getDraftKey(appUser.uid));
      handleClearForm();
      window.dispatchEvent(new CustomEvent(COMMISSION_LISTS_UPDATED_EVENT));
      if (mode === 'form') {
        navigate('/commissions');
      }
    } catch {
      toast.error('Failed to post commission request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraftAndLeave = () => {
    saveDraft(true);
    setShowDraftModal(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const handleDiscardAndLeave = () => {
    if (appUser?.uid) {
      localStorage.removeItem(getDraftKey(appUser.uid));
    }
    setShowDraftModal(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const handleCancelNavigation = () => {
    setShowDraftModal(false);
    setPendingNavigation(null);
  };

  return (
    <div className="commission-page">
      {isSubmitting && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(11, 31, 42, 0.98)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div style={{ width: '280px', maxWidth: '90%', marginBottom: '2rem' }}>
            <Lottie
              animationData={artPostLoaderAnimation}
              loop
              lottieRef={commissionPostLottieRef}
              style={{ width: '100%', height: 'auto' }}
            />
          </div>
          <p
            style={{
              color: 'var(--color-accent)',
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '0.5rem',
              textAlign: 'center',
            }}
          >
            Posting Commission Request...
          </p>
          <p
            style={{
              color: 'var(--color-primary)',
              fontSize: '1.2rem',
              fontWeight: 600,
              margin: 0,
              textAlign: 'center',
            }}
          >
            Please wait while we save your request.
          </p>
        </div>
      )}
      <div className={`commission-layout ${isDesktop ? 'desktop' : ''} ${mode === 'list' ? 'list-mode' : ''}`}>
        <div className="commission-form-card">
          {mode === 'form' && <p className="commission-subtitle-inline">Post your comission request.</p>}

          {mode === 'form' && (
          <section className="section">
            <h3 className="section-title">Basic Details</h3>
            <label className="form-label">
              Title <span className="commission-required">*</span>
            </label>
            <input
              className="form-input"
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              placeholder="Ex: Realistic portrait"
            />
            {showErrors && validationErrors.title && (
              <span className="commission-field-error">{validationErrors.title}</span>
            )}

            <label className="form-label">
              Description <span className="commission-required">*</span>
            </label>
            <textarea
              className="form-input form-textarea"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="Describe what you want, style, subject, colors, medium..."
            />
            {showErrors && validationErrors.description && (
              <span className="commission-field-error">{validationErrors.description}</span>
            )}

            <label className="form-label">Size</label>
            <CustomDropdown
              value={size}
              onChange={(value) => setSize(value as SizeOption)}
              options={sizeOptions.map((option) => ({ value: option, label: option }))}
              placeholder="Select size"
            />

            {size === 'Custom' && (
              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label">
                    Height (inches) <span className="commission-required">*</span>
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    value={customHeight}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomHeight(e.target.value)}
                    placeholder="Enter height (inches)"
                  />
                  {showErrors && validationErrors.customHeight && (
                    <span className="commission-field-error">{validationErrors.customHeight}</span>
                  )}
                </div>
                <div className="form-field">
                  <label className="form-label">
                    Width (inches) <span className="commission-required">*</span>
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    value={customWidth}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomWidth(e.target.value)}
                    placeholder="Enter width (inches)"
                  />
                  {showErrors && validationErrors.customWidth && (
                    <span className="commission-field-error">{validationErrors.customWidth}</span>
                  )}
                </div>
              </div>
            )}

            <label className="form-label">Reference Images</label>
            <div className="upload-section commission-upload-section">
              <div className="commission-dropzone-wrap">
                <UploadDropzone
                  onFileSelect={handleDropzoneSelect}
                  isDragActive={isDragActive}
                  onDragEnter={() => setIsDragActive(true)}
                  onDragLeave={() => setIsDragActive(false)}
                  onDrop={handleDropzoneSelect}
                />
              </div>

              <div>
                <h4 className="commission-upload-preview-title">Preview ({imagePreviews.length}/{maxImages})</h4>
                <p className="commission-upload-preview-subtext">Drag and drop or click upload to update references</p>
                <div className="commission-preview-grid">
                  {imagePreviews.map((img) => (
                    <div key={img.name} className="commission-preview-item">
                      <img src={img.url} alt={img.name} className="commission-preview-image" />
                      <button type="button" className="commission-remove-btn" onClick={() => removeImage(img.name)}>
                        x
                      </button>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, maxImages - imagePreviews.length) }).map((_, index) => (
                    <div key={`empty-${index}`} className="commission-preview-item commission-preview-empty">
                      +
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </section>
          )}

          {mode === 'form' && (
          <section className="section">
            <h3 className="section-title">Budget & Timeline</h3>
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label">
                  Budget <span className="commission-required">*</span>
                </label>
                <CustomDropdown
                  value={budget}
                  onChange={(value) => setBudget(value as BudgetOption)}
                  options={budgetOptions.map((option) => ({ value: option, label: option }))}
                  placeholder="Select budget range"
                  required
                />
                {showErrors && validationErrors.budget && (
                  <span className="commission-field-error">{validationErrors.budget}</span>
                )}
              </div>
              <div className="form-field">
                <label className="form-label">
                  Deadline <span className="commission-required">*</span>
                </label>
                <CustomDropdown
                  value={deadline}
                  onChange={(value) => setDeadline(value as DeadlineOption)}
                  options={deadlineOptions.map((option) => ({ value: option, label: option }))}
                  placeholder="Select timeline"
                  required
                />
                {showErrors && validationErrors.deadline && (
                  <span className="commission-field-error">{validationErrors.deadline}</span>
                )}
              </div>
            </div>

            {budget === 'Custom' && (
              <>
                <label className="form-label">
                  Custom Budget <span className="commission-required">*</span>
                </label>
                <input
                  className="form-input"
                  value={customBudget}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomBudget(e.target.value)}
                  placeholder="Enter your budget (e.g. ₹7,500)"
                />
                {showErrors && validationErrors.customBudget && (
                  <span className="commission-field-error">{validationErrors.customBudget}</span>
                )}
              </>
            )}

            {deadline === 'Custom' && (
              <>
                <label className="form-label">
                  Custom Deadline <span className="commission-required">*</span>
                </label>
                <input
                  className="form-input"
                  type="date"
                  value={customDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomDate(e.target.value)}
                />
                {showErrors && validationErrors.customDate && (
                  <span className="commission-field-error">{validationErrors.customDate}</span>
                )}
              </>
            )}

          </section>
          )}

          {mode === 'form' && (
          <section className="section">
            <h3 className="section-title">Artwork Preferences</h3>
            <label className="form-label">
              Type <span className="commission-required">*</span>
            </label>
            <div className="commission-chip-wrap">
              {TYPE_OPTIONS.map((item) => {
                const isActive = type === item;
                return (
                  <button
                    key={item}
                    type="button"
                    className={`commission-chip ${isActive ? 'active' : ''}`}
                    onClick={() => setType(item)}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            {showErrors && validationErrors.type && (
              <span className="commission-field-error">{validationErrors.type}</span>
            )}

            <label className="form-label">Style (Optional)</label>
            <ChipSelector options={styleOptions} selected={style} onToggle={(item) => toggleMulti(style, setStyle, item)} />
            <div className="commission-inline-row">
              <button type="button" className="commission-custom-chip" onClick={() => setShowStyleInput((prev) => !prev)}>
                + Custom
              </button>
              {showStyleInput && (
                <>
                  <input
                    className="form-input commission-small-input"
                    value={newStyle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStyle(e.target.value)}
                    placeholder="Add style"
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomChip(newStyle, setNewStyle, setStyleOptions, setStyle, () => setShowStyleInput(false));
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="commission-secondary-btn"
                    onClick={() => addCustomChip(newStyle, setNewStyle, setStyleOptions, setStyle, () => setShowStyleInput(false))}
                  >
                    Add
                  </button>
                </>
              )}
            </div>

            <label className="form-label">Subject (Optional)</label>
            <ChipSelector options={subjectOptions} selected={subject} onToggle={(item) => toggleMulti(subject, setSubject, item)} />
            <div className="commission-inline-row">
              <button type="button" className="commission-custom-chip" onClick={() => setShowSubjectInput((prev) => !prev)}>
                + Custom
              </button>
              {showSubjectInput && (
                <>
                  <input
                    className="form-input commission-small-input"
                    value={newSubject}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSubject(e.target.value)}
                    placeholder="Add subject"
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomChip(newSubject, setNewSubject, setSubjectOptions, setSubject, () => setShowSubjectInput(false));
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="commission-secondary-btn"
                    onClick={() => addCustomChip(newSubject, setNewSubject, setSubjectOptions, setSubject, () => setShowSubjectInput(false))}
                  >
                    Add
                  </button>
                </>
              )}
            </div>
          </section>
          )}

          {mode === 'form' && (
          <section className="section">
            <h3 className="section-title">Delivery</h3>
            <label className="form-label">
              City / Pincode <span className="commission-required">*</span>
            </label>
            <input
              className="form-input"
              value={cityOrPincode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCityOrPincode(e.target.value)}
              placeholder="Enter city or pincode"
              required
            />
            {showErrors && validationErrors.cityOrPincode && (
              <span className="commission-field-error">{validationErrors.cityOrPincode}</span>
            )}
          </section>
          )}

          {mode === 'form' && (
          <div className="button-group">
            <button type="button" className="button button-outline-green" onClick={handleClearForm}>
              Clear
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={isSubmitting}
              onClick={handlePostCommission}
            >
              <span className="commission-button-primary-inner">
                {isSubmitting && <span className="commission-inline-spinner" aria-hidden />}
                {isSubmitting ? 'Posting...' : 'Post Commission'}
              </span>
            </button>
          </div>
          )}

          {mode === 'list' && (
            <div style={{ position: 'relative' }}>
              <PullToRefreshIndicator
                pullDistance={pullToRefreshState.pullDistance}
                isTriggered={pullToRefreshState.isTriggered}
                isRefreshing={pullToRefreshState.isRefreshing}
                isResetting={pullToRefreshState.isResetting}
                threshold={80}
              />
              <div ref={tabsAnchorRef} className={`commission-main-tabs-fixed${tabsHidden ? ' pill-tabs-hidden' : ''}`}>
                <div className="commission-main-tabs">
                  <button
                    type="button"
                    className={`commission-tab ${activeMainTab === 'commissions' ? 'active' : ''}`}
                    onClick={() => setActiveMainTab('commissions')}
                  >
                    Commissions
                  </button>
                  <button
                    type="button"
                    className={`commission-tab ${activeMainTab === 'my-applications' ? 'active' : ''}`}
                    onClick={() => setActiveMainTab('my-applications')}
                  >
                    Applications
                  </button>
                </div>
                <button
                  type="button"
                  className="commission-info-icon-btn"
                  onClick={() => setShowCommissionFlowInfo(true)}
                  aria-label="Commission flow information"
                  title="How commissions work"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </button>
              </div>
              <div className="commission-main-tabs-spacer" />

              {activeMainTab === 'commissions' && appUser?.role === 'buyer' && (
                <div className="commission-search-container commission-create-request-container">
                  <button
                    type="button"
                    className="commission-create-request-btn"
                    onClick={() => navigate('/post')}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Create your commission request
                  </button>
                </div>
              )}

              {activeMainTab === 'commissions' && appUser?.role !== 'buyer' && (
                <div className="commission-search-container">
                  <div className="commission-search-bar">
                    <div className="commission-search-field">
                      <svg
                        className="commission-search-icon"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                      <input
                        type="text"
                        className="commission-search-input"
                        autoComplete="off"
                        placeholder="Search commissions (styles, title, subject, tags…)"
                        value={commissionSearchQuery}
                        onChange={(e) => setCommissionSearchQuery(e.target.value)}
                        aria-label="Search commissions"
                      />
                      {commissionSearchQuery.trim().length > 0 && (
                        <button
                          type="button"
                          className="commission-search-clear-btn"
                          onClick={() => setCommissionSearchQuery('')}
                          aria-label="Clear search"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Child sub-tabs — normal flow, scrolls with content */}
              {activeMainTab === 'my-applications' && appUser?.role === 'artist' && (
                <div className="commission-sub-tabs">
                  {(['shortlisted', 'applied', 'inprogress', 'completed'] as ArtistSubTab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`commission-sub-tab ${activeArtistSubTab === tab ? 'active' : ''}`}
                      onClick={() => setActiveArtistSubTab(tab)}
                    >
                      <span className="commission-sub-tab-inner">
                        <span className="commission-sub-tab-label">
                          {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </span>
                        {applicationsSubTabUnread.artist[tab] && (
                          <span className="commission-sub-tab-unread-dot" aria-label="Unread messages" />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {activeMainTab === 'my-applications' && appUser?.role === 'buyer' && (
                <div className="commission-sub-tabs">
                  {(['posted', 'inprogress', 'completed'] as BuyerSubTab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`commission-sub-tab ${activeBuyerSubTab === tab ? 'active' : ''}`}
                      onClick={() => setActiveBuyerSubTab(tab)}
                    >
                      <span className="commission-sub-tab-inner">
                        <span className="commission-sub-tab-label">
                          {tab === 'inprogress' ? 'In progress' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </span>
                        {applicationsSubTabUnread.buyer[tab] && (
                          <span className="commission-sub-tab-unread-dot" aria-label="Unread messages" />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {isLoadingRequests ? (
                <div className="commission-search-loading">
                  <LoadingState
                    animation={africanAmericanArtAnimation}
                    message="Loading commissions…"
                  />
                </div>
              ) : activeMainTab === 'commissions' && debouncedCommissionSearch.trim() && isCommissionSearchLoading ? (
                <div className="commission-search-loading">
                  <LoadingState
                    animation={africanAmericanArtAnimation}
                    message="Searching commissions…"
                  />
                </div>
              ) : listRequests.length === 0 ? (
                activeMainTab === 'my-applications' && appUser?.role ? (
                  <div className="commission-applications-empty">
                    <EmptyState
                      animation={noContentAnimation}
                      actionLoading={applicationsEmptyCtaLoading}
                      {...getApplicationsEmptyConfig()}
                    />
                  </div>
                ) : activeMainTab === 'commissions' && debouncedCommissionSearch.trim() ? (
                  <div className="commission-applications-empty">
                    <EmptyState
                      animation={noContentAnimation}
                      title="No results found"
                      description="Try searching with other keywords."
                    />
                  </div>
                ) : (
                  <p className="commission-empty-state">
                    {activeMainTab === 'commissions' ? 'No commissions yet.' : 'No items in this category.'}
                  </p>
                )
              ) : (
                <>
                <div ref={commissionGridShellRef}>
                  {shouldVirtualizeCommissions && commTopSpacerHeight > 0 && (
                    <div style={{ height: `${commTopSpacerHeight}px` }} />
                  )}
                  <div className="commission-posted-grid">
                    {virtualizedCommissions.map((item) => {
                      const rowArtistBusy = artistActionBusy?.commissionId === item.id;
                      const applyBusy = rowArtistBusy && artistActionBusy?.kind === 'apply';
                      const shortlistBusy = rowArtistBusy && artistActionBusy?.kind === 'shortlist';
                      return (
                      <article key={item.id} className="commission-posted-card">
                        {appUser?.role === 'artist' &&
                          activeMainTab === 'my-applications' &&
                          activeArtistSubTab === 'shortlisted' && (
                            <button
                              type="button"
                              className="commission-shortlist-dismiss"
                              aria-label="Remove from shortlist"
                              disabled={rowArtistBusy}
                              onClick={() => void toggleArtistAction(item.id, 'shortlisted')}
                            >
                              {shortlistBusy ? <span className="commission-inline-spinner commission-inline-spinner--outline" aria-hidden /> : '×'}
                            </button>
                          )}
                        <div className="commission-posted-main">
                          <div className="commission-posted-content">
                            <div className="commission-posted-header">
                              <h4>{item.title}</h4>
                              <span
                                className={`commission-posted-status commission-status-${commissionStatusBadgeClassSuffix(
                                  item.status,
                                )}`}
                              >
                                {formatCommissionStatus(item.status)}
                              </span>
                            </div>
                            <p className="commission-posted-text">{item.description}</p>
                            <div className="commission-posted-meta">
                              <span>
                                <span className="commission-posted-by">By: {item.buyerName || 'Unknown buyer'}</span>,{' '}
                                <span>{formatDisplayDate(item.createdAt)}</span>
                              </span>
                              <span>Budget: {item.budget}</span>
                              <span>Deadline: {item.deadline}</span>
                              <span>
                                Size:{' '}
                                {item.size === 'Custom'
                                  ? item.customHeight || item.customWidth
                                    ? `${item.customHeight || '?'} x ${item.customWidth || '?'} inches`
                                    : 'Custom'
                                  : item.size || 'Not specified'}
                              </span>
                              {item.cityOrPincode?.trim() && (
                                <span>Delivery: {item.cityOrPincode}</span>
                              )}
                              {activeMainTab === 'my-applications' && isCommissionInProgress(item.status) && (
                                <button
                                  type="button"
                                  className="commission-view-address-btn"
                                  onClick={() => setAddressTooltipId(addressTooltipId === item.id ? null : item.id)}
                                >
                                  {addressTooltipId === item.id ? 'Hide address' : 'View address'}
                                </button>
                              )}
                            </div>
                            {activeMainTab === 'my-applications' && addressTooltipId === item.id && (
                              <div className="commission-address-inline">
                                {item.buyerAddress || 'No delivery address provided.'}
                              </div>
                            )}
                        {appUser?.role === 'artist' &&
                          (activeMainTab === 'commissions' ||
                            (activeMainTab === 'my-applications' && activeArtistSubTab === 'shortlisted')) && (
                            <div className="commission-artist-actions">
                              {isCommissionOpen(item.status) ? (
                                artistActions[item.id]?.applied ? (
                                  <button
                                    type="button"
                                    className="button button-outline-green commission-action-active"
                                    aria-disabled="true"
                                  >
                                    Applied ✓
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="button button-outline-green"
                                      disabled={rowArtistBusy}
                                      onClick={() => void handleApplyClick(item)}
                                    >
                                      {applyBusy ? (
                                        <span className="commission-button-primary-inner">
                                          <span className="commission-inline-spinner commission-inline-spinner--outline" aria-hidden />
                                          Apply
                                        </span>
                                      ) : (
                                        'Apply'
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      className={`button button-outline-green ${
                                        artistActions[item.id]?.shortlisted ? 'commission-action-active' : ''
                                      }`}
                                      disabled={rowArtistBusy}
                                      onClick={() => void toggleArtistAction(item.id, 'shortlisted')}
                                    >
                                      {shortlistBusy ? (
                                        <span className="commission-button-primary-inner">
                                          <span className="commission-inline-spinner commission-inline-spinner--outline" aria-hidden />
                                          {artistActions[item.id]?.shortlisted ? 'Shortlisted' : 'Shortlist'}
                                        </span>
                                      ) : artistActions[item.id]?.shortlisted ? (
                                        'Shortlisted'
                                      ) : (
                                        'Shortlist'
                                      )}
                                    </button>
                                  </>
                                )
                              ) : (
                                <p className="commission-artist-assigned-notice" role="status">
                                  Artist was assigned
                                </p>
                              )}
                            </div>
                          )}
                          </div>

                          <div className="commission-posted-thumb-wrap">
                            {item.referenceImages?.[0] ? (
                              <img
                                src={item.referenceImages[0]}
                                alt={`${item.title} reference`}
                                className="commission-posted-thumb"
                                loading="lazy"
                              />
                            ) : (
                              <div className="commission-posted-thumb-empty">No Image</div>
                            )}
                          </div>
                        </div>

                        {/* Chips + action button row above chat strip */}
                        {(() => {
                          const showActionBtn = activeMainTab === 'my-applications' && (
                            (isCommissionInProgress(item.status) && (
                              appUser?.role === 'artist' ||
                              (appUser?.role === 'buyer' && Boolean(item.readyToShipImageUrl) && !item.fullPaymentDone)
                            )) ||
                            (item.status === 'completed' && appUser?.role === 'buyer' && activeBuyerSubTab === 'completed' && !item.sharedToPublic)
                          );
                          const hasChips = item.type || item.style.length > 0 || item.subject.length > 0;
                          if (!hasChips && !showActionBtn) return null;
                          return (
                            <div className="commission-card-chips-action-row">
                              <div className="commission-chip-wrap">
                                {item.type && <span className="commission-badge type">{item.type}</span>}
                                {item.style.map((tag) => (
                                  <span key={`${item.id}-style-${tag}`} className="commission-badge style">{tag}</span>
                                ))}
                                {item.subject.map((tag) => (
                                  <span key={`${item.id}-subject-${tag}`} className="commission-badge subject">{tag}</span>
                                ))}
                              </div>
                              {showActionBtn && (
                                <div className="commission-card-action-slot">
                                  {appUser?.role === 'artist' ? (
                                    item.fullPaymentDone ? (
                                      <button
                                        type="button"
                                        className="commission-card-action-btn"
                                        onClick={() => { setMakeShipmentItem(item); setTrackingInput(''); }}
                                      >
                                        Make Shipment
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="commission-card-action-btn"
                                        onClick={() => { setReadyToShipItem(item); setReadyToShipFile(null); setReadyToShipPreview(null); }}
                                      >
                                        Ready to ship
                                      </button>
                                    )
                                  ) : item.status === 'completed' && activeBuyerSubTab === 'completed' && !item.sharedToPublic ? (
                                    <button
                                      type="button"
                                      className="commission-card-action-btn"
                                      onClick={() => {
                                        setShareToPublicItem(item);
                                        setShareToPublicImage(null);
                                        setShareToPublicImagePreview(item.readyToShipImageUrl ?? null);
                                        setShareToPublicText('');
                                      }}
                                    >
                                      Share to Public
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="commission-card-action-btn"
                                      onClick={() => {
                                        const contact = item.hiredArtistId ? chatContactsByUid[item.hiredArtistId] : undefined;
                                        setCommissionChatMetadata({
                                          artworkId: item.id,
                                          artworkTitle: item.title,
                                          artworkImage: item.referenceImages?.[0],
                                          agreedFinalPrice: item.agreedFinalPrice,
                                          agreedAdvanceAmount: item.agreedAdvanceAmount,
                                          agreedDeliveryDate: item.agreedDeliveryDate,
                                          hiredArtistId: item.hiredArtistId,
                                          readyToShipImageUrl: item.readyToShipImageUrl,
                                          fullPaymentDone: item.fullPaymentDone,
                                        });
                                        setMakePaymentCommissionId(item.id);
                                        setMakePaymentCommissionTitle(item.title);
                                        if (contact) setCommissionChatContact(contact);
                                        setMakePaymentOpen(true);
                                        setMakePaymentConfirm(false);
                                      }}
                                    >
                                      Make Payment
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {activeMainTab !== 'commissions' && (() => {
                          const visibleChats = getCommissionChats(item.id).filter((chat) => {
                            if (appUser?.role !== 'buyer' || !item.hiredArtistId) return true;
                            const otherUid = appUser?.uid
                              ? chat.participants.find((uid) => uid !== appUser.uid)
                              : undefined;
                            return otherUid === item.hiredArtistId;
                          });
                          return visibleChats.length > 0 && (
                        <div className="commission-chat-list">
                          <div className="commission-chat-items commission-chat-items-headers">
                            {visibleChats.map((chat) => {
                              const otherUid = appUser?.uid
                                ? chat.participants.find((uid) => uid !== appUser.uid)
                                : undefined;
                              const contact = otherUid ? chatContactsByUid[otherUid] : undefined;
                              const contactName = contact?.name || (otherUid === item.buyerId ? item.buyerName : 'Kalarang User');
                              const contactAvatar = contact?.avatar || (otherUid === item.buyerId ? item.buyerAvatar : undefined);
                              const unreadCount = appUser?.uid ? (chat.unreadFor?.[appUser.uid] ?? 0) : 0;
                              return (
                                <button
                                  key={chat.id}
                                  type="button"
                                  className={`commission-chat-item commission-chat-header-item${
                                    chat.closed ? ' commission-chat-item-closed' : ''
                                  }`}
                                  onClick={() => handleOpenExistingCommissionChat(item, chat)}
                                >
                                  <img
                                    src={contactAvatar || '/artist.png'}
                                    alt={contactName || 'User'}
                                    className="commission-chat-header-avatar"
                                    loading="lazy"
                                  />
                                  <div className="commission-chat-header-main">
                                    <div className="commission-chat-header-row">
                                      <span className="commission-chat-item-name">{contactName || 'Kalarang User'}</span>
                                      {chat.closed && (
                                        <span className="commission-chat-closed-pill">Closed</span>
                                      )}
                                      {unreadCount > 0 && (
                                        <span className="commission-chat-unread">{unreadCount > 99 ? '99+' : unreadCount}</span>
                                      )}
                                    </div>
                                    <div className="commission-chat-header-row-bottom">
                                      <span className="commission-chat-item-preview">{chat.lastMessage || 'Tap to start chatting'}</span>
                                      <span className="commission-chat-header-time">{formatChatUpdatedAt(chat.updatedAt)}</span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                          );
                        })()}

                        {/* Review section — buyer: write a review; artist: read review + reply */}
                        {item.status === 'completed' && activeMainTab === 'my-applications' && (() => {
                          const review = reviewsMap[item.id];
                          const isBuyerView = appUser?.role === 'buyer' && activeBuyerSubTab === 'completed';
                          const isArtistView = appUser?.role === 'artist' && activeArtistSubTab === 'completed';

                          const StarDisplay = ({ rating }: { rating: number }) => (
                            <div className="commission-review-stars-display" aria-label={`${rating} out of 5 stars`}>
                              {[1,2,3,4,5].map((s) => (
                                <span key={s} className={`commission-review-star-display${s <= rating ? ' filled' : ''}`}>★</span>
                              ))}
                            </div>
                          );

                          if (isBuyerView) {
                            if (review) {
                              return (
                                <div className="commission-review-block">
                                  <p className="commission-review-label">Your review</p>
                                  <StarDisplay rating={review.rating ?? 0} />
                                  <p className="commission-review-text">"{review.reviewText}"</p>
                                  {review.artistReply && (
                                    <div className="commission-review-reply">
                                      <span className="commission-review-reply-label">Artist replied:</span>
                                      <p className="commission-review-reply-text">"{review.artistReply}"</p>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            // No review yet — show button or inline form
                            if (reviewOpenId === item.id) {
                              const currentRating = ratingInputs[item.id] ?? 0;
                              return (
                                <div className="commission-review-block">
                                  <div className="commission-review-stars-input" aria-label="Rate this commission">
                                    {[1,2,3,4,5].map((s) => (
                                      <button
                                        key={s}
                                        type="button"
                                        className={`commission-review-star-btn${s <= currentRating ? ' filled' : ''}`}
                                        disabled={reviewSubmitting === item.id}
                                        aria-label={`${s} star${s > 1 ? 's' : ''}`}
                                        onClick={() => setRatingInputs((prev) => ({ ...prev, [item.id]: s }))}
                                      >★</button>
                                    ))}
                                  </div>
                                  <textarea
                                    className="commission-review-textarea"
                                    placeholder="Share your experience with this artist…"
                                    rows={3}
                                    value={reviewInputs[item.id] || ''}
                                    disabled={reviewSubmitting === item.id}
                                    onChange={(e) => setReviewInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                  />
                                  <div className="commission-review-actions">
                                    <button
                                      type="button"
                                      className="commission-review-cancel-btn"
                                      disabled={reviewSubmitting === item.id}
                                      onClick={() => setReviewOpenId(null)}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className="commission-review-submit-btn"
                                      disabled={reviewSubmitting === item.id || !(reviewInputs[item.id] || '').trim() || currentRating === 0}
                                      onClick={async () => {
                                        if (!appUser?.uid || !item.hiredArtistId) return;
                                        const text = (reviewInputs[item.id] || '').trim();
                                        const rating = ratingInputs[item.id] ?? 0;
                                        if (!text || rating === 0) return;
                                        setReviewSubmitting(item.id);
                                        try {
                                          const id = await submitReview({
                                            commissionId: item.id,
                                            artistId: item.hiredArtistId,
                                            buyerId: appUser.uid,
                                            buyerName: appUser.name || 'Buyer',
                                            buyerAvatar: appUser.avatar,
                                            commissionTitle: item.title,
                                            reviewText: text,
                                            rating,
                                          });
                                          const newReview: CommissionReview = {
                                            id,
                                            commissionId: item.id,
                                            artistId: item.hiredArtistId,
                                            buyerId: appUser.uid,
                                            buyerName: appUser.name || 'Buyer',
                                            buyerAvatar: appUser.avatar,
                                            commissionTitle: item.title,
                                            reviewText: text,
                                            rating,
                                          };
                                          setReviewsMap((prev) => ({ ...prev, [item.id]: newReview }));
                                          setReviewOpenId(null);
                                          createNotification(
                                            item.hiredArtistId,
                                            'review_received',
                                            appUser.uid,
                                            appUser.name || 'Buyer',
                                            appUser.avatar,
                                            undefined, undefined, undefined, undefined,
                                            item.id,
                                            item.title,
                                            String(rating),
                                          ).catch(() => {});
                                        } catch {
                                          toast.error('Could not submit review. Please try again.');
                                        } finally {
                                          setReviewSubmitting(null);
                                        }
                                      }}
                                    >
                                      {reviewSubmitting === item.id ? 'Submitting…' : 'Submit'}
                                    </button>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div className="commission-review-block commission-review-block--cta">
                                <button
                                  type="button"
                                  className="commission-add-review-btn"
                                  onClick={() => setReviewOpenId(item.id)}
                                >
                                  + Add a review
                                </button>
                              </div>
                            );
                          }

                          if (isArtistView && review) {
                            return (
                              <div className="commission-review-block">
                                <p className="commission-review-label">Buyer's review</p>
                                {(review.rating ?? 0) > 0 && (
                                  <div className="commission-review-stars-display" aria-label={`${review.rating} out of 5 stars`}>
                                    {[1,2,3,4,5].map((s) => (
                                      <span key={s} className={`commission-review-star-display${s <= (review.rating ?? 0) ? ' filled' : ''}`}>★</span>
                                    ))}
                                  </div>
                                )}
                                <p className="commission-review-text">"{review.reviewText}"</p>
                                {review.artistReply ? (
                                  <div className="commission-review-reply">
                                    <span className="commission-review-reply-label">Your reply:</span>
                                    <p className="commission-review-reply-text">"{review.artistReply}"</p>
                                  </div>
                                ) : replyOpenId === item.id ? (
                                  <div className="commission-review-reply-form">
                                    <textarea
                                      className="commission-review-textarea"
                                      placeholder="Write a reply…"
                                      rows={2}
                                      value={replyInputs[item.id] || ''}
                                      disabled={replySubmitting === item.id}
                                      onChange={(e) => setReplyInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                    />
                                    <div className="commission-review-actions">
                                      <button
                                        type="button"
                                        className="commission-review-cancel-btn"
                                        disabled={replySubmitting === item.id}
                                        onClick={() => setReplyOpenId(null)}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        className="commission-review-submit-btn"
                                        disabled={replySubmitting === item.id || !(replyInputs[item.id] || '').trim()}
                                        onClick={async () => {
                                          const text = (replyInputs[item.id] || '').trim();
                                          if (!text || !review.id) return;
                                          setReplySubmitting(item.id);
                                          try {
                                            await submitArtistReply(review.id, text);
                                            setReviewsMap((prev) => ({
                                              ...prev,
                                              [item.id]: prev[item.id] ? { ...prev[item.id]!, artistReply: text } : prev[item.id],
                                            }));
                                            setReplyOpenId(null);
                                            createNotification(
                                              review.buyerId,
                                              'review_reply',
                                              appUser!.uid,
                                              appUser!.name || 'Artist',
                                              appUser!.avatar,
                                              undefined, undefined, undefined, undefined,
                                              item.id,
                                              item.title,
                                              text,
                                            ).catch(() => {});
                                          } catch {
                                            toast.error('Could not submit reply. Please try again.');
                                          } finally {
                                            setReplySubmitting(null);
                                          }
                                        }}
                                      >
                                        {replySubmitting === item.id ? 'Submitting…' : 'Submit'}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="commission-add-review-btn"
                                    onClick={() => setReplyOpenId(item.id)}
                                  >
                                    Reply
                                  </button>
                                )}
                              </div>
                            );
                          }

                          return null;
                        })()}

                    </article>
                      );
                    })}
                  </div>
                  {shouldVirtualizeCommissions && commBottomSpacerHeight > 0 && (
                    <div style={{ height: `${commBottomSpacerHeight}px` }} />
                  )}
                </div>
                {browseLoadingMore && (
                  <div className="commission-loading-more">
                    <div className="commission-loading-more-spinner" />
                  </div>
                )}
                {activeMainTab === 'commissions' && !browseHasMore && listRequests.length > 0 && !debouncedCommissionSearch.trim() && (
                  <div className="commission-end-of-list">You've reached the end.</div>
                )}
                </>
              )}
            </div>
          )}
        </div>

        {mode === 'form' && isDesktop && (
          <aside className="commission-preview-card">
            <h3 className="section-title commission-preview-title">Live Preview</h3>
            <p className="commission-preview-label">Title</p>
            <p className="commission-preview-value">{title || 'Untitled commission'}</p>
            <div className="commission-preview-grid-two">
              <div>
                <p className="commission-preview-label">Budget</p>
                <p className="commission-preview-value">{budget === 'Custom' ? customBudget || 'Custom' : budget || 'Not set'}</p>
              </div>
              <div>
                <p className="commission-preview-label">Deadline</p>
                <p className="commission-preview-value">{deadline === 'Custom' ? customDate || 'Custom date' : deadline || 'Not set'}</p>
              </div>
              <div>
                <p className="commission-preview-label">Size</p>
                <p className="commission-preview-value">
                  {size === 'Custom'
                    ? customHeight || customWidth
                      ? `${customHeight || '?'} x ${customWidth || '?'}`
                      : 'Custom size'
                    : size || 'Not set'}
                </p>
              </div>
            </div>
            <p className="commission-preview-label">Tags</p>
            <div className="commission-chip-wrap">
              {type && <span className="commission-badge type">{type}</span>}
              {style.map((item) => (
                <button key={`style-${item}`} type="button" className="commission-badge style" onClick={() => toggleMulti(style, setStyle, item)}>
                  {item} x
                </button>
              ))}
              {subject.map((item) => (
                <button key={`subject-${item}`} type="button" className="commission-badge subject" onClick={() => toggleMulti(subject, setSubject, item)}>
                  {item} x
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>

      {showDraftModal && (
        <div
          className="confirm-modal-overlay"
          onClick={handleCancelNavigation}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="confirm-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '320px',
              width: '90%',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              position: 'relative',
            }}
          >
            <button
              onClick={handleCancelNavigation}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#666666',
                padding: '0',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ×
            </button>
            <h2
              style={{
                margin: '0 0 0.75rem',
                fontSize: '1.25rem',
                color: '#1a1a1a',
                paddingRight: '2rem',
              }}
            >
              Unsaved Changes
            </h2>
            <p
              style={{
                margin: '0 0 1.5rem',
                color: '#666666',
                lineHeight: 1.5,
              }}
            >
              You have unsaved work. Would you like to save it as a draft?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="button button-primary"
                onClick={handleSaveDraftAndLeave}
                style={{ flex: 1 }}
              >
                Save Draft
              </button>
              <button
                type="button"
                className="button button-outline"
                onClick={handleDiscardAndLeave}
                style={{ flex: 1, color: 'var(--color-error)' }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {showPortfolioRequiredModal &&
        createPortal(
          <div
            className="confirm-modal-overlay"
            role="presentation"
            onClick={() => setShowPortfolioRequiredModal(false)}
          >
            <div
              className="confirm-modal-content"
              role="dialog"
              aria-modal="true"
              aria-labelledby="portfolio-required-title"
              aria-describedby="portfolio-required-desc"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="confirm-modal-icon" style={{ background: 'rgba(47, 164, 169, 0.1)', color: 'var(--color-accent, #2fa4a9)', margin: '0 auto 20px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h2 id="portfolio-required-title" className="confirm-modal-title">
                Profile incomplete
              </h2>
              <p id="portfolio-required-desc" className="confirm-modal-message">
                To apply for commissions, you need:
                <br /><br />
                • At least <strong>4 works</strong> in your portfolio (published or saved to gallery)
                <br />
                • <strong>UPI ID</strong> updated in your profile for payment
                <br /><br />
                This helps buyers validate your work and ensures smooth payment processing.
              </p>
              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="confirm-modal-btn confirm-modal-btn-cancel"
                  onClick={() => setShowPortfolioRequiredModal(false)}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {completeConfirmItem &&
        createPortal(
          <div
            className="confirm-modal-overlay"
            role="presentation"
            onClick={() => {
              if (!markingCompletedId) setCompleteConfirmItem(null);
            }}
          >
            <div
              className="confirm-modal-content"
              role="dialog"
              aria-modal="true"
              aria-labelledby="commission-complete-confirm-title"
              aria-describedby="commission-complete-confirm-desc"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="commission-complete-confirm-title" className="confirm-modal-title">
                Mark as completed?
              </h2>
              <p id="commission-complete-confirm-desc" className="confirm-modal-message">
                Are you sure you want to mark this commission as completed? It will appear under Completed for you
                and the assigned artist.
              </p>
              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="confirm-modal-btn confirm-modal-btn-cancel"
                  disabled={Boolean(markingCompletedId)}
                  onClick={() => setCompleteConfirmItem(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="confirm-modal-btn confirm-modal-btn-confirm confirm-modal-btn-info"
                  disabled={Boolean(markingCompletedId)}
                  onClick={() => void confirmMarkCommissionCompleted()}
                >
                  <span className="commission-hire-tooltip-confirm-inner">
                    {markingCompletedId && (
                      <span className="commission-inline-spinner commission-inline-spinner--outline" aria-hidden />
                    )}
                    {markingCompletedId ? 'Updating…' : 'Mark as completed'}
                  </span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {makePaymentOpen && commissionChatMetadata &&
        createPortal(
          (() => {
            const UPI_ID = artistUpiIdForPayment || null;
            const finalPrice = parseFloat(commissionChatMetadata.agreedFinalPrice || '0');
            const advance = parseFloat(commissionChatMetadata.agreedAdvanceAmount || '0');
            const remaining = Math.max(0, finalPrice - advance);
            const upiUri = UPI_ID ? `upi://pay?pa=${UPI_ID}&pn=Kalarang%20Art${remaining ? `&am=${remaining}` : ''}&cu=INR` : '';
            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            return (
              <div
                className="confirm-modal-overlay"
                role="presentation"
                onClick={() => { if (!makePaymentBusy) { setMakePaymentOpen(false); setMakePaymentConfirm(false); } }}
              >
                <div
                  className="confirm-modal-content commission-make-payment-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="make-payment-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="commission-accept-offer-close"
                    disabled={makePaymentBusy}
                    aria-label="Close"
                    onClick={() => { setMakePaymentOpen(false); setMakePaymentConfirm(false); }}
                  >×</button>
                  <h2 id="make-payment-title" className="confirm-modal-title">Make Payment</h2>
                  <p className="confirm-modal-message">
                    Please complete the remaining payment so that the artist can ship your artwork.
                  </p>
                  {fetchingUpiIdForPayment ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                      Loading payment details...
                    </div>
                  ) : !UPI_ID ? (
                    <div style={{ padding: '1rem', textAlign: 'center' }}>
                      <p style={{ color: 'var(--color-error, #dc2626)', fontWeight: 600, marginBottom: '0.5rem' }}>⚠️ Payment Not Available</p>
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>The artist hasn't set up their UPI ID yet. Please contact them to add it in their profile.</p>
                    </div>
                  ) : (
                    <>
                      {remaining > 0 && (
                        <div className="commission-make-payment-amount">₹{remaining}</div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                        <p className="commission-accept-offer-upiid" style={{ margin: 0 }}>UPI ID: <strong>{UPI_ID}</strong></p>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(UPI_ID!);
                            toast.success('UPI ID copied to clipboard!');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '0.25rem',
                            cursor: 'pointer',
                            color: 'var(--color-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Copy UPI ID"
                        >
                          {MdContentCopy({ size: 18 })}
                        </button>
                      </div>
                      <div className="commission-accept-offer-qr">
                        <QRCodeSVG value={upiUri} size={180} />
                        <p className="commission-accept-offer-qr-hint">Scan to pay via UPI</p>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '0.5rem' }}>💡 You are directly paying to the artist</p>
                    </>
                  )}
                  {makePaymentConfirm ? (
                    <div className="commission-make-payment-confirm-block">
                      <p className="commission-payment-confirm-tooltip-q">Have you done the payment?</p>
                      <div className="confirm-modal-actions confirm-modal-actions--row">
                        <button
                          type="button"
                          className="confirm-modal-btn confirm-modal-btn-cancel"
                          disabled={makePaymentBusy}
                          onClick={() => setMakePaymentConfirm(false)}
                        >No</button>
                        <button
                          type="button"
                          className="confirm-modal-btn confirm-modal-btn-confirm confirm-modal-btn-info"
                          disabled={makePaymentBusy}
                          onClick={async () => {
                            if (!appUser?.uid || !commissionChatMetadata) return;
                            setMakePaymentBusy(true);
                            try {
                              const totalPaid = finalPrice > 0 ? String(finalPrice) : String(remaining);
                              await markFullPaymentDone(commissionChatMetadata.artworkId, totalPaid);
                              const paymentChat = commissionChats.find(
                                (c) => c.commissionId === commissionChatMetadata.artworkId && c.participants.includes(appUser.uid),
                              );
                              if (paymentChat && commissionChatContact) {
                                await sendCommissionMessage(
                                  paymentChat.id,
                                  appUser.uid,
                                  'Full payment is done. Please do ship the artwork.',
                                  commissionChatMetadata.artworkId,
                                  commissionChatMetadata.artworkTitle,
                                  commissionChatMetadata.artworkImage,
                                ).catch(() => {});
                                createNotification(
                                  commissionChatContact.uid,
                                  'full_payment_done',
                                  appUser.uid,
                                  appUser.name || 'Buyer',
                                  appUser.avatar,
                                  undefined, undefined, undefined, undefined,
                                  commissionChatMetadata.artworkId,
                                  commissionChatMetadata.artworkTitle,
                                ).catch(() => {});
                              }
                              setCommissionChatMetadata((prev) => prev ? { ...prev, fullPaymentDone: true } : prev);
                              setBuyerRequests((prev) => prev.map((c) => c.id === commissionChatMetadata.artworkId ? { ...c, fullPaymentDone: true } : c));
                            
                              setMakePaymentOpen(false);
                              setMakePaymentConfirm(false);
                            } catch {
                              toast.error('Could not confirm payment. Please try again.');
                            } finally {
                              setMakePaymentBusy(false);
                            }
                          }}
                        >
                          <span className="commission-hire-tooltip-confirm-inner">
                            {makePaymentBusy && <span className="commission-inline-spinner commission-inline-spinner--outline" aria-hidden />}
                            {makePaymentBusy ? 'Please wait…' : 'Yes'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="confirm-modal-actions confirm-modal-actions--row">
                      <button
                        type="button"
                        className="confirm-modal-btn confirm-modal-btn-cancel"
                        disabled={makePaymentBusy}
                        onClick={() => { setMakePaymentOpen(false); setMakePaymentConfirm(false); }}
                      >Cancel</button>
                      <button
                        type="button"
                        className="confirm-modal-btn confirm-modal-btn-confirm confirm-modal-btn-info"
                        disabled={makePaymentBusy || !UPI_ID || fetchingUpiIdForPayment}
                        title={!UPI_ID ? 'Artist UPI ID not available' : undefined}
                        onClick={() => setMakePaymentConfirm(true)}
                      >Complete</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })(),
          document.body,
        )}

      {readyToShipItem &&
        createPortal(
          <div
            className="confirm-modal-overlay"
            role="presentation"
            onClick={() => { if (!readyToShipUploading) setReadyToShipItem(null); }}
          >
            <div
              className="confirm-modal-content commission-ready-to-ship-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ready-to-ship-title"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="commission-accept-offer-close"
                aria-label="Close"
                disabled={readyToShipUploading}
                onClick={() => setReadyToShipItem(null)}
              >
                ×
              </button>
              <h2 id="ready-to-ship-title" className="confirm-modal-title">Ready to ship</h2>
              <p className="confirm-modal-message">
                Upload a photo of the artwork so the buyer can see it's ready.
              </p>
              <p className="confirm-modal-message" style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #888)', marginTop: '-0.5rem' }}>
                This photo will also be used for display when the buyer shares the commission publicly.
              </p>
              <label className="commission-ready-to-ship-upload-area">
                {readyToShipPreview ? (
                  <img src={readyToShipPreview} alt="Preview" className="commission-ready-to-ship-preview" />
                ) : readyToShipItem.readyToShipImageUrl ? (
                  <div className="commission-ready-to-ship-preview-wrap">
                    <img src={readyToShipItem.readyToShipImageUrl} alt="Current ship photo" className="commission-ready-to-ship-preview" />
                    <div className="commission-ready-to-ship-replace-overlay">
                      <span>📷 Tap to replace</span>
                    </div>
                  </div>
                ) : (
                  <div className="commission-ready-to-ship-placeholder">
                    <span className="commission-ready-to-ship-placeholder-icon">📷</span>
                    <span>Tap to choose photo</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  disabled={readyToShipUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setReadyToShipFile(file);
                    setReadyToShipPreview(URL.createObjectURL(file));
                  }}
                />
              </label>
              {(readyToShipPreview || readyToShipFile) && (
                <p className="commission-ready-to-ship-change-hint">Tap image to change</p>
              )}
              <div className="confirm-modal-actions confirm-modal-actions--row">
                <button
                  type="button"
                  className="confirm-modal-btn confirm-modal-btn-cancel"
                  disabled={readyToShipUploading}
                  onClick={() => setReadyToShipItem(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="confirm-modal-btn confirm-modal-btn-confirm confirm-modal-btn-info"
                  disabled={readyToShipUploading || !readyToShipFile}
                  onClick={async () => {
                    if (!readyToShipFile || !appUser?.uid || !readyToShipItem) return;
                    setReadyToShipUploading(true);
                    try {
                      const url = await uploadChatMessageImage(appUser.uid, 'commissionChats', readyToShipItem.id, readyToShipFile);
                      await saveReadyToShipImage(readyToShipItem.id, url);
                      // Send chat message with image + text to the buyer
                      const readyToShipText = 'Your artwork is ready to ship, please check how it looks.';
                      const hiredChat = commissionChats.find(
                        (c) => c.commissionId === readyToShipItem.id && c.participants.includes(appUser.uid),
                      );
                      if (hiredChat) {
                        await sendCommissionMessage(
                          hiredChat.id,
                          appUser.uid,
                          readyToShipText,
                          readyToShipItem.id,
                          readyToShipItem.title,
                          readyToShipItem.referenceImages?.[0],
                          url,
                        ).catch(() => {});
                      }
                      // Notify buyer
                      createNotification(
                        readyToShipItem.buyerId,
                        'ready_to_ship',
                        appUser.uid,
                        appUser.name || 'Artist',
                        appUser.avatar,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        readyToShipItem.id,
                        readyToShipItem.title,
                      ).catch(() => {});
                      const updated = { ...readyToShipItem, readyToShipImageUrl: url };
                      setHiredArtistCommissions((prev) => prev.map((c) => c.id === updated.id ? updated : c));
                
                      setReadyToShipItem(null);
                      setReadyToShipFile(null);
                      setReadyToShipPreview(null);
                    } catch {
                      toast.error('Upload failed. Please try again.');
                    } finally {
                      setReadyToShipUploading(false);
                    }
                  }}
                >
                  <span className="commission-hire-tooltip-confirm-inner">
                    {readyToShipUploading && <span className="commission-inline-spinner commission-inline-spinner--outline" aria-hidden />}
                    {readyToShipUploading ? 'Uploading…' : 'Upload'}
                  </span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {makeShipmentItem &&
        createPortal(
          <div
            className="confirm-modal-overlay"
            role="presentation"
            onClick={() => { if (!makeShipmentBusy) setMakeShipmentItem(null); }}
          >
            <div
              className="confirm-modal-content commission-make-payment-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="make-shipment-title"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="commission-accept-offer-close"
                aria-label="Close"
                disabled={makeShipmentBusy}
                onClick={() => setMakeShipmentItem(null)}
              >
                ×
              </button>
              <h2 id="make-shipment-title" className="confirm-modal-title">Make Shipment</h2>
              <p className="confirm-modal-message">
                Enter the tracking ID and upload the shipment receipt for <strong>{makeShipmentItem.title}</strong>.
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
              <input
                ref={shipmentReceiptInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file?.type.startsWith('image/')) return;
                  setShipmentReceiptFile(file);
                  setShipmentReceiptPreview(URL.createObjectURL(file));
                }}
                aria-hidden
                tabIndex={-1}
              />
              {shipmentReceiptPreview ? (
                <div className="cd-shipment-receipt-preview">
                  <img src={shipmentReceiptPreview} alt="Receipt preview" />
                  <button
                    type="button"
                    className="cd-shipment-receipt-remove"
                    onClick={() => { setShipmentReceiptFile(null); setShipmentReceiptPreview(null); }}
                    aria-label="Remove receipt"
                    disabled={makeShipmentBusy}
                  >×</button>
                </div>
              ) : (
                <button
                  type="button"
                  className="cd-shipment-receipt-upload"
                  onClick={() => shipmentReceiptInputRef.current?.click()}
                  disabled={makeShipmentBusy}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Upload shipment receipt
                </button>
              )}
              <div className="confirm-modal-actions confirm-modal-actions--row" style={{ marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="confirm-modal-btn confirm-modal-btn-cancel"
                  disabled={makeShipmentBusy}
                  onClick={() => { setMakeShipmentItem(null); setShipmentReceiptFile(null); setShipmentReceiptPreview(null); }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="confirm-modal-btn confirm-modal-btn-confirm confirm-modal-btn-info"
                  disabled={makeShipmentBusy || !trackingInput.trim() || !shipmentReceiptFile}
                  onClick={async () => {
                    if (!makeShipmentItem || !appUser?.uid || !trackingInput.trim() || !shipmentReceiptFile) return;
                    setMakeShipmentBusy(true);
                    try {
                      await markShipped(makeShipmentItem.id, appUser.uid, trackingInput.trim());
                      const shipChat = commissionChats.find(
                        (c) => c.commissionId === makeShipmentItem.id && c.participants.includes(appUser.uid),
                      );
                      if (shipChat) {
                        await sendCommissionMessage(
                          shipChat.id,
                          appUser.uid,
                          `Your artwork has been shipped! Tracking ID: ${trackingInput.trim()}`,
                          makeShipmentItem.id,
                          makeShipmentItem.title,
                          makeShipmentItem.referenceImages?.[0],
                        ).catch(() => {});
                        // Upload and send receipt image
                        const { uploadChatMessageImage } = await import('../../services/chatImageUpload');
                        const receiptUrl = await uploadChatMessageImage(appUser.uid, 'commissionChats', shipChat.id, shipmentReceiptFile);
                        await sendCommissionMessage(
                          shipChat.id,
                          appUser.uid,
                          '',
                          makeShipmentItem.id,
                          makeShipmentItem.title,
                          makeShipmentItem.referenceImages?.[0],
                          receiptUrl,
                        ).catch(() => {});
                      }
                      createNotification(
                        makeShipmentItem.buyerId,
                        'commission_shipped',
                        appUser.uid,
                        appUser.name || 'Artist',
                        appUser.avatar,
                        undefined, undefined, undefined, undefined,
                        makeShipmentItem.id,
                        makeShipmentItem.title,
                        trackingInput.trim(),
                      ).catch(() => {});
                      const completed = { ...makeShipmentItem, status: 'completed' as const, trackingId: trackingInput.trim() };
                      setHiredArtistCommissions((prev) => prev.map((c) => c.id === completed.id ? completed : c));
                      setBuyerRequests((prev) => prev.map((c) => c.id === completed.id ? completed : c));
                      setCommissionDocsFromChats((prev) => prev.map((c) => c.id === completed.id ? completed : c));
                      invalidateCommissionsBrowseCache();
                      invalidateCommissionsUserCaches(appUser.uid);
                      invalidateCommissionsUserCaches(makeShipmentItem.buyerId);
                      if (commissionChatOpen && commissionChatMetadata?.artworkId === makeShipmentItem.id) {
                        setCommissionChatClosed(true);
                        setCommissionChatClosedReason('commission_completed');
                        setCommissionStatusForChat('completed');
                      }
                      setShipmentReceiptFile(null);
                      setShipmentReceiptPreview(null);
                      setMakeShipmentItem(null);
                    } catch {
                      toast.error('Could not update commission. Please try again.');
                    } finally {
                      setMakeShipmentBusy(false);
                    }
                  }}
                >
                  <span className="commission-hire-tooltip-confirm-inner">
                    {makeShipmentBusy && <span className="commission-inline-spinner commission-inline-spinner--outline" aria-hidden />}
                    {makeShipmentBusy ? 'Shipping…' : 'Confirm'}
                  </span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {shareToPublicItem && createPortal(
        <div
          className="confirm-modal-overlay"
          role="presentation"
          onClick={() => { setShareToPublicItem(null); setShareToPublicImage(null); setShareToPublicImagePreview(null); setShareToPublicText(''); }}
        >
          <div
            className="confirm-modal-content commission-share-public-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-public-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="commission-accept-offer-close"
              aria-label="Close"
              onClick={() => { setShareToPublicItem(null); setShareToPublicImage(null); setShareToPublicImagePreview(null); setShareToPublicText(''); }}
            >
              ×
            </button>
            <h2 id="share-public-title" className="confirm-modal-title">Share to Public</h2>
            <p className="confirm-modal-message">Show off your commission! Share the artwork and your experience with the community.</p>

            <label className="commission-share-public-upload-area">
              {shareToPublicImagePreview ? (
                <div className="commission-share-public-preview-wrap">
                  <img src={shareToPublicImagePreview} alt="Preview" className="commission-share-public-preview-img" />
                  {!shareToPublicImage && shareToPublicItem?.readyToShipImageUrl && (
                    <span className="commission-share-public-preview-badge">Artist's photo · tap to replace</span>
                  )}
                  <button
                    type="button"
                    className="commission-share-public-preview-remove"
                    onClick={(e) => { e.preventDefault(); setShareToPublicImage(null); setShareToPublicImagePreview(null); }}
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="commission-share-public-upload-placeholder">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span>Upload artwork photo</span>
                  <span className="commission-share-public-upload-hint">Tap to choose an image</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file?.type.startsWith('image/')) return;
                  setShareToPublicImage(file);
                  setShareToPublicImagePreview(URL.createObjectURL(file));
                }}
              />
            </label>

            <div className="commission-share-public-experience">
              <label className="commission-share-public-experience-label" htmlFor="share-public-text">
                Share your experience
              </label>
              <div className="commission-share-public-textarea-wrap">
                <textarea
                  id="share-public-text"
                  className="commission-share-public-textarea"
                  placeholder="Tell the community about your experience with this commission — what you loved, how it turned out…"
                  rows={4}
                  maxLength={200}
                  value={shareToPublicText}
                  onChange={(e) => {
                    const lines = e.target.value.split('\n');
                    if (lines.length > 4) return;
                    setShareToPublicText(e.target.value);
                  }}
                />
                <span className="commission-share-public-char-count">
                  {shareToPublicText.length} / 200
                </span>
              </div>
            </div>

            <div className="confirm-modal-actions confirm-modal-actions--row">
              <button
                type="button"
                className="confirm-modal-btn confirm-modal-btn-cancel"
                disabled={shareToPublicBusy}
                onClick={() => { setShareToPublicItem(null); setShareToPublicImage(null); setShareToPublicImagePreview(null); setShareToPublicText(''); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-modal-btn confirm-modal-btn-confirm confirm-modal-btn-info"
                disabled={shareToPublicBusy || (!shareToPublicText.trim() && !shareToPublicImage)}
                onClick={async () => {
                  if (!appUser || !shareToPublicItem) return;
                  setShareToPublicBusy(true);
                  try {
                    let imageUrl = shareToPublicImagePreview ?? '';
                    if (shareToPublicImage) {
                      const { uploadChatMessageImage } = await import('../../services/chatImageUpload');
                      imageUrl = await uploadChatMessageImage(appUser.uid, 'chats', `publicShares_${Date.now()}`, shareToPublicImage);
                    }
                    await savePublicShare({
                      buyerId: appUser.uid,
                      buyerName: appUser.name || 'Buyer',
                      ...(appUser.avatar ? { buyerAvatar: appUser.avatar } : {}),
                      artistId: shareToPublicItem.hiredArtistId ?? '',
                      artistName: chatContactsByUid[shareToPublicItem.hiredArtistId ?? '']?.name ?? 'Artist',
                      commissionId: shareToPublicItem.id,
                      commissionTitle: shareToPublicItem.title,
                      imageUrl: imageUrl || '',
                      description: shareToPublicText.trim(),
                    });
                    const sharedId = shareToPublicItem.id;
                    void markCommissionSharedToPublic(sharedId).catch(() => {});
                    setBuyerRequests((prev) =>
                      prev.map((r) => r.id === sharedId ? { ...r, sharedToPublic: true } : r)
                    );
                    toast.success('Shared to public!');
                    setShareToPublicItem(null);
                    setShareToPublicImage(null);
                    setShareToPublicImagePreview(null);
                    setShareToPublicText('');
                    navigate('/home', { state: { feedTab: 'customized' } });
                  } catch {
                    toast.error('Could not share. Please try again.');
                  } finally {
                    setShareToPublicBusy(false);
                  }
                }}
              >
                <span className="commission-hire-tooltip-confirm-inner">
                  {shareToPublicBusy && <span className="commission-inline-spinner commission-inline-spinner--outline" aria-hidden />}
                  {shareToPublicBusy ? 'Sharing…' : 'Share'}
                </span>
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <CommissionChatModal
        isOpen={commissionChatOpen}
        onClose={() => {
          setCommissionChatOpen(false);
          setCommissionChatId('');
          setCommissionChatContact(null);
          setCommissionChatMetadata(null);
          setCommissionChatInitialMessage('');
          setCommissionStatusForChat('open');
          setCommissionHiredArtistIdForChat(null);
          setCommissionChatClosed(false);
          setCommissionChatClosedReason(undefined);
        }}
        currentUserId={appUser?.uid}
        currentUserRole={appUser?.role}
        chatId={commissionChatId}
        contact={commissionChatContact}
        initialMessage={commissionChatInitialMessage}
        metadata={commissionChatMetadata}
        commissionStatus={commissionStatusForChat}
        chatClosed={commissionChatClosed}
        chatClosedReason={commissionChatClosedReason}
        commissionHiredArtistId={commissionHiredArtistIdForChat}
        acceptingOfferMessageId={acceptingOfferMessageId}
        onAcceptOffer={
          appUser?.role === 'buyer' && commissionChatMetadata && commissionChatContact && commissionChatId
            ? async (messageId: string) => {
                if (!appUser?.uid || !commissionChatMetadata) return;
                setAcceptingOfferMessageId(messageId);
                try {
                  await acceptCommissionOfferFromChat(commissionChatId, messageId);
                  invalidateCommissionsBrowseCache();
                  invalidateCommissionsUserCaches(appUser.uid);
                  const [openItems, ownItems] = await Promise.all([
                    getBrowseCommissionRequestsCached(),
                    getBuyerCommissionRequestsCached(appUser.uid),
                  ]);
                  setPostedRequests(openItems);
                  setBuyerRequests(ownItems);
                  const acceptedHiredId = ownItems.find(
                    (r) => r.id === commissionChatMetadata.artworkId,
                  )?.hiredArtistId;
                  if (acceptedHiredId) {
                    invalidateCommissionsUserCaches(acceptedHiredId);
                  }
                  const updatedRow = ownItems.find((r) => r.id === commissionChatMetadata.artworkId);
                  if (updatedRow) {
                    setCommissionChatMetadata((prev) =>
                      prev && prev.artworkId === updatedRow.id
                        ? {
                            ...prev,
                            agreedFinalPrice: updatedRow.agreedFinalPrice,
                            agreedAdvanceAmount: updatedRow.agreedAdvanceAmount,
                            agreedDeliveryDate: updatedRow.agreedDeliveryDate,
                            hiredArtistId: updatedRow.hiredArtistId,
                          }
                        : prev,
                    );
                    setCommissionHiredArtistIdForChat(updatedRow.hiredArtistId ?? null);
                  }
                  setActiveBuyerSubTab('inprogress');
                  setCommissionStatusForChat('inprogress');
                  setCommissionChatClosed(false);
                  setCommissionChatClosedReason(undefined);
                  if (commissionChatContact) {
                    createNotification(
                      commissionChatContact.uid,
                      'commission_offer_accepted',
                      appUser.uid,
                      appUser.name || 'Buyer',
                      appUser.avatar,
                      undefined, undefined, undefined, undefined,
                      commissionChatMetadata.artworkId,
                      commissionChatMetadata.artworkTitle,
                    ).catch(() => {});
                    
                    // Check if artist has UPI ID and send notification if missing
                    getUserProfile(commissionChatContact.uid)
                      .then((profile) => {
                        if (!profile?.upiId || profile.upiId.trim() === '') {
                          createNotification(
                            commissionChatContact.uid,
                            'payment_failed_no_upi',
                            appUser.uid,
                            appUser.name || 'A buyer',
                            appUser.avatar,
                            undefined, undefined, undefined, undefined,
                            commissionChatMetadata.artworkId,
                            commissionChatMetadata.artworkTitle
                          ).catch(() => {}); // Silent fail
                        }
                      })
                      .catch(() => {}); // Silent fail
                  }
                } catch {
                  toast.error('Could not accept offer. Please try again.');
                  throw new Error('accept_failed');
                } finally {
                  setAcceptingOfferMessageId(null);
                }
              }
            : undefined
        }
        onReadyToShip={
          appUser?.role === 'artist' && commissionChatMetadata?.artworkId
            ? () => {
                const item = hiredArtistCommissions.find((c) => c.id === commissionChatMetadata?.artworkId) ?? null;
                setReadyToShipItem(item);
                setReadyToShipFile(null);
                setReadyToShipPreview(null);
              }
            : undefined
        }
        onMakePayment={
          appUser?.role === 'buyer' && commissionChatMetadata?.readyToShipImageUrl && !commissionChatMetadata?.fullPaymentDone
            ? () => {
                setMakePaymentOpen(true);
                setMakePaymentConfirm(false);
              }
            : undefined
        }
        onMakeShipment={
          appUser?.role === 'artist' && commissionChatMetadata?.fullPaymentDone && commissionChatMetadata?.artworkId
            ? () => {
                const item = hiredArtistCommissions.find((c) => c.id === commissionChatMetadata?.artworkId) ?? null;
                setMakeShipmentItem(item);
                setTrackingInput('');
              }
            : undefined
        }
      />

      <CommissionFlowInfoModal
        isOpen={showCommissionFlowInfo}
        onClose={handleCommissionFlowInfoClose}
        userRole={appUser?.role === 'artist' ? 'artist' : 'buyer'}
      />
    </div>
  );
};

export default Commissions;

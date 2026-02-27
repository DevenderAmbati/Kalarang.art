import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  DocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  ChatMessage,
  getChatId,
  createOrGetChat,
  sendMessage as sendChatMessage,
  getMessages,
} from '../services/chatService';

const REALTIME_LIMIT = 20;
const MAX_CACHED_CHATS = 10;

/** In-memory cache so reopening a chat shows messages instantly (no extra reads). */
const messagesCache: Record<string, { messages: ChatMessage[]; hasMore: boolean }> = {};

function pruneCache() {
  const keys = Object.keys(messagesCache);
  if (keys.length > MAX_CACHED_CHATS) {
    delete messagesCache[keys[0]];
  }
}

interface UseChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  hasMore: boolean;
  sendMessage: (text: string) => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Custom hook that manages a single 1:1 chat.
 *
 * Design decisions for cost & scale:
 * - Only ONE onSnapshot listener per open chat (limited to the latest 20 messages).
 * - Older messages are fetched on-demand via cursor pagination (getDocs, not onSnapshot).
 * - The listener is torn down when the component unmounts or the chat changes.
 * - Messages are memoised so the list reference only changes when content changes.
 */
export function useChat(
  currentUserId: string | undefined,
  otherUserId: string | undefined
): UseChatReturn {
  const [realtimeMessages, setRealtimeMessages] = useState<ChatMessage[]>([]);
  const [olderMessages, setOlderMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [chatId, setChatId] = useState<string | null>(null);

  const paginationCursorRef = useRef<DocumentSnapshot | null>(null);
  const isInitialised = useRef(false);

  // Set chatId immediately (deterministic) and ensure chat doc exists in background
  useEffect(() => {
    if (!currentUserId || !otherUserId) return;

    const id = getChatId(currentUserId, otherUserId);
    setChatId(id);
    setLoading(true);
    isInitialised.current = false;
    setRealtimeMessages([]);
    setOlderMessages([]);
    setHasMore(true);
    paginationCursorRef.current = null;

    createOrGetChat(currentUserId, otherUserId).catch(() => {});

    return () => {
      setChatId(null);
      setRealtimeMessages([]);
      setOlderMessages([]);
      setHasMore(true);
      paginationCursorRef.current = null;
    };
  }, [currentUserId, otherUserId]);

  // Real-time listener — only the latest REALTIME_LIMIT messages
  useEffect(() => {
    if (!chatId) return;

    // Show cached messages immediately so reopening a chat doesn't flash "Loading..."
    const cached = messagesCache[chatId];
    if (cached) {
      setRealtimeMessages(cached.messages);
      setHasMore(cached.hasMore);
      setLoading(false);
    }

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(
      messagesRef,
      orderBy('createdAt', 'desc'),
      limit(REALTIME_LIMIT)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs: ChatMessage[] = snapshot.docs.map((d) => ({
          id: d.id,
          senderId: d.data().senderId,
          text: d.data().text,
          createdAt: d.data().createdAt as Timestamp | null,
        }));

        const ordered = msgs.reverse();
        setRealtimeMessages(ordered);

        // Cursor for "Load older" — oldest doc in this page
        if (snapshot.docs.length > 0) {
          paginationCursorRef.current = snapshot.docs[snapshot.docs.length - 1];
        }

        const hasMore = snapshot.docs.length >= REALTIME_LIMIT;
        messagesCache[chatId] = { messages: ordered, hasMore };
        pruneCache();

        if (!isInitialised.current) {
          setHasMore(hasMore);
          setLoading(false);
          isInitialised.current = true;
        }
      },
      (error) => {
        console.error('[useChat] Listener error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [chatId]);

  const loadMore = useCallback(async () => {
    if (!chatId || !hasMore || !paginationCursorRef.current) return;

    const { messages: older, lastVisible } = await getMessages(
      chatId,
      paginationCursorRef.current
    );

    if (older.length === 0) {
      setHasMore(false);
      return;
    }

    // older comes newest-first from getMessages; reverse for chronological order
    setOlderMessages((prev) => [...older.reverse(), ...prev]);

    if (lastVisible) {
      paginationCursorRef.current = lastVisible;
    }

    if (older.length < 20) {
      setHasMore(false);
    }
  }, [chatId, hasMore]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!chatId || !currentUserId || !text.trim()) return;

      setSending(true);
      try {
        await sendChatMessage(chatId, currentUserId, text.trim(), otherUserId);
      } catch (error) {
        console.error('[useChat] Send error:', error);
        throw error;
      } finally {
        setSending(false);
      }
    },
    [chatId, currentUserId, otherUserId]
  );

  // Merge older (paginated) + realtime messages, deduplicated by id
  const messages = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of olderMessages) map.set(m.id, m);
    for (const m of realtimeMessages) map.set(m.id, m);

    return Array.from(map.values()).sort((a, b) => {
      const ta = a.createdAt?.toMillis() ?? 0;
      const tb = b.createdAt?.toMillis() ?? 0;
      return ta - tb;
    });
  }, [olderMessages, realtimeMessages]);

  return { messages, loading, sending, hasMore, sendMessage, loadMore };
}

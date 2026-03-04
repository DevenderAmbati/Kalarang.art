import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { subscribeToUserChats, Chat } from '../services/chatService';

interface ChatContextValue {
  chats: Chat[];
  unreadCount: number;
  loading: boolean;
  activeChatId: string | null;
  setActiveChatId: (chatId: string | null) => void;
  isChatDrawerOpen: boolean;
  setIsChatDrawerOpen: (isOpen: boolean) => void;
}

const ChatContext = createContext<ChatContextValue>({ 
  chats: [], 
  unreadCount: 0, 
  loading: true,
  activeChatId: null,
  setActiveChatId: () => {},
  isChatDrawerOpen: false,
  setIsChatDrawerOpen: () => {}
});

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { appUser } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);

  useEffect(() => {
    if (!appUser?.uid) {
      setChats([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToUserChats(appUser.uid, (fetched) => {
      setChats(fetched);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [appUser?.uid]);

  const unreadCount = chats.filter((c) => (c.unreadFor?.[appUser?.uid ?? ''] ?? 0) > 0).length;

  const handleSetActiveChatId = useCallback((chatId: string | null) => {
    setActiveChatId(chatId);
  }, []);

  const handleSetIsChatDrawerOpen = useCallback((isOpen: boolean) => {
    setIsChatDrawerOpen(isOpen);
  }, []);

  return (
    <ChatContext.Provider value={{ 
      chats, 
      unreadCount, 
      loading, 
      activeChatId, 
      setActiveChatId: handleSetActiveChatId,
      isChatDrawerOpen,
      setIsChatDrawerOpen: handleSetIsChatDrawerOpen
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => useContext(ChatContext);

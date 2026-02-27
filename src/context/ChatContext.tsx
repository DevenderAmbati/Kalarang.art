import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { subscribeToUserChats, Chat } from '../services/chatService';

interface ChatContextValue {
  chats: Chat[];
  unreadCount: number;
  loading: boolean;
}

const ChatContext = createContext<ChatContextValue>({ chats: [], unreadCount: 0, loading: true });

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { appUser } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <ChatContext.Provider value={{ chats, unreadCount, loading }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => useContext(ChatContext);

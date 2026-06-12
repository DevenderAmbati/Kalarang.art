import React, { createContext, useContext, useState, useCallback } from "react";
import {
  AdvisorMessage,
  getOrCreateAdvisorSessionId,
} from "../services/artAdvisorService";
import { CreateCommissionPayload } from "../services/commissionService";

interface ArtAdvisorState {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  sessionId: string;
  messages: AdvisorMessage[];
  setMessages: React.Dispatch<React.SetStateAction<AdvisorMessage[]>>;
  referenceFiles: File[];
  setReferenceFiles: React.Dispatch<React.SetStateAction<File[]>>;
  pendingCommissionPayload: CreateCommissionPayload | null;
  setPendingCommissionPayload: React.Dispatch<React.SetStateAction<CreateCommissionPayload | null>>;
  resetSession: () => void;
}

const ArtAdvisorContext = createContext<ArtAdvisorState | null>(null);

export const ArtAdvisorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState(getOrCreateAdvisorSessionId);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [pendingCommissionPayload, setPendingCommissionPayload] = useState<CreateCommissionPayload | null>(null);

  const resetSession = useCallback(() => {
    const newId = crypto.randomUUID();
    sessionStorage.setItem("kalarang_advisor_session_id", newId);
    setSessionId(newId);
    setMessages([]);
    setReferenceFiles([]);
    setPendingCommissionPayload(null);
  }, []);

  return (
    <ArtAdvisorContext.Provider
      value={{
        isOpen, setIsOpen,
        sessionId, messages, setMessages,
        referenceFiles, setReferenceFiles,
        pendingCommissionPayload, setPendingCommissionPayload,
        resetSession,
      }}
    >
      {children}
    </ArtAdvisorContext.Provider>
  );
};

export function useArtAdvisor() {
  const ctx = useContext(ArtAdvisorContext);
  if (!ctx) throw new Error("useArtAdvisor must be inside ArtAdvisorProvider");
  return ctx;
}

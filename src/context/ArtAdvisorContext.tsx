import React, { createContext, useContext, useState, useCallback } from "react";
import {
  AdvisorMessage,
  AdvisorProgress,
  AdvisorIntent,
  getOrCreateAdvisorSessionId,
  resetAdvisorSessionId,
} from "../services/artAdvisorService";
import { CreateCommissionPayload } from "../services/commissionService";

interface ArtAdvisorState {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  sessionId: string;
  messages: AdvisorMessage[];
  setMessages: React.Dispatch<React.SetStateAction<AdvisorMessage[]>>;
  progress: AdvisorProgress | null;
  setProgress: React.Dispatch<React.SetStateAction<AdvisorProgress | null>>;
  intent: AdvisorIntent;
  setIntent: React.Dispatch<React.SetStateAction<AdvisorIntent>>;
  isHydrated: boolean;
  setIsHydrated: React.Dispatch<React.SetStateAction<boolean>>;
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
  const [progress, setProgress] = useState<AdvisorProgress | null>(null);
  const [intent, setIntent] = useState<AdvisorIntent>("general");
  const [isHydrated, setIsHydrated] = useState(false);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [pendingCommissionPayload, setPendingCommissionPayload] = useState<CreateCommissionPayload | null>(null);

  const resetSession = useCallback(() => {
    setSessionId(resetAdvisorSessionId());
    setMessages([]);
    setProgress(null);
    setIntent("general");
    setIsHydrated(true);
    setReferenceFiles([]);
    setPendingCommissionPayload(null);
  }, []);

  return (
    <ArtAdvisorContext.Provider
      value={{
        isOpen, setIsOpen,
        sessionId, messages, setMessages,
        progress, setProgress,
        intent, setIntent,
        isHydrated, setIsHydrated,
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

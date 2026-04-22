import React, { useEffect } from 'react';
import './ChatImageModal.css';

interface ChatImageModalProps {
  url: string;
  isHd?: boolean;
  downloading?: boolean;
  onDownload: () => void;
  onClose: () => void;
}

const ChatImageModal: React.FC<ChatImageModalProps> = ({ url, isHd, downloading, onDownload, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="cim-overlay" onClick={onClose} role="dialog" aria-modal>
      <div className="cim-box" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cim-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="cim-image-wrap">
          {isHd && <span className="cim-hd-badge">HD</span>}
          <img src={url} alt="" className="cim-image" />
        </div>

        <div className="cim-footer">
          <button
            type="button"
            className="cim-download-btn"
            onClick={onDownload}
            disabled={downloading}
            aria-label="Download image"
          >
            {downloading ? (
              <span className="cim-spinner" aria-hidden />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
            {downloading ? 'Downloading…' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatImageModal;

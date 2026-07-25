import React, { useEffect } from 'react';
import { MdArrowForward } from 'react-icons/md';
import { getBrushOwlPlayStoreUrl } from '../../utils/webMigration';
import './kalarangMigration.css';

const KalarangMigration: React.FC = () => {
  const playStoreUrl = getBrushOwlPlayStoreUrl();

  useEffect(() => {
    document.title = 'Kalarang';
    const splash = document.getElementById('splash-screen');
    if (splash) splash.remove();
    document.body.style.background = '';
  }, []);

  return (
    <div className="km-page">
      <div className="km-atmosphere" aria-hidden="true" />
      <div className="km-grain" aria-hidden="true" />

      <main className="km-stage">
        <p className="km-eyebrow">A note from the studio</p>

        <div className="km-brand">
          <img src="/logobong.png" alt="" className="km-mark" draggable={false} />
          <h1 className="km-name">Kalarang</h1>
        </div>

        <h2 className="km-headline">We&apos;ve moved on.</h2>
        <p className="km-copy">
          This app is no longer updated. The next chapter lives in{' '}
          <span className="km-dest">BrushOwl</span> — install it to keep discovering
          and commissioning art.
        </p>

        <div className="km-cta">
          {playStoreUrl ? (
            <a
              className="km-button"
              href={playStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Install BrushOwl</span>
              {MdArrowForward({ size: 18 })}
            </a>
          ) : (
            <p className="km-soon">
              BrushOwl is coming to Google Play. This screen will link the store
              listing as soon as it&apos;s live.
            </p>
          )}
        </div>

        <p className="km-footnote">
          Questions?{' '}
          <a href="mailto:hello@brushowl.com">hello@brushowl.com</a>
        </p>
      </main>
    </div>
  );
};

export default KalarangMigration;

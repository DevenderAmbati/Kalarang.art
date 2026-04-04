import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import ArtworkDetail, { Artwork as ArtworkDetailType, Artist } from '../../components/Artwork/ArtworkDetail';
import LoadingState from '../../components/State/LoadingState';
import ChatDrawer, { ChatContact } from '../../components/Chat/ChatDrawer';
import { useAuth } from '../../context/AuthContext';
import { getArtwork, incrementArtworkViews, incrementArtworkReachOutClicks } from '../../services/artworkService';
import { processBuyNow } from '../../services/chatService';
import { createNotification } from '../../services/notificationService';
import { getUserProfile } from '../../services/userService';
import { useFavorites } from '../../hooks/useCachedData';
import { cache, cacheKeys } from '../../utils/cache';
import {
  saveArtworkToFavorites,
  removeArtworkFromFavorites,
  isArtworkInFavorites,
  followArtist,
  unfollowArtist,
  isFollowingArtist
} from '../../services/interactionService';
import { toast } from 'react-toastify';
import lineArt1Animation from '../../animations/Line art (1).json';
import '../../components/Modals/ConfirmModal.css';
import '../../pages/user/Commissions.css';

const CardDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [artwork, setArtwork] = useState<ArtworkDetailType | null>(null);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [reachOutMessage, setReachOutMessage] = useState<string>('');
  const [buyNowOpen, setBuyNowOpen] = useState(false);
  const [buyNowConfirm, setBuyNowConfirm] = useState(false);
  const [buyNowBusy, setBuyNowBusy] = useState(false);
  const [buyNowAddress, setBuyNowAddress] = useState({ name: '', line1: '', line2: '', city: '', pincode: '', phone: '' });
  const [artistUpiId, setArtistUpiId] = useState<string | null>(null);
  const [fetchingUpiId, setFetchingUpiId] = useState(false);
  
  const { data: favoriteIds, updateCache: updateFavoritesCache, refetch: refetchFavorites } = useFavorites(appUser?.uid);

  // Listen for favorites changes from other components
  useEffect(() => {
    const handleFavoritesChanged = ((e: CustomEvent) => {
      if (e.detail.userId === appUser?.uid) {
        refetchFavorites();
      }
    }) as EventListener;
    
    window.addEventListener('favorites-changed', handleFavoritesChanged);
    return () => window.removeEventListener('favorites-changed', handleFavoritesChanged);
  }, [appUser?.uid, refetchFavorites]);

  useEffect(() => {
    // Set default source route if none exists (e.g., direct link access)
    if (!sessionStorage.getItem('artworkSourceRoute')) {
      sessionStorage.setItem('artworkSourceRoute', '/home');
    }
    
    if (id) {
      loadArtwork();
    }
  }, [id, appUser]);

  const loadArtwork = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const fetchedArtwork = await getArtwork(id);
      
      if (!fetchedArtwork) {
        toast.error('Artwork not found');
        navigate('/home');
        return;
      }

      // Increment view count (non-blocking)
      try {
        await incrementArtworkViews(id);
      } catch {
        // Don't block artwork display if view count update fails
      }

      // Convert to ArtworkDetailType
      const artworkDetail: ArtworkDetailType = {
        id: parseInt(fetchedArtwork.id) || 0,
        title: fetchedArtwork.title,
        artworkImage: fetchedArtwork.images[0],
        thumbnails: fetchedArtwork.images.slice(1, 5),
        category: fetchedArtwork.category,
        medium: fetchedArtwork.medium,
        size: fetchedArtwork.width && fetchedArtwork.height 
          ? `${fetchedArtwork.width}" × ${fetchedArtwork.height}"`
          : 'Size not specified',
        createdOn: fetchedArtwork.createdDate || fetchedArtwork.createdAt.toLocaleDateString(),
        price: fetchedArtwork.price,
        description: fetchedArtwork.description,
        sold: fetchedArtwork.sold,
      };

      setArtwork(artworkDetail);

      // Set up artist and fetch full profile data
      const artistData: Artist = {
        id: fetchedArtwork.artistId,
        name: fetchedArtwork.artistName,
        avatar: fetchedArtwork.artistAvatar || 'https://i.pravatar.cc/150?img=1',
        isFollowing: false,
      };

      // Check if user is following artist and if artwork is in favorites
      if (appUser && appUser.uid !== fetchedArtwork.artistId) {
        try {
          const following = await isFollowingArtist(appUser.uid, fetchedArtwork.artistId);
          artistData.isFollowing = following;
        } catch (error) {
        }
      }

      // Check if artwork is in favorites (for any logged-in user)
      if (appUser) {
        try {
          const saved = await isArtworkInFavorites(appUser.uid, id);
          setIsSaved(saved);
        } catch (error) {
        }
      }

      setArtist(artistData);
    } catch (error) {
      toast.error('Failed to load artwork');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (artworkId: number) => {
    if (!appUser || !id) {
      navigate('/signup');
      return;
    }

    // Optimistic update - update UI immediately
    const previousFavorites = favoriteIds || [];
    const previousIsSaved = isSaved;
    
    setIsSaved(!isSaved);
    updateFavoritesCache((oldFavorites) => {
      const favorites = oldFavorites || [];
      if (isSaved) {
        return favorites.filter(favId => favId !== id);
      } else {
        return [...favorites, id];
      }
    });

    try {
      if (isSaved) {
        await removeArtworkFromFavorites(appUser.uid, id);
      } else {
        await saveArtworkToFavorites(appUser.uid, id, appUser.name, appUser.avatar);
        toast.success('Added to favorites');
      }
      // Invalidate favorite artworks cache
      cache.invalidate(cacheKeys.favoriteArtworks(appUser.uid));
      cache.invalidate(cacheKeys.favorites(appUser.uid));
      
      // Broadcast change to other components
      window.dispatchEvent(new CustomEvent('favorites-changed', { detail: { userId: appUser.uid } }));
    } catch (error) {
      // Rollback optimistic update on error
      setIsSaved(previousIsSaved);
      updateFavoritesCache(() => previousFavorites);
      toast.error('Failed to update favorites');
    }
  };

  const handleShare = (artworkId: number) => {
    if (navigator.share && artwork) {
      navigator.share({
        title: artwork.title,
        text: `Check out this artwork: ${artwork.title}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleBuyNow = async (artistId: string) => {
    if (!appUser) { navigate('/signup'); return; }
    if (appUser.uid === artistId) { toast.info('You cannot buy your own artwork'); return; }
    
    // Fetch artist's UPI ID
    setFetchingUpiId(true);
    try {
      const artistProfile = await getUserProfile(artistId);
      setArtistUpiId(artistProfile?.upiId || null);
      
      // Send notification if UPI ID is not set
      if (!artistProfile?.upiId || artistProfile.upiId.trim() === '') {
        createNotification(
          artistId,
          'payment_failed_no_upi',
          appUser.uid,
          appUser.name || 'A buyer',
          appUser.avatar,
          id,
          artwork?.title
        ).catch(() => {}); // Silent fail
      }
    } catch {
      setArtistUpiId(null);
    } finally {
      setFetchingUpiId(false);
    }
    
    setBuyNowOpen(true);
    setBuyNowConfirm(false);
    setBuyNowAddress({ name: '', line1: '', line2: '', city: '', pincode: '', phone: '' });
  };

  const handleConfirmBuyNow = async () => {
    if (!appUser || !artwork || !artist || !id) return;
    setBuyNowBusy(true);
    try {
      await processBuyNow(
        appUser.uid,
        artist.id,
        id,
        artwork.title,
        artwork.artworkImage,
        String(artwork.price),
        buyNowAddress,
      );
      createNotification(
        artist.id,
        'commission_offer_accepted',
        appUser.uid,
        appUser.name,
        appUser.avatar,
        id,
        artwork.title,
        artwork.artworkImage,
        undefined,
        undefined,
        artwork.title,
        'payment_done',
      ).catch(() => {});
      setBuyNowOpen(false);
      setBuyNowConfirm(false);
      setBuyNowAddress({ name: '', line1: '', line2: '', city: '', pincode: '', phone: '' });
      setArtwork((prev) => prev ? { ...prev, sold: true } : prev);
      window.dispatchEvent(new CustomEvent('artwork-sold', { detail: { artworkId: id } }));
      // Invalidate all artwork listing caches so sold badge appears everywhere
      cache.invalidate(cacheKeys.homeFeedPaginated(appUser.uid));
      cache.invalidate(cacheKeys.homeFeedPaginated());
      cache.invalidate(cacheKeys.discoverPaginated('featured'));
      cache.invalidate(cacheKeys.discoverPaginated('newest'));
      if (id) cache.invalidate(cacheKeys.artwork(id));
      if (artist) {
        cache.invalidate(cacheKeys.artistWorks(artist.id));
        cache.invalidate(cacheKeys.publishedWorks(artist.id));
        cache.invalidate(cacheKeys.otherUserPortfolio(artist.id));
      }
      toast.success('Payment recorded! The artist has been notified to ship your artwork.');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Buy now failed:', err);
      toast.error('Could not complete purchase. Please try again.');
    } finally {
      setBuyNowBusy(false);
    }
  };

  const handleReachOut = (artistId: string) => {
    if (!appUser) {
      navigate('/signup');
      return;
    }

    if (appUser.uid === artistId) {
      toast.info('You cannot reach out to yourself');
      return;
    }

    if (!artist || !artwork) return;

    // eslint-disable-next-line no-console
    console.log('CardDetail - Opening chat with artworkId:', id, 'title:', artwork.title);

    // Track reach-out intent click without blocking chat open
    if (id) {
      incrementArtworkReachOutClicks(id).catch(() => {});
    }
    
    // Don't set a predefined message, let the user type their own
    setChatDrawerOpen(true);
  };

  const handleFollow = async (artistId: string) => {
    if (!appUser) {
      navigate('/signup');
      return;
    }

    if (!artist) return;

    try {
      if (artist.isFollowing) {
        await unfollowArtist(appUser.uid, artistId);
        setArtist({ ...artist, isFollowing: false });
      } else {
        await followArtist(appUser.uid, artistId, appUser.name, appUser.avatar);
        setArtist({ ...artist, isFollowing: true });
      }
      
      // Broadcast change to other components
      window.dispatchEvent(new CustomEvent('follow-changed', { detail: { userId: appUser.uid } }));
    } catch (error) {
      toast.error('Failed to update follow status');
    }
  };

  const handleThumbnailClick = (_imageUrl: string) => {};

  const handleArtistClick = (artistId: string) => {
    if (!appUser) {
      navigate('/signup');
      return;
    }
    const isOwnProfile = artistId === appUser.uid;
    if (!isOwnProfile) {
      const currentSource = sessionStorage.getItem('artworkSourceRoute');
      if (!currentSource || currentSource.startsWith('/card/')) {
        sessionStorage.setItem('artworkSourceRoute', location.pathname);
      }
    }
    navigate(isOwnProfile ? '/portfolio' : `/portfolio/${artistId}`);
  };

  if (loading || !artwork || !artist) {
    return (
      <LoadingState 
        animation={lineArt1Animation}
        message="Loading artwork details..." 
        fullHeight 
      />
    );
  }

  return (
    <>
      <ArtworkDetail
        artwork={artwork}
        artist={artist}
        currentUserAvatar={appUser?.email ? `https://ui-avatars.com/api/?name=${encodeURIComponent(appUser.name || appUser.email)}` : undefined}
        onShare={handleShare}
        onReachOut={handleReachOut}
        onBuyNow={appUser && appUser.uid !== artist.id ? handleBuyNow : undefined}
        onFollow={handleFollow}
        onThumbnailClick={handleThumbnailClick}
        onArtistClick={handleArtistClick}
        onSave={handleLike}
        isSaved={isSaved}
        currentUserId={appUser?.uid}
      />

      {buyNowOpen && artwork && createPortal(
        <div
          className="confirm-modal-overlay"
          role="presentation"
          style={{ zIndex: 10002 }}
          onClick={() => { if (!buyNowBusy) { setBuyNowOpen(false); setBuyNowConfirm(false); } }}
        >
          <div
            className="confirm-modal-content commission-accept-offer-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="commission-accept-offer-close"
              aria-label="Close"
              disabled={buyNowBusy}
              onClick={() => { setBuyNowOpen(false); setBuyNowConfirm(false); }}
            >×</button>
            <h2 className="confirm-modal-title">Buy Now</h2>
            <p className="confirm-modal-message">
              Complete your purchase for <strong>{artwork.title}</strong>.
            </p>

            <div className="commission-accept-address-form">
              <p className="commission-accept-address-form-title">Delivery address</p>
              <input type="text" className="commission-accept-address-input" placeholder="Full name"
                value={buyNowAddress.name} onChange={(e) => setBuyNowAddress((p) => ({ ...p, name: e.target.value }))} disabled={buyNowBusy} />
              <input type="text" className="commission-accept-address-input" placeholder="Flat / House / Building"
                value={buyNowAddress.line1} onChange={(e) => setBuyNowAddress((p) => ({ ...p, line1: e.target.value }))} disabled={buyNowBusy} />
              <input type="text" className="commission-accept-address-input" placeholder="Street / Area / Locality"
                value={buyNowAddress.line2} onChange={(e) => setBuyNowAddress((p) => ({ ...p, line2: e.target.value }))} disabled={buyNowBusy} />
              <div className="commission-accept-address-row">
                <input type="text" className="commission-accept-address-input" placeholder="City"
                  value={buyNowAddress.city} onChange={(e) => setBuyNowAddress((p) => ({ ...p, city: e.target.value }))} disabled={buyNowBusy} />
                <input type="text" className="commission-accept-address-input" placeholder="Pincode"
                  value={buyNowAddress.pincode} onChange={(e) => setBuyNowAddress((p) => ({ ...p, pincode: e.target.value }))} disabled={buyNowBusy} />
              </div>
              <input type="tel" className="commission-accept-address-input" placeholder="Phone number"
                value={buyNowAddress.phone} onChange={(e) => setBuyNowAddress((p) => ({ ...p, phone: e.target.value }))} disabled={buyNowBusy} />
            </div>

            {(() => {
              const UPI_ID = artistUpiId || null;
              const amount = String(artwork.price);
              const upiUri = UPI_ID ? `upi://pay?pa=${UPI_ID}&pn=Kalarang%20Art&am=${amount}&cu=INR` : '';
              const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
              const addressComplete = buyNowAddress.name.trim() && buyNowAddress.line1.trim() &&
                buyNowAddress.city.trim() && buyNowAddress.pincode.trim() && buyNowAddress.phone.trim();
              
              if (fetchingUpiId) {
                return (
                  <div className="commission-accept-offer-payment">
                    <p className="commission-accept-offer-payment-label">Loading payment details...</p>
                  </div>
                );
              }
              
              if (!UPI_ID) {
                return (
                  <div className="commission-accept-offer-payment">
                    <p className="commission-accept-offer-payment-label" style={{ color: 'var(--color-error, #dc2626)' }}>⚠️ Payment Not Available</p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>The artist hasn't set up their UPI ID yet. Please contact them directly or try again later.</p>
                  </div>
                );
              }
              
              return (
                <>
                  <div className="commission-accept-offer-payment">
                    <p className="commission-accept-offer-payment-label">Pay and confirm</p>
                    <div className="commission-accept-offer-amount">₹{artwork.price.toLocaleString()}</div>
                    <p className="commission-accept-offer-upiid">UPI ID: <strong>{UPI_ID}</strong></p>
                    {isMobile ? (
                      <a href={upiUri} className="button button-primary commission-accept-offer-upi-btn">Open UPI App to Pay</a>
                    ) : (
                      <div className="commission-accept-offer-qr">
                        <QRCodeSVG value={upiUri} size={180} />
                        <p className="commission-accept-offer-qr-hint">Scan to pay via UPI</p>
                      </div>
                    )}
                  </div>

                  {!addressComplete && (
                    <p className="commission-accept-address-required-hint">* Fill in all address fields to continue</p>
                  )}

                  {buyNowConfirm ? (
                    <div className="commission-make-payment-confirm-block">
                      <p className="commission-payment-confirm-tooltip-q">Have you made the payment?</p>
                      <div className="confirm-modal-actions confirm-modal-actions--row">
                        <button type="button" className="confirm-modal-btn confirm-modal-btn-cancel"
                          disabled={buyNowBusy} onClick={() => setBuyNowConfirm(false)}>No</button>
                        <button type="button" className="confirm-modal-btn confirm-modal-btn-confirm confirm-modal-btn-info"
                          disabled={buyNowBusy || !UPI_ID} onClick={() => void handleConfirmBuyNow()}>
                          <span className="commission-hire-tooltip-confirm-inner">
                            {buyNowBusy && <span className="commission-inline-spinner commission-inline-spinner--outline" aria-hidden />}
                            {buyNowBusy ? 'Please wait…' : 'Yes'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="confirm-modal-actions confirm-modal-actions--row">
                      <button type="button" className="confirm-modal-btn confirm-modal-btn-cancel"
                        disabled={buyNowBusy} onClick={() => { setBuyNowOpen(false); setBuyNowConfirm(false); }}>Cancel</button>
                      <button type="button" className="confirm-modal-btn confirm-modal-btn-confirm confirm-modal-btn-info"
                        disabled={buyNowBusy || !addressComplete || !UPI_ID}
                        title={!addressComplete ? 'Please fill in all address fields' : !UPI_ID ? 'Artist UPI ID not available' : undefined}
                        onClick={() => setBuyNowConfirm(true)}>Confirm Purchase</button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {appUser && artwork && artist && id && (
        <ChatDrawer
          isOpen={chatDrawerOpen}
          onClose={() => {
            setChatDrawerOpen(false);
            setReachOutMessage('');
          }}
          initialContact={{ uid: artist.id, name: artist.name, avatar: artist.avatar } as ChatContact}
          initialMessage={reachOutMessage || undefined}
          reachOutMetadata={{
            artworkId: id,
            artworkTitle: artwork.title,
            artworkImage: artwork.artworkImage,
            artworkPrice: artwork.price
          }}
        />
      )}
    </>
  );
};

export default CardDetail;
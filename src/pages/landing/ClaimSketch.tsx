import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { MdHome, MdPerson, MdReceiptLong, MdImage, MdLocationOn, MdMyLocation, MdContentCopy, MdCheckCircle } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { submitFreeSketchRequest } from '../../services/freeSketchService';
import '../auth/login.css';
import './claimSketch.css';

const UPI_ID = '9640557113@ptsbi';
const PAYEE_NAME = 'BrushOwl';
const AMOUNT = '99';

type CopyType = 'physical' | 'digital';
type FormCopyType = CopyType | '';

const ClaimSketch: React.FC = () => {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [orderId, setOrderId] = useState('');
  const [copyType, setCopyType] = useState<FormCopyType>('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [refImage, setRefImage] = useState<File | null>(null);
  const [refImagePreview, setRefImagePreview] = useState<string | null>(null);
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [paymentScreenshotPreview, setPaymentScreenshotPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paymentInputRef = useRef<HTMLInputElement>(null);

  const upiDeepLink = useMemo(() => {
    const params = new URLSearchParams({
      pa: UPI_ID,
      pn: PAYEE_NAME,
      am: AMOUNT,
      cu: 'INR',
      tn: 'BrushOwl Free Sketch',
    });
    return `upi://pay?${params.toString()}`;
  }, []);

  const qrUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(upiDeepLink)}`;
  }, [upiDeepLink]);

  const handleFile = (file: File | null) => {
    if (!file) {
      setRefImage(null);
      setRefImagePreview(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image must be smaller than 8MB');
      return;
    }
    setRefImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setRefImagePreview((e.target?.result as string) ?? null);
    reader.readAsDataURL(file);
  };

  const handlePaymentFile = (file: File | null) => {
    if (!file) {
      setPaymentScreenshot(null);
      setPaymentScreenshotPreview(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Screenshot must be smaller than 8MB');
      return;
    }
    setPaymentScreenshot(file);
    const reader = new FileReader();
    reader.onload = (e) => setPaymentScreenshotPreview((e.target?.result as string) ?? null);
    reader.readAsDataURL(file);
  };

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      toast.success('UPI ID copied');
    } catch {
      toast.error('Could not copy. Long-press to select.');
    }
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Please enter your name';
    if (!/^\+?\d{10,13}$/.test(whatsapp.trim())) return 'Enter a valid WhatsApp number';
    if (!orderId.trim()) return 'Please enter your Order ID';
    if (!refImage) return 'Please upload a reference image';
    if (!copyType) return 'Please select a format';
    if (copyType === 'physical') {
      if (!address.trim()) return 'Please enter your shipping address';
      if (!/^\d{6}$/.test(pincode.trim())) return 'Enter a valid 6-digit pincode';
      if (!paymentScreenshot) return 'Please upload your payment screenshot';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const err = validate();
    if (err) {
      setError(err);
      toast.error(err);
      return;
    }
    if (!refImage) return;
    setSubmitting(true);
    try {
      await submitFreeSketchRequest(
        {
          name,
          whatsapp,
          orderId,
          copyType: copyType as CopyType,
          address: copyType === 'physical' ? address : undefined,
          pincode: copyType === 'physical' ? pincode : undefined,
        },
        refImage,
        copyType === 'physical' ? paymentScreenshot : null,
      );
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (submitErr) {
      const message = submitErr instanceof Error ? submitErr.message : 'Could not submit your request. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="login-right-section signup-page claim-sketch-signup-page"
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        minHeight: '100vh',
        width: '100%',
        position: 'relative',
        padding: '3rem 0',
      }}
    >
      {/* Decorative background shapes (same as signup) */}
      <div className="login-bg-shape-1"></div>
      <div className="login-bg-shape-2"></div>
      <div className="login-bg-shape-3"></div>
      <div className="login-bg-shape-4"></div>
      <div className="login-bg-shape-5"></div>
      <div className="login-bg-circle-1"></div>
      <div className="login-bg-circle-2"></div>
      <div className="login-bg-dot-pattern"></div>

      <div style={{ maxWidth: '500px', width: '100%', zIndex: 10, margin: '2rem 0' }}>
        {/* Back to Home */}
        <button
          className="login-home-button"
          onClick={() => navigate('/')}
          style={{
            position: 'absolute',
            top: '2rem',
            left: '2rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--color-primary)',
            fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '500px',
            transition: 'all 0.3s ease',
            zIndex: 20,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-alpha-10)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {MdHome({ size: 20 })}
          <span>Home</span>
        </button>

        {/* Mobile header */}
        <div className="login-mobile-header">
          <div className="login-brand-stack login-mobile-logo">
            <img src="/logobong.png" alt="BrushOwl Logo" className="login-brand-icon" />
            <div className="login-brand-text-stack">
              <img src="/text logo.png" alt="BrushOwl" className="login-brand-text" />
            </div>
          </div>
          <h1 className="login-mobile-headline">Claim your free sketch</h1>
          <p className="login-mobile-subtext">A hand-drawn sketch worth ₹1000, on us.</p>
        </div>

        <div className="login-form-container" style={{ padding: '1rem' }}>
          <div className="login-header" style={{ marginBottom: '0.5rem' }}>
            <div className="login-welcome-back" style={{ fontSize: '0.7rem', marginBottom: '0.15rem' }}>Limited Time Offer</div>
            <h2 className="login-title" style={{ fontSize: '1.1rem', marginBottom: '0' }}>
              Free Sketch worth ₹1000 on your first order
            </h2>
          </div>

          {submitted ? (
            <div className="claim-sketch-success-inner">
              <span className="claim-sketch-success-icon">
                {MdCheckCircle({ size: 44 })}
              </span>
              <h3>Request Submitted!</h3>
              <p>
                Thanks <strong>{name.split(' ')[0] || 'there'}</strong>! We'll verify your payment and reach out on
                {' '}<strong>WhatsApp ({whatsapp})</strong> with sketch updates within 24 hours.
              </p>
              <div className="claim-sketch-success-info">
                <span>
                  {FaWhatsapp({ size: 16 })}
                  You will receive sketch updates on WhatsApp.
                </span>
              </div>
              <button
                type="button"
                className="login-button primary-cta"
                onClick={() => navigate('/')}
              >
                Back to Home
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-form" style={{ gap: '0.8rem' }}>
              {/* Name */}
              <div className="login-input-group" style={{ marginBottom: '0.35rem' }}>
                <div className="login-input-wrapper">
                  {MdPerson({ className: 'login-input-svg-icon', size: 18 })}
                  <input
                    type="text"
                    className="login-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                  <label className={`login-floating-label ${name ? 'login-floating-label-active' : ''}`}>
                    Full Name (same as in your profile)
                  </label>
                </div>
              </div>

              {/* WhatsApp */}
              <div className="login-input-group" style={{ marginBottom: '0.35rem' }}>
                <div className="login-input-wrapper">
                  {FaWhatsapp({ className: 'login-input-svg-icon', size: 18 })}
                  <input
                    type="tel"
                    inputMode="tel"
                    className="login-input"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value.replace(/[^\d+]/g, ''))}
                    required
                  />
                  <label className={`login-floating-label ${whatsapp ? 'login-floating-label-active' : ''}`}>
                    WhatsApp Number
                  </label>
                </div>
              </div>

              {/* Order ID */}
              <div className="login-input-group" style={{ marginBottom: '0.35rem' }}>
                <div className="login-input-wrapper">
                  {MdReceiptLong({ className: 'login-input-svg-icon', size: 18 })}
                  <input
                    type="text"
                    className="login-input"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    required
                  />
                  <label className={`login-floating-label ${orderId ? 'login-floating-label-active' : ''}`}>
                    Order ID (of the order you have placed)
                  </label>
                </div>
              </div>

              {/* Reference image */}
              <div className="login-input-group" style={{ marginBottom: '0.35rem' }}>
                <label className="claim-sketch-section-label">Reference Image</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                {refImagePreview ? (
                  <div className="claim-sketch-image-preview">
                    <img src={refImagePreview} alt="Reference preview" />
                    <div className="claim-sketch-image-actions">
                      <button
                        type="button"
                        className="claim-sketch-image-btn"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        className="claim-sketch-image-btn claim-sketch-image-btn--danger"
                        onClick={() => handleFile(null)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="claim-sketch-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {MdImage({ size: 22 })}
                    <span>Choose Image</span>
                    <span className="claim-sketch-upload-hint">PNG, JPG up to 8MB</span>
                  </button>
                )}
              </div>

              {/* Format */}
              <div className="login-input-group" style={{ marginBottom: '0.35rem' }}>
                <label className="claim-sketch-section-label">Format</label>
                <div className="claim-sketch-copy-options">
                  <label className={`claim-sketch-copy-option ${copyType === 'digital' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="copyType"
                      value="digital"
                      checked={copyType === 'digital'}
                      onChange={() => setCopyType('digital')}
                    />
                    <span className="claim-sketch-copy-title">Digital</span>
                    <span className="claim-sketch-copy-sub">High-res PDF on WhatsApp</span>
                  </label>

                  <label className={`claim-sketch-copy-option ${copyType === 'physical' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="copyType"
                      value="physical"
                      checked={copyType === 'physical'}
                      onChange={() => setCopyType('physical')}
                    />
                    <span className="claim-sketch-copy-title">Physical</span>
                    <span className="claim-sketch-copy-sub">Original sketch shipped to you</span>
                  </label>
                </div>
              </div>

              {/* Address (only if Physical) */}
              {copyType === 'physical' && (
                <>
                  <div className="login-input-group" style={{ marginBottom: '0.35rem' }}>
                    <div className="login-input-wrapper">
                      {MdLocationOn({ className: 'login-input-svg-icon', size: 18 })}
                      <textarea
                        className="login-input claim-sketch-textarea"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        rows={3}
                        required
                      />
                      <label className={`login-floating-label ${address ? 'login-floating-label-active' : ''}`}>
                        Shipping Address
                      </label>
                    </div>
                  </div>

                  <div className="login-input-group" style={{ marginBottom: '0.35rem' }}>
                    <div className="login-input-wrapper">
                      {MdMyLocation({ className: 'login-input-svg-icon', size: 18 })}
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        className="login-input"
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                        required
                      />
                      <label className={`login-floating-label ${pincode ? 'login-floating-label-active' : ''}`}>
                        Pincode
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* Payment block — only for physical copy */}
              {copyType === 'physical' && (
                <div className="claim-sketch-payment-block">
                  <div className="claim-sketch-payment-head">
                    <span className="claim-sketch-payment-title">Pay ₹99 for delivery</span>
                  </div>
                  <div className="claim-sketch-payment-grid">
                    <div className="claim-sketch-qr-wrap">
                      <img src={qrUrl} alt="UPI QR code for ₹99 to BrushOwl" className="claim-sketch-qr" />
                      <span className="claim-sketch-qr-amount">₹99</span>
                    </div>
                    <div className="claim-sketch-upi">
                      <span className="claim-sketch-upi-label">UPI ID</span>
                      <div className="claim-sketch-upi-row">
                        <span className="claim-sketch-upi-id">{UPI_ID}</span>
                        <button
                          type="button"
                          className="claim-sketch-upi-copy"
                          onClick={copyUpi}
                          aria-label="Copy UPI ID"
                        >
                          {MdContentCopy({ size: 14 })}
                          <span>Copy</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Payment screenshot upload */}
                  <div className="claim-sketch-payment-screenshot">
                    <span className="claim-sketch-payment-screenshot-label">Upload Payment Screenshot</span>
                    <input
                      ref={paymentInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => handlePaymentFile(e.target.files?.[0] ?? null)}
                    />
                    {paymentScreenshotPreview ? (
                      <div className="claim-sketch-image-preview">
                        <img src={paymentScreenshotPreview} alt="Payment screenshot preview" />
                        <div className="claim-sketch-image-actions">
                          <button
                            type="button"
                            className="claim-sketch-image-btn"
                            onClick={() => paymentInputRef.current?.click()}
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            className="claim-sketch-image-btn claim-sketch-image-btn--danger"
                            onClick={() => handlePaymentFile(null)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="claim-sketch-upload-btn"
                        onClick={() => paymentInputRef.current?.click()}
                      >
                        {MdImage({ size: 22 })}
                        <span>Upload Screenshot</span>
                        <span className="claim-sketch-upload-hint">After paying, upload your payment screenshot</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="login-button primary-cta"
                disabled={submitting}
                style={{ marginBottom: '0rem' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                  {submitting ? 'Submitting…' : 'Submit Request'}
                  {submitting ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ animation: 'spin 1s linear infinite' }}
                    >
                      <circle cx="12" cy="12" r="10" opacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
                    </svg>
                  ) : '→'}
                </span>
              </button>
              <style>{`
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>

              {error && (
                <div style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#DC2626',
                  fontSize: '0.875rem',
                }}>
                  {error}
                </div>
              )}

              <span className="claim-sketch-disclaimer">
                {FaWhatsapp({ size: 12 })}
                You will receive sketch updates on WhatsApp.
              </span>
            </form>
          )}
        </div>

        {/* Decorative corner elements */}
        <div className="login-corner-decor-1"></div>
        <div className="login-corner-decor-2"></div>
      </div>
    </div>
  );
};

export default ClaimSketch;

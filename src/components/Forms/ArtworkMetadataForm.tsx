import React from 'react';
import CustomDropdown from '../Filters/CustomDropdown';

export interface ArtworkFormData {
  title: string;
  description: string;
  createdDate: string;
  category: string;
  medium: string;
  width: string;
  height: string;
  price: string;
  isCommissioned: boolean;
}

interface ArtworkMetadataFormProps {
  formData: ArtworkFormData;
  onFormDataChange: (field: keyof ArtworkFormData, value: string) => void;
}

const ArtworkMetadataForm: React.FC<ArtworkMetadataFormProps> = ({
  formData,
  onFormDataChange,
}) => {
  const handleInputChange = (field: keyof ArtworkFormData) => 
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      onFormDataChange(field, e.target.value);
    };

  return (
    <>
      {/* Text Fields Section */}
      <div className="section">
        <h3 className="section-title">Details</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="form-label">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={handleInputChange('title')}
              placeholder="Enter artwork title"
              className="form-input"
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Created Date</label>
            <input
              type="date"
              value={formData.createdDate}
              onChange={handleInputChange('createdDate')}
              className="form-input"
            />
          </div>

          <div className="form-field full-width">
            <label className="form-label">Description *</label>
            <textarea
              value={formData.description}
              onChange={handleInputChange('description')}
              placeholder="Describe your artwork, inspiration, technique..."
              className="form-input form-textarea"
              required
            />
          </div>
        </div>
      </div>

      {/* Artwork Metadata Section */}
      <div className="section">
        <h3 className="section-title">Artwork Information</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="form-label">Category *</label>
            <CustomDropdown
              value={formData.category}
              onChange={(value) => onFormDataChange('category', value)}
              options={[
                { value: 'abstract', label: 'Abstract' },
                { value: 'landscape', label: 'Landscape' },
                { value: 'portrait', label: 'Portrait' },
                { value: 'modern', label: 'Modern' },
                { value: 'craft', label: 'Craft' },
                { value: 'digital', label: 'Digital' },
                { value: 'sculpture', label: 'Sculpture' },
              ]}
              placeholder="Select category"
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Medium *</label>
            <CustomDropdown
              value={formData.medium}
              onChange={(value) => onFormDataChange('medium', value)}
              options={[
                { value: 'acrylic', label: 'Acrylic' },
                { value: 'oil', label: 'Oil' },
                { value: 'watercolor', label: 'Watercolor' },
                { value: 'digital', label: 'Digital' },
                { value: 'graphite', label: 'Graphite' },
                { value: 'charcoal', label: 'Charcoal' },
                { value: 'colored-pencil', label: 'Colored Pencil' },
                { value: 'gouache', label: 'Gouache' },
                { value: 'pen-ink', label: 'Pen/Ink' },
              ]}
              placeholder="Select medium"
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Size (Inches) *</label>
            <div className="size-input-group">
              <div className="size-input-wrapper">
                <input
                  type="number"
                  value={formData.width}
                  onChange={handleInputChange('width')}
                  placeholder="Width"
                  className="form-input size-input-field"
                  min="0"
                  step="0.1"
                  required
                />
                <span className="size-unit">W</span>
              </div>
              <div className="size-input-wrapper">
                <input
                  type="number"
                  value={formData.height}
                  onChange={handleInputChange('height')}
                  placeholder="Height"
                  className="form-input size-input-field"
                  min="0"
                  step="0.1"
                  required
                />
                <span className="size-unit">H</span>
              </div>
              
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Price *</label>
            <div className="price-input-group">
              <span className="price-prefix">₹</span>
              <input
                type="number"
                value={formData.price}
                onChange={handleInputChange('price')}
                placeholder="0"
                className="form-input"
                min="0"
                step="1"
                required
              />
            </div>
          </div>

          <div className="form-field full-width">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Commissioned Work</label>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={formData.isCommissioned}
                  onChange={(e) => onFormDataChange('isCommissioned', e.target.checked.toString())}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            {formData.isCommissioned && (
              <div style={{
                marginTop: '0.25rem',
                padding: '0.5rem',
                backgroundColor: 'var(--color-peach-light, #FFF5E1)',
                border: '1px solid var(--color-peach, #FFD4A3)',
                borderRadius: '0.5rem',
                fontSize: '0.75rem',
                color: 'var(--color-royal, #2C2C54)',
              }}>
                <span>ℹ️ Commissioned work cannot be published</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ArtworkMetadataForm;
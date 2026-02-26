import React, { useState, useEffect } from 'react';
import './FilterPanel.css';

export interface FilterState {
  mediums: string[];
  priceRange: { min: number; max: number };
  sizes: string[];
}

export interface FilterPanelProps {
  initialFilters: FilterState;
  onApply: (filters: FilterState) => void;
  onCancel: () => void;
}

const MEDIUMS = [
  'Acrylic',
  'Oil',
  'Watercolor',
  'Digital',
  'Graphite',
  'Charcoal',
  'Colored Pencil',
  'Gouache',
  'Pen/Ink',
];

// Size categories with dimensions in inches
const SIZES = [
  { label: 'Small', minWidth: 0, maxWidth: 8, minHeight: 0, maxHeight: 8 },
  { label: 'Medium', minWidth: 8, maxWidth: 18, minHeight: 8, maxHeight: 18 },
  { label: 'Large', minWidth: 18, maxWidth: 500, minHeight: 18, maxHeight: 500 },
];

const FilterPanel: React.FC<FilterPanelProps> = ({
  initialFilters,
  onApply,
  onCancel,
}) => {
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const handleMediumToggle = (medium: string) => {
    setFilters((prev) => ({
      ...prev,
      mediums: prev.mediums.includes(medium)
        ? prev.mediums.filter((m) => m !== medium)
        : [...prev.mediums, medium],
    }));
  };

  const handlePriceChange = (type: 'min' | 'max', value: number) => {
    setFilters((prev) => ({
      ...prev,
      priceRange: {
        ...prev.priceRange,
        [type]: value,
      },
    }));
  };

  const handleSizeToggle = (size: string) => {
    setFilters((prev) => ({
      ...prev,
      sizes: prev.sizes.includes(size)
        ? prev.sizes.filter((s) => s !== size)
        : [...prev.sizes, size],
    }));
  };

  const handleCancel = () => {
    onCancel();
  };

  const handleReset = () => {
    const defaultFilters: FilterState = {
      mediums: [],
      priceRange: { min: 100, max: 200000 },
      sizes: [],
    };
    setFilters(defaultFilters);
    onApply(defaultFilters);
  };

  const handleApply = () => {
    onApply(filters);
  };

  const formatPrice = (price: number) => {
    return `₹${price.toLocaleString('en-IN')}`;
  };

  return (
    <div className="filter-panel">
      <div className="filter-panel-header">
        <h3 className="filter-panel-title">Filters</h3>
        <button
          className="filter-panel-close"
          onClick={onCancel}
          aria-label="Close filters"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="filter-panel-content">
        {/* Medium Section */}
        <div className="filter-section">
          <h4 className="filter-section-title">Medium</h4>
          <div className="filter-checkbox-list">
            {MEDIUMS.map((medium) => (
              <label key={medium} className="filter-checkbox-item">
                <input
                  type="checkbox"
                  checked={filters.mediums.includes(medium)}
                  onChange={() => handleMediumToggle(medium)}
                  className="filter-checkbox-input"
                />
                <span className="filter-checkbox-custom"></span>
                <span className="filter-checkbox-label">{medium}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Price Range Section */}
        <div className="filter-section">
          <h4 className="filter-section-title">Price</h4>
          <div className="filter-price-range">
            <div className="filter-range-values">
              <span className="filter-range-value">{formatPrice(filters.priceRange.min)}</span>
              <span className="filter-range-value">{formatPrice(filters.priceRange.max)}</span>
            </div>
            <div className="filter-range-dual">
              <div 
                className="filter-range-progress"
                style={{
                  left: `${((filters.priceRange.min - 100) / (200000 - 100)) * 100}%`,
                  width: `${((filters.priceRange.max - filters.priceRange.min) / (200000 - 100)) * 100}%`
                }}
              ></div>
              <input
                type="range"
                min="100"
                max="200000"
                step="100"
                value={filters.priceRange.min}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (value < filters.priceRange.max) {
                    handlePriceChange('min', value);
                  }
                }}
                className="filter-range-slider filter-range-min"
              />
              <input
                type="range"
                min="100"
                max="200000"
                step="100"
                value={filters.priceRange.max}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (value > filters.priceRange.min) {
                    handlePriceChange('max', value);
                  }
                }}
                className="filter-range-slider filter-range-max"
              />
            </div>
          </div>
        </div>

        {/* Size Section */}
        <div className="filter-section">
          <h4 className="filter-section-title">Size</h4>
          <div className="filter-size-pills">
            {SIZES.map((size) => (
              <button
                key={size.label}
                className={`filter-size-pill ${filters.sizes.includes(size.label) ? 'active' : ''}`}
                onClick={() => handleSizeToggle(size.label)}
                title={`${size.label}: ${size.minWidth}"-${size.maxWidth}" W × ${size.minHeight}"-${size.maxHeight}" H`}
              >
                <div className="size-pill-label">{size.label}</div>
                <div className="size-pill-dimensions">
                  {size.minWidth}"-{size.maxWidth}" W × {size.minHeight}"-{size.maxHeight}" H
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="filter-panel-footer">
        <button className="filter-btn filter-btn-secondary" onClick={handleReset}>
          Reset
        </button>
        <button className="filter-btn filter-btn-primary" onClick={handleApply}>
          Apply
        </button>
      </div>
    </div>
  );
};

export default FilterPanel;

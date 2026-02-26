import React, { useState } from 'react';
import { BsX, BsPlus, BsTrash, BsImage } from 'react-icons/bs';
import CustomDropdown from '../Filters/CustomDropdown';
import './EditProfile.css';

export interface Exhibition {
  year: string;
  title: string;
}

export interface Link {
  label: string;
  url: string;
  icon: string;
}

export interface ProfileData {
  name: string;
  avatar?: string;
  bannerImage?: string;
  bio: string;
  artStyle: string[];
  philosophy: string;
  achievements: string[];
  exhibitions: Exhibition[];
  education: string[];
  commissionStatus?: 'Open' | 'Closed';
  commissionDescription: string;
  commissionCtaText: string;
  links: Link[];
}

interface EditProfileProps {
  profileData: ProfileData;
  onSave: (data: ProfileData) => void;
  onCancel: () => void;
}

const EditProfile: React.FC<EditProfileProps> = ({
  profileData,
  onSave,
  onCancel,
}) => {
  const [formData, setFormData] = useState<ProfileData>(profileData);
  const [newArtStyle, setNewArtStyle] = useState('');
  const [newAchievement, setNewAchievement] = useState('');
  const [newEducation, setNewEducation] = useState('');
  const [newExhibition, setNewExhibition] = useState({ year: '', title: '' });
  const [newLink, setNewLink] = useState({ label: '', url: '', icon: 'portfolio' });

  const handleInputChange = (field: keyof ProfileData, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleImageUpload = (field: 'avatar' | 'bannerImage', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, [field]: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const addArtStyle = () => {
    if (newArtStyle.trim()) {
      setFormData({
        ...formData,
        artStyle: [...formData.artStyle, newArtStyle.trim()],
      });
      setNewArtStyle('');
    }
  };

  const addArtStyleFromOption = (style: string) => {
    if (!formData.artStyle.includes(style)) {
      setFormData({
        ...formData,
        artStyle: [...formData.artStyle, style],
      });
    }
  };

  const removeArtStyle = (index: number) => {
    setFormData({
      ...formData,
      artStyle: formData.artStyle.filter((_, i) => i !== index),
    });
  };

  const addAchievement = () => {
    if (newAchievement.trim()) {
      setFormData({
        ...formData,
        achievements: [...formData.achievements, newAchievement.trim()],
      });
      setNewAchievement('');
    }
  };

  const removeAchievement = (index: number) => {
    setFormData({
      ...formData,
      achievements: formData.achievements.filter((_, i) => i !== index),
    });
  };

  const addEducation = () => {
    if (newEducation.trim()) {
      setFormData({
        ...formData,
        education: [...formData.education, newEducation.trim()],
      });
      setNewEducation('');
    }
  };

  const removeEducation = (index: number) => {
    setFormData({
      ...formData,
      education: formData.education.filter((_, i) => i !== index),
    });
  };

  const addExhibition = () => {
    if (newExhibition.year.trim() && newExhibition.title.trim()) {
      setFormData({
        ...formData,
        exhibitions: [...formData.exhibitions, { ...newExhibition }],
      });
      setNewExhibition({ year: '', title: '' });
    }
  };

  const removeExhibition = (index: number) => {
    setFormData({
      ...formData,
      exhibitions: formData.exhibitions.filter((_, i) => i !== index),
    });
  };

  const addLink = () => {
    if (newLink.label.trim() && newLink.url.trim()) {
      setFormData({
        ...formData,
        links: [...formData.links, { ...newLink }],
      });
      setNewLink({ label: '', url: '', icon: 'portfolio' });
    }
  };

  const removeLink = (index: number) => {
    setFormData({
      ...formData,
      links: formData.links.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="edit-profile-overlay">
      <div className="edit-profile-modal">
        <div className="edit-profile-header">
          <h2>Edit Profile</h2>
          <button className="close-button" onClick={onCancel} aria-label="Close">
            {BsX({})}
          </button>
        </div>

        <form className="edit-profile-form" onSubmit={handleSubmit}>
          {/* Banner Image */}
       

          {/* Avatar */}
        

          {/* Name */}
          <section className="form-section">
            <h3 className="form-section-title">Name</h3>
            <input
              type="text"
              className="form-input name-input"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Your name"
              required
            />
          </section>

          {/* Bio */}
          <section className="form-section">
            <h3 className="form-section-title">Bio</h3>
            <textarea
              className="form-textarea"
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              placeholder="Tell us about yourself..."
              rows={4}
            />
          </section>

          {/* Art Style & Mediums */}
          <section className="form-section">
            <h3 className="form-section-title">Art Style & Mediums</h3>
            <div className="tags-container">
              {formData.artStyle.map((style, index) => (
                <div key={index} className="tag-item">
                  <span>{style}</span>
                  <button
                    type="button"
                    onClick={() => removeArtStyle(index)}
                    className="tag-remove"
                    aria-label="Remove"
                  >
                    {BsX({})}
                  </button>
                </div>
              ))}
            </div>
            <div className="art-style-options">
              {['Acrylic', 'Oil', 'Watercolor', 'Digital', 'Graphite', 'Charcoal', 'Colored Pencil', 'Gouache', 'Pen/Ink', 'Abstract', 'Landscape', 'Portrait', 'Modern', 'Craft', 'Sculpture'].map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => addArtStyleFromOption(style)}
                  className={`art-style-option ${formData.artStyle.includes(style) ? 'selected' : ''}`}
                  disabled={formData.artStyle.includes(style)}
                >
                  {style}
                </button>
              ))}
            </div>
          </section>

          {/* Philosophy */}
          <section className="form-section">
            <h3 className="form-section-title">Artistic Philosophy</h3>
            <textarea
              className="form-textarea"
              value={formData.philosophy}
              onChange={(e) => handleInputChange('philosophy', e.target.value)}
              placeholder="Share your artistic philosophy..."
              rows={4}
            />
          </section>

          {/* Achievements */}
          <section className="form-section">
            <h3 className="form-section-title">Achievements</h3>
            <div className="list-container">
              {formData.achievements.map((achievement, index) => (
                <div key={index} className="list-item">
                  <span>{achievement}</span>
                  <button
                    type="button"
                    onClick={() => removeAchievement(index)}
                    className="remove-button"
                    aria-label="Remove"
                  >
                    {BsTrash({})}
                  </button>
                </div>
              ))}
            </div>
            <div className="add-item-row">
              <input
                type="text"
                className="form-input"
                value={newAchievement}
                onChange={(e) => setNewAchievement(e.target.value)}
                placeholder="Add achievement"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAchievement())}
              />
              <button type="button" onClick={addAchievement} className="add-button">
                {BsPlus({})} Add
              </button>
            </div>
          </section>

          {/* Exhibitions */}
          <section className="form-section">
            <h3 className="form-section-title">Exhibitions / Recognition</h3>
            <div className="list-container">
              {formData.exhibitions.map((exhibition, index) => (
                <div key={index} className="list-item exhibition-item">
                  <div>
                    <span className="exhibition-year">{exhibition.year}</span>
                    <span className="exhibition-title">{exhibition.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExhibition(index)}
                    className="remove-button"
                    aria-label="Remove"
                  >
                    {BsTrash({})}
                  </button>
                </div>
              ))}
            </div>
            <div className="add-exhibition-row">
              <input
                type="text"
                className="form-input small"
                value={newExhibition.year}
                onChange={(e) => setNewExhibition({ ...newExhibition, year: e.target.value })}
                placeholder="Year"
              />
              <input
                type="text"
                className="form-input"
                value={newExhibition.title}
                onChange={(e) => setNewExhibition({ ...newExhibition, title: e.target.value })}
                placeholder="Exhibition title"
              />
              <button type="button" onClick={addExhibition} className="add-button">
                {BsPlus({})} Add
              </button>
            </div>
          </section>

          {/* Education */}
          <section className="form-section">
            <h3 className="form-section-title">Education</h3>
            <div className="list-container">
              {formData.education.map((edu, index) => (
                <div key={index} className="list-item">
                  <span>{edu}</span>
                  <button
                    type="button"
                    onClick={() => removeEducation(index)}
                    className="remove-button"
                    aria-label="Remove"
                  >
                    {BsTrash({})}
                  </button>
                </div>
              ))}
            </div>
            <div className="add-item-row">
              <input
                type="text"
                className="form-input"
                value={newEducation}
                onChange={(e) => setNewEducation(e.target.value)}
                placeholder="Add education"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEducation())}
              />
              <button type="button" onClick={addEducation} className="add-button">
                {BsPlus({})} Add
              </button>
            </div>
          </section>

          {/* Commissions */}
          <section className="form-section">
            <h3 className="form-section-title">Commissions</h3>
            <div className="commission-status-row">
              <label className="radio-label">
                <input
                  type="radio"
                  name="commissionStatus"
                  value="Open"
                  checked={formData.commissionStatus === 'Open'}
                  onChange={(e) => handleInputChange('commissionStatus', e.target.value as 'Open' | 'Closed')}
                />
                <span>Open</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="commissionStatus"
                  value="Closed"
                  checked={formData.commissionStatus === 'Closed'}
                  onChange={(e) => handleInputChange('commissionStatus', e.target.value as 'Open' | 'Closed')}
                />
                <span>Closed</span>
              </label>
            </div>
            <textarea
              className="form-textarea"
              value={formData.commissionDescription}
              onChange={(e) => handleInputChange('commissionDescription', e.target.value)}
              placeholder="Commission description"
              rows={3}
            />
            {formData.commissionStatus === 'Open' && (
              <input
                type="text"
                className="form-input"
                value={formData.commissionCtaText}
                onChange={(e) => handleInputChange('commissionCtaText', e.target.value)}
                placeholder="Call to action text (e.g., 'Get in Touch')"
              />
            )}
          </section>

          {/* Links */}
          <section className="form-section">
            <h3 className="form-section-title">Links</h3>
            <div className="list-container">
              {formData.links.map((link, index) => (
                <div key={index} className="list-item link-item">
                  <div>
                    <span className="link-label">{link.label}</span>
                    <span className="link-url">{link.url}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLink(index)}
                    className="remove-button"
                    aria-label="Remove"
                  >
                    {BsTrash({})}
                  </button>
                </div>
              ))}
            </div>
            <div className="add-link-row">
              <CustomDropdown
                value={newLink.icon}
                onChange={(value) => setNewLink({ ...newLink, icon: value })}
                options={[
                  { value: 'instagram', label: 'Instagram' },
                  { value: 'portfolio', label: 'Portfolio' },
                  { value: 'website', label: 'Website' },
                  { value: 'other', label: 'Other' },
                ]}
                placeholder="Select platform"
              />
              <input
                type="text"
                className="form-input"
                value={newLink.label}
                onChange={(e) => setNewLink({ ...newLink, label: e.target.value })}
                placeholder="Label"
              />
              <input
                type="url"
                className="form-input"
                value={newLink.url}
                onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                placeholder="URL"
              />
              <button type="button" onClick={addLink} className="add-button">
                {BsPlus({})} Add
              </button>
            </div>
          </section>

          {/* Form Actions */}
          <div className="form-actions">
            <button type="button" onClick={onCancel} className="button-secondary">
              Cancel
            </button>
            <button type="submit" className="button-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfile;

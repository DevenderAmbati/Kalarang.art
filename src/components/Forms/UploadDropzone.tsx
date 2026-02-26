import React from 'react';

interface UploadDropzoneProps {
  onFileSelect: (files: File[]) => void;
  isDragActive: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (files: File[]) => void;
}

const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  onFileSelect,
  isDragActive,
  onDragEnter,
  onDragLeave,
  onDrop,
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    onFileSelect(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    onDragEnter();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    onDragLeave();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    onDrop(files);
  };

  return (
    <div
      className={`upload-dropzone ${isDragActive ? 'drag-active' : ''}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <p className="upload-dropzone-text">Click to upload or drag and drop</p>
      <p className="upload-dropzone-subtext">PNG, JPG, JPEG up to 10MB each</p>
      <input
        type="file"
        accept="image/png,image/jpg,image/jpeg"
        multiple
        onChange={handleInputChange}
        className="upload-dropzone-input"
      />
    </div>
  );
};

export default UploadDropzone;
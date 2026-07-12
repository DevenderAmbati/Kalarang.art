import React from 'react';

interface UploadDropzoneProps {
  onFileSelect: (files: File[]) => void;
  isDragActive: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
}

const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  onFileSelect,
  isDragActive,
  onDragEnter,
  onDragLeave,
  onDrop,
  multiple = true,
  disabled = false,
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    onFileSelect(files);
    e.target.value = "";
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
      className={`upload-dropzone ${isDragActive ? 'drag-active' : ''}${disabled ? ' upload-dropzone-disabled' : ''}`}
      onDragOver={disabled ? undefined : handleDragOver}
      onDragEnter={disabled ? undefined : handleDragEnter}
      onDragLeave={disabled ? undefined : handleDragLeave}
      onDrop={disabled ? undefined : handleDrop}
    >
      <p className="upload-dropzone-text">
        {disabled ? 'Reference image added — remove to replace' : 'Click to upload or drag and drop'}
      </p>
      <p className="upload-dropzone-subtext">PNG, JPG, JPEG up to 10MB{multiple ? ' each' : ''}</p>
      <input
        type="file"
        accept="image/png,image/jpg,image/jpeg"
        multiple={multiple}
        disabled={disabled}
        onChange={handleInputChange}
        
        className="upload-dropzone-input"
      />
    </div>
  );
};

export default UploadDropzone;
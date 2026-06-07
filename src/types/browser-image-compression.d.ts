declare module 'browser-image-compression' {
  interface Options {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
    maxIteration?: number;
    exifOrientation?: number;
    fileType?: string;
    initialQuality?: number;
    alwaysKeepResolution?: boolean;
    onProgress?: (progress: number) => void;
  }

  function imageCompression(file: File | Blob, options?: Options): Promise<File>;
  
  export default imageCompression;
}

import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, Link, X, Loader2, Video, RefreshCw, Image as ImageIcon, Search, Check } from 'lucide-react';
import { getApiUrl } from '../hooks/apiUrl';

interface MediaSelectorProps {
  imageUrl?: string;
  onChange: (url: string) => void;
  placeholder?: string;
}

export const MediaSelector: React.FC<MediaSelectorProps> = ({ imageUrl = '', onChange, placeholder = "Image URL or capture" }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'upload' | 'url'>(imageUrl?.startsWith('http') ? 'url' : 'upload');

  // Input refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live WebCam viewfinder modal state
  const [showWebcamModal, setShowWebcamModal] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [webcamFacing, setWebcamFacing] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);

  // App Photo Library modal state
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<Array<{ filename: string; url: string; size: number; mtime: string; attachments?: any[] }>>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [gallerySearch, setGallerySearch] = useState('');

  const startWebcam = async (facing: 'environment' | 'user' = webcamFacing) => {
    setError(null);
    setShowWebcamModal(true);
    
    // Stop any existing stream first
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      setStream(mediaStream);
      setWebcamFacing(facing);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Webcam stream error:', err);
      // Fall back to direct native camera file input if getUserMedia isn't available/permitted
      setShowWebcamModal(false);
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }
  };

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setShowWebcamModal(false);
  };

  const openAppGallery = async () => {
    setShowGalleryModal(true);
    setIsLoadingGallery(true);
    setError(null);
    try {
      const token = localStorage.getItem('freezerToken');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(getApiUrl('api/photos'), { headers });
      const contentType = res.headers.get('content-type') || '';
      
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setGalleryPhotos(Array.isArray(data) ? data : []);
      } else {
        console.warn('Non-JSON or error response fetching photo gallery:', res.status, contentType);
        setError('Failed to load existing app photos.');
      }
    } catch (err) {
      console.error('Error fetching photo gallery:', err);
      setError('Error connecting to photo library.');
    } finally {
      setIsLoadingGallery(false);
    }
  };

  // Attach stream to video element when video element is mounted
  useEffect(() => {
    if (showWebcamModal && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [showWebcamModal, stream]);

  // Clean up media stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [stream]);

  const captureWebcamPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 800;
    canvas.height = video.videoHeight || 600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      stopWebcam();
      uploadBase64Image(dataUrl, 'camera-capture.jpg');
    }
  };

  const uploadBase64Image = async (base64Str: string, filename: string) => {
    setIsUploading(true);
    setError(null);
    const img = new Image();
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);

        const token = localStorage.getItem('freezerToken');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(getApiUrl('api/upload'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ base64: compressedBase64, filename })
        });

        const contentType = res.headers.get('content-type') || '';
        if (!res.ok) {
          if (contentType.includes('application/json')) {
            const data = await res.json();
            throw new Error(data.error || 'Upload failed');
          } else {
            throw new Error(`Upload failed with status ${res.status}`);
          }
        }

        if (contentType.includes('application/json')) {
          const data = await res.json();
          onChange(data.imageUrl);
        } else {
          throw new Error('Server returned an unexpected non-JSON response.');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to upload image.');
      } finally {
        setIsUploading(false);
      }
    };

    img.onerror = () => {
      setError('Invalid image file.');
      setIsUploading(false);
    };

    img.src = base64Str;
  };

  const handleResizeAndUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        uploadBase64Image(event.target.result as string, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleResizeAndUpload(file);
    }
  };

  const filteredPhotos = galleryPhotos.filter(p => {
    if (!gallerySearch) return true;
    const q = gallerySearch.toLowerCase();
    const matchesFile = p.filename.toLowerCase().includes(q);
    const matchesAttach = p.attachments?.some(a => a.name?.toLowerCase().includes(q));
    return matchesFile || matchesAttach;
  });

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center bg-cool-gray-800 p-1 rounded-md mb-1 border border-cool-gray-700">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex-1 text-xs py-1.5 px-3 rounded-md font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${mode === 'upload' ? 'bg-cyan-600 text-white shadow' : 'text-cool-gray-400 hover:text-cool-gray-200'}`}
        >
          <Camera className="w-3.5 h-3.5" /> Photos / Camera
        </button>
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`flex-1 text-xs py-1.5 px-3 rounded-md font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${mode === 'url' ? 'bg-cyan-600 text-white shadow' : 'text-cool-gray-400 hover:text-cool-gray-200'}`}
        >
          <Link className="w-3.5 h-3.5" /> URL Link
        </button>
      </div>

      {/* Direct Camera File Input: static capture="environment" launches OS camera directly */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Photo Library File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {mode === 'upload' ? (
        <div className="border-2 border-dashed border-cool-gray-600 rounded-lg p-4 bg-cool-gray-800/30 text-center relative overflow-hidden flex flex-col items-center justify-center gap-3">
          {imageUrl ? (
            <div className="relative group w-full max-w-[200px] aspect-video rounded-md overflow-hidden border border-cool-gray-700 bg-cool-gray-900">
              <img src={imageUrl} alt="Uploaded preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onChange('')}
                className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full transition shadow-md cursor-pointer"
                title="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => startWebcam()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-700 hover:bg-cyan-600 text-xs font-bold text-white shadow transition cursor-pointer"
                  title="Stream live camera view in app"
                >
                  <Video className="w-4 h-4 text-white" /> Live Camera
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-cool-gray-700 hover:bg-cool-gray-600 text-xs text-cool-gray-200 border border-cool-gray-600 transition cursor-pointer"
                  title="Select photo from phone/computer photo library"
                >
                  <Upload className="w-4 h-4 text-purple-400" /> Choose Device File
                </button>

                <button
                  type="button"
                  onClick={openAppGallery}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-900/60 hover:bg-amber-800/80 text-xs font-bold text-amber-200 border border-amber-700/60 transition cursor-pointer"
                  title="Select from photos already uploaded in the app"
                >
                  <ImageIcon className="w-4 h-4 text-amber-400" /> App Photo Library
                </button>
              </div>
              <p className="text-[11px] text-cool-gray-400">Snap with camera, upload a device file, or pick from the app's existing photo gallery.</p>
            </>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-cool-gray-950/80 flex flex-col items-center justify-center gap-2 z-10">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              <p className="text-xs text-cool-gray-300 font-medium">Processing & Saving...</p>
            </div>
          )}
        </div>
      ) : (
        <div className="relative flex items-center">
          <input
            type="url"
            value={imageUrl || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 pr-9 bg-cool-gray-700 border border-cool-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm text-cool-gray-200 placeholder-cool-gray-400"
          />
          {imageUrl && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-2.5 text-cool-gray-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* LIVE WEBCAM MODAL */}
      {showWebcamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs font-sans animate-fadeIn">
          <div className="w-full max-w-lg bg-cool-gray-900 border border-cool-gray-750 rounded-2xl p-5 shadow-2xl flex flex-col items-center gap-4">
            <div className="w-full flex justify-between items-center pb-2 border-b border-cool-gray-800">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-cyan-400 animate-pulse" />
                <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">Live Camera Viewfinder</h3>
              </div>
              <button
                type="button"
                onClick={stopWebcam}
                className="p-1.5 text-cool-gray-400 hover:text-white rounded-lg hover:bg-cool-gray-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full aspect-4/3 rounded-xl overflow-hidden bg-black border border-cool-gray-800 shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-6 border-2 border-dashed border-cyan-400/40 rounded-xl pointer-events-none flex items-center justify-center">
                <span className="text-[10px] uppercase font-bold text-cyan-300/60 bg-black/40 px-2 py-0.5 rounded">Frame Product or Container</span>
              </div>
            </div>

            <div className="w-full flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => startWebcam(webcamFacing === 'environment' ? 'user' : 'environment')}
                className="px-3 py-2 bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-300 text-xs font-bold rounded-xl border border-cool-gray-700 transition flex items-center gap-1.5 cursor-pointer"
                title="Switch front/back camera"
              >
                <RefreshCw className="w-4 h-4 text-cyan-400" />
                <span>Switch Camera</span>
              </button>

              <button
                type="button"
                onClick={captureWebcamPhoto}
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4 text-white" />
                <span>Snap Photo</span>
              </button>

              <button
                type="button"
                onClick={stopWebcam}
                className="px-3 py-2 bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-400 text-xs font-bold rounded-xl border border-cool-gray-700 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXISTING APP PHOTO LIBRARY GALLERY MODAL */}
      {showGalleryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs font-sans animate-fadeIn">
          <div className="w-full max-w-3xl max-h-[85vh] bg-cool-gray-900 border border-cool-gray-750 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 overflow-hidden">
            <div className="w-full flex justify-between items-center pb-3 border-b border-cool-gray-800 shrink-0">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">App Photo Library</h3>
                  <p className="text-[11px] text-cool-gray-400">Select any previously uploaded photo from your inventory database</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGalleryModal(false)}
                className="p-1.5 text-cool-gray-400 hover:text-white rounded-lg hover:bg-cool-gray-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full shrink-0">
              <Search className="w-4 h-4 text-cool-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={gallerySearch}
                onChange={(e) => setGallerySearch(e.target.value)}
                placeholder="Search photos by filename or attached item name..."
                className="w-full pl-9 pr-3 py-2 bg-cool-gray-800 border border-cool-gray-700 rounded-xl text-xs text-white placeholder-cool-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Gallery Grid */}
            <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-cool-gray-700">
              {isLoadingGallery ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-cool-gray-400">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                  <p className="text-xs font-medium">Loading app photo library...</p>
                </div>
              ) : filteredPhotos.length === 0 ? (
                <div className="py-12 text-center text-cool-gray-400">
                  <p className="text-sm font-bold">No photos found in app library</p>
                  <p className="text-xs text-cool-gray-500 mt-1">Upload a new photo using Live Camera or Device File upload.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1">
                  {filteredPhotos.map((photo) => {
                    const isSelected = imageUrl === photo.url || imageUrl.endsWith('/' + photo.filename);
                    return (
                      <div
                        key={photo.filename}
                        onClick={() => {
                          onChange(photo.url);
                          setShowGalleryModal(false);
                        }}
                        className={`group relative aspect-square rounded-xl overflow-hidden border transition cursor-pointer ${
                          isSelected
                            ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-lg scale-[1.02]'
                            : 'border-cool-gray-800 hover:border-amber-500/70 hover:scale-[1.02]'
                        }`}
                      >
                        <img
                          src={photo.url.startsWith('http') || photo.url.startsWith('/') ? photo.url : getApiUrl(photo.url)}
                          alt={photo.filename}
                          className="w-full h-full object-cover bg-cool-gray-950"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 group-hover:opacity-100 transition p-2 flex flex-col justify-end">
                          <p className="text-[10px] font-bold text-white truncate">{photo.filename}</p>
                          {photo.attachments && photo.attachments.length > 0 && (
                            <p className="text-[9px] text-amber-300 truncate">
                              Attached to: {photo.attachments.map(a => a.name).join(', ')}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 p-1 bg-amber-500 text-black rounded-full font-black shadow">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-cool-gray-800 text-xs text-cool-gray-400 shrink-0">
              <span>{filteredPhotos.length} photo{filteredPhotos.length === 1 ? '' : 's'} available</span>
              <button
                type="button"
                onClick={() => setShowGalleryModal(false)}
                className="px-4 py-2 bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-200 font-bold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-xs mt-1 font-medium">{error}</p>
      )}
    </div>
  );
};



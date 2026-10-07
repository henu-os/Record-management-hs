/**
 * HENU IDF — LOCAL IMAGE TO PDF MODULE
 * Purpose: 100% Local, Offline Image (JPG, JPEG, PNG) to PDF Converter.
 * Zero Cloud, Zero APIs, Zero AI, Zero Remote Processing.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileImage, Upload, Trash2, ArrowUp, ArrowDown, RotateCw, RotateCcw,
  FileCheck, Download, Eye, RefreshCw, AlertCircle, CheckCircle2,
  ShieldCheck, ArrowLeft, Plus, Settings2, FileText, Layers, X
} from 'lucide-react';
import { IdfImageItem, IdfPdfSettings, GenerationProgress, GeneratedPdfResult } from '../../../modules/henu-idf/types';
import { IdfPdfGenerator } from '../../../modules/henu-idf/services/IdfPdfGenerator';

interface HenuIdfPageProps {
  onNavigate?: (pageId: string) => void;
}

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];

export const HenuIdfPage: React.FC<HenuIdfPageProps> = ({ onNavigate }) => {
  const [images, setImages] = useState<IdfImageItem[]>([]);
  const [settings, setSettings] = useState<IdfPdfSettings>({
    pageSize: 'A4',
    orientation: 'Auto',
    imageFit: 'Fit',
    margins: 'None',
    fileName: 'HENU_IDF.pdf',
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [generatedResult, setGeneratedResult] = useState<GeneratedPdfResult | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.objectUrl));
      if (generatedResult?.url) {
        URL.revokeObjectURL(generatedResult.url);
      }
    };
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  /**
   * Validates and loads uploaded files into state with dimensions
   */
  const handleProcessFiles = useCallback(async (fileList: FileList | File[]) => {
    setErrorMessage(null);
    const files = Array.from(fileList);
    const validFiles: File[] = [];
    const rejectedFiles: string[] = [];

    files.forEach(file => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const isSupported = SUPPORTED_EXTENSIONS.includes(ext) || SUPPORTED_MIME_TYPES.includes(file.type);
      if (isSupported) {
        validFiles.push(file);
      } else {
        rejectedFiles.push(file.name);
      }
    });

    if (rejectedFiles.length > 0) {
      setErrorMessage(`Only JPG, JPEG and PNG images are supported. Rejected non-image files: ${rejectedFiles.join(', ')}`);
    }

    if (validFiles.length === 0) {
      return;
    }

    const newItems: IdfImageItem[] = [];

    for (const file of validFiles) {
      try {
        const objectUrl = URL.createObjectURL(file);
        const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.onerror = () => reject(new Error('Corrupted or unreadable image.'));
          img.src = objectUrl;
        });

        newItems.push({
          id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type || 'image/jpeg',
          objectUrl,
          width: dimensions.width,
          height: dimensions.height,
          rotation: 0,
        });
      } catch (err: any) {
        setErrorMessage(`This image could not be loaded: ${file.name}. Please select a valid image.`);
      }
    }

    setImages(prev => [...prev, ...newItems]);
  }, []);

  // Drag and Drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFiles(e.target.files);
    }
    // Reset file input so identical file can be re-selected if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Image actions
  const handleRemoveImage = (id: string) => {
    setImages(prev => {
      const target = prev.find(img => img.id === id);
      if (target) {
        URL.revokeObjectURL(target.objectUrl);
      }
      return prev.filter(img => img.id !== id);
    });
  };

  const handleClearAll = () => {
    if (images.length === 0) return;
    if (confirm('Remove all selected images?')) {
      images.forEach(img => URL.revokeObjectURL(img.objectUrl));
      setImages([]);
      setGeneratedResult(null);
      setErrorMessage(null);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setImages(prev => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= images.length - 1) return;
    setImages(prev => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleRotateLeft = (id: string) => {
    setImages(prev =>
      prev.map(img =>
        img.id === id ? { ...img, rotation: (img.rotation - 90 + 360) % 360 } : img
      )
    );
  };

  const handleRotateRight = (id: string) => {
    setImages(prev =>
      prev.map(img =>
        img.id === id ? { ...img, rotation: (img.rotation + 90) % 360 } : img
      )
    );
  };

  // Generate PDF Action
  const handleGeneratePdf = async () => {
    if (images.length === 0) {
      setErrorMessage('Please upload at least one image.');
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);
    setProgress({
      current: 0,
      total: images.length,
      phase: 'reading',
      message: 'Preparing image assets...',
    });

    try {
      const result = await IdfPdfGenerator.generatePdf(images, settings, p => {
        setProgress(p);
      });
      setGeneratedResult(result);
    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      setErrorMessage(err.message || 'PDF generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!generatedResult) return;
    const a = document.createElement('a');
    a.href = generatedResult.url;
    a.download = generatedResult.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleResetForNew = () => {
    if (generatedResult?.url) {
      URL.revokeObjectURL(generatedResult.url);
    }
    setGeneratedResult(null);
    setProgress(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* ── Top Header Bar ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--surface, #1e293b)',
        padding: '12px 20px',
        borderRadius: 10,
        border: '1px solid var(--border, #334155)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {onNavigate && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate('dashboard')}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
            }}>
              <FileImage size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
                  HENU IDF
                </h2>
                <span style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10B981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <ShieldCheck size={12} /> 100% LOCAL & OFFLINE
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: 11, color: 'var(--text-secondary, #94a3b8)' }}>
                Local Image to PDF · Supports JPG, JPEG & PNG · Zero Cloud & Zero External APIs
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {images.length > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleClearAll}
              disabled={isGenerating}
              style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#EF4444' }}
            >
              <Trash2 size={13} /> Clear All
            </button>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isGenerating}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} /> Add Images
          </button>
        </div>
      </div>

      {/* Hidden File Picker Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/png, image/jpeg, image/jpg"
        multiple
        style={{ display: 'none' }}
      />

      {/* Error Alert Banner */}
      {errorMessage && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 8,
          padding: '10px 16px',
          color: '#EF4444',
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Generated Success Banner & Preview Option ── */}
      {generatedResult && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid #10B981',
          borderRadius: 10,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle2 size={24} color="#10B981" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>
                PDF Generated Successfully!
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary, #94a3b8)', marginTop: 2 }}>
                Filename: <strong>{generatedResult.fileName}</strong> · Pages: <strong>{generatedResult.pageCount}</strong> · Size: <strong>{formatFileSize(generatedResult.fileSize)}</strong> · Processing: <strong>100% Local</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPreviewModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Eye size={14} /> Preview PDF
            </button>

            <button
              className="btn btn-primary btn-sm"
              onClick={handleDownloadPdf}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              <Download size={14} /> Download PDF
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleResetForNew}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={13} /> Create Another PDF
            </button>
          </div>
        </div>
      )}

      {/* ── Main 2-Column Layout (Left: Upload & Image List, Right: PDF Settings & Actions) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, flex: 1, minHeight: 0 }}>
        {/* ── LEFT COLUMN: Upload Area & Image Preview Grid ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, overflowY: 'auto' }}>
          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? '#3B82F6' : 'var(--border, #334155)'}`,
              background: isDragging ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface, #1e293b)',
              borderRadius: 12,
              padding: images.length > 0 ? '20px 24px' : '40px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3B82F6',
            }}>
              <Upload size={22} />
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
              Drag & Drop images here
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #94a3b8)' }}>
              or <span style={{ color: 'var(--accent, #3b82f6)', textDecoration: 'underline', fontWeight: 600 }}>Choose Images</span> from your computer
            </div>

            <div style={{
              marginTop: 4,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: 'var(--text-muted, #64748b)',
              background: 'var(--surface-2, #0f172a)',
              padding: '3px 10px',
              borderRadius: 20,
              border: '1px solid var(--border, #334155)',
            }}>
              Supported: JPG • JPEG • PNG
            </div>
          </div>

          {/* Empty State Notice */}
          {images.length === 0 && (
            <div style={{
              background: 'var(--surface, #1e293b)',
              borderRadius: 12,
              border: '1px solid var(--border, #334155)',
              padding: 40,
              textAlign: 'center',
              color: 'var(--text-secondary, #94a3b8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}>
              <Layers size={36} style={{ opacity: 0.4 }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>No images selected.</div>
              <div style={{ fontSize: 11, maxWidth: 320 }}>
                Upload JPG, JPEG or PNG images to continue. You can add single or multiple images and arrange their page order.
              </div>
            </div>
          )}

          {/* Uploaded Images List / Reordering Grid */}
          {images.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #94a3b8)' }}>
                  Selected Images ({images.length} {images.length === 1 ? 'Page' : 'Pages'})
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>
                  Order below corresponds directly to PDF page order
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 12,
              }}>
                {images.map((item, idx) => (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--surface, #1e293b)',
                      border: '1px solid var(--border, #334155)',
                      borderRadius: 10,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      position: 'relative',
                    }}
                  >
                    {/* Page Badge + Reorder buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        background: 'var(--accent, #3b82f6)',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                      }}>
                        Page {idx + 1}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleMoveUp(idx)}
                          disabled={idx === 0 || isGenerating}
                          title="Move Up"
                          style={{ padding: '2px 6px' }}
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleMoveDown(idx)}
                          disabled={idx === images.length - 1 || isGenerating}
                          title="Move Down"
                          style={{ padding: '2px 6px' }}
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRotateLeft(item.id)}
                          disabled={isGenerating}
                          title="Rotate 90° Left"
                          style={{ padding: '2px 6px' }}
                        >
                          <RotateCcw size={12} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRotateRight(item.id)}
                          disabled={isGenerating}
                          title="Rotate 90° Right"
                          style={{ padding: '2px 6px' }}
                        >
                          <RotateCw size={12} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRemoveImage(item.id)}
                          disabled={isGenerating}
                          title="Remove Image"
                          style={{ padding: '2px 6px', color: '#EF4444' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Image Preview Card */}
                    <div style={{
                      height: 140,
                      background: '#090d16',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      position: 'relative',
                    }}>
                      <img
                        src={item.objectUrl}
                        alt={item.name}
                        style={{
                          maxHeight: '100%',
                          maxWidth: '100%',
                          objectFit: 'contain',
                          transform: `rotate(${item.rotation}deg)`,
                          transition: 'transform 0.2s ease',
                        }}
                      />
                      {item.rotation !== 0 && (
                        <span style={{
                          position: 'absolute',
                          bottom: 6,
                          right: 6,
                          background: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          fontSize: 9,
                          padding: '1px 5px',
                          borderRadius: 3,
                        }}>
                          {item.rotation}°
                        </span>
                      )}
                    </div>

                    {/* Metadata Details */}
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--text-primary, #fff)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={item.name}
                      >
                        {item.name}
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 10,
                        color: 'var(--text-secondary, #94a3b8)',
                        marginTop: 2,
                      }}>
                        <span>{item.width} × {item.height} px</span>
                        <span>{formatFileSize(item.size)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: PDF Settings & Generate Action ── */}
        <div style={{
          background: 'var(--surface, #1e293b)',
          border: '1px solid var(--border, #334155)',
          borderRadius: 12,
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          height: 'fit-content',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border, #334155)', paddingBottom: 10 }}>
            <Settings2 size={16} color="var(--accent, #3b82f6)" />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
              PDF Document Settings
            </h3>
          </div>

          {/* Setting: Page Size */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', marginBottom: 5 }}>
              PAGE SIZE
            </label>
            <select
              className="input-control"
              value={settings.pageSize}
              disabled={isGenerating}
              onChange={e => setSettings({ ...settings, pageSize: e.target.value as any })}
              style={{ width: '100%', fontSize: 12, padding: '6px 10px', borderRadius: 6 }}
            >
              <option value="A4">A4 (Standard 210 × 297 mm)</option>
              <option value="A3">A3 (Large 297 × 420 mm)</option>
              <option value="A5">A5 (Compact 148 × 210 mm)</option>
              <option value="Letter">Letter (US 8.5 × 11 in)</option>
              <option value="Legal">Legal (US 8.5 × 14 in)</option>
              <option value="Original">Original Image Size</option>
            </select>
          </div>

          {/* Setting: Orientation */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', marginBottom: 5 }}>
              ORIENTATION
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {(['Auto', 'Portrait', 'Landscape'] as const).map(ori => (
                <button
                  key={ori}
                  type="button"
                  disabled={isGenerating || settings.pageSize === 'Original'}
                  onClick={() => setSettings({ ...settings, orientation: ori })}
                  className={`btn ${settings.orientation === ori ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  style={{ fontSize: 11, padding: '6px 4px', textAlign: 'center' }}
                >
                  {ori}
                </button>
              ))}
            </div>
          </div>

          {/* Setting: Image Fit */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', marginBottom: 5 }}>
              IMAGE FIT
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[
                { key: 'Fit', label: 'Fit to Page' },
                { key: 'Fill', label: 'Fill Page' },
                { key: 'Original', label: 'Original' },
              ].map(fit => (
                <button
                  key={fit.key}
                  type="button"
                  disabled={isGenerating || settings.pageSize === 'Original'}
                  onClick={() => setSettings({ ...settings, imageFit: fit.key as any })}
                  className={`btn ${settings.imageFit === fit.key ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  style={{ fontSize: 11, padding: '6px 4px', textAlign: 'center' }}
                >
                  {fit.label}
                </button>
              ))}
            </div>
          </div>

          {/* Setting: Margins */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', marginBottom: 5 }}>
              PAGE MARGINS
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {[
                { key: 'None', label: 'No Margin' },
                { key: 'Small', label: 'Small' },
                { key: 'Medium', label: 'Medium' },
                { key: 'Large', label: 'Large' },
              ].map(m => (
                <button
                  key={m.key}
                  type="button"
                  disabled={isGenerating || settings.pageSize === 'Original'}
                  onClick={() => setSettings({ ...settings, margins: m.key as any })}
                  className={`btn ${settings.margins === m.key ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  style={{ fontSize: 10, padding: '6px 2px', textAlign: 'center' }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Setting: Output Filename */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', marginBottom: 5 }}>
              PDF FILE NAME
            </label>
            <input
              type="text"
              className="input-control"
              value={settings.fileName}
              disabled={isGenerating}
              onChange={e => setSettings({ ...settings, fileName: e.target.value })}
              placeholder="e.g. Society_Documents.pdf"
              style={{ width: '100%', fontSize: 12, padding: '6px 10px', borderRadius: 6 }}
            />
          </div>

          {/* Progress / Status Bar during generation */}
          {isGenerating && progress && (
            <div style={{
              background: 'var(--surface-2, #0f172a)',
              border: '1px solid var(--border, #334155)',
              borderRadius: 8,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--accent, #3b82f6)' }}>
                <span>{progress.message}</span>
                <span>{progress.total > 0 ? `${Math.round((progress.current / progress.total) * 100)}%` : ''}</span>
              </div>
              <div style={{ height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 20}%`,
                  background: 'var(--accent, #3b82f6)',
                  transition: 'width 0.2s ease',
                }} />
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            className="btn btn-primary"
            onClick={handleGeneratePdf}
            disabled={images.length === 0 || isGenerating}
            style={{
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              cursor: images.length === 0 || isGenerating ? 'not-allowed' : 'pointer',
              opacity: images.length === 0 || isGenerating ? 0.6 : 1,
            }}
          >
            {isGenerating ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Generating PDF ({progress?.current || 0}/{progress?.total || images.length})...
              </>
            ) : (
              <>
                <FileCheck size={16} />
                Generate PDF ({images.length} {images.length === 1 ? 'Page' : 'Pages'})
              </>
            )}
          </button>

          {/* Offline local note */}
          <div style={{ fontSize: 10, color: 'var(--text-muted, #64748b)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <ShieldCheck size={13} color="#10B981" />
            <span>Files processed securely on local device</span>
          </div>
        </div>
      </div>

      {/* ── In-App PDF Preview Modal ── */}
      {previewModalOpen && generatedResult && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: 'var(--surface, #1e293b)',
            borderRadius: 12,
            border: '1px solid var(--border, #334155)',
            width: '90%',
            maxWidth: 1100,
            height: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--border, #334155)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--surface-2, #0f172a)',
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>
                  {generatedResult.fileName}
                </h4>
                <div style={{ fontSize: 11, color: 'var(--text-secondary, #94a3b8)' }}>
                  Pages: {generatedResult.pageCount} · Size: {formatFileSize(generatedResult.fileSize)} · 100% Local Generation
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleDownloadPdf}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={14} /> Download PDF
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPreviewModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={{ flex: 1, background: '#000', display: 'flex' }}>
              <iframe
                src={generatedResult.url}
                title="Generated PDF Preview"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HenuIdfPage;

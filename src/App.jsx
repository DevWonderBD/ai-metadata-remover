import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { 
  ShieldCheck, 
  Sparkles, 
  Download, 
  Copy, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  FolderDown, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  FileCheck,
  Star,
  ExternalLink,
  Laptop
} from 'lucide-react';

import { cleanBytes } from './core/stripper';
import { detectFileNameAI } from './core/detectAI';
import { makeZip } from './core/zip';
import { fetchCurrentStats, recordVisit, recordCleanedImages, syncOfflineQueue } from './services/statsService';
import devWonderLogo from './assets/dev-wonder-logo.png';
import './App.css';

const SUPPORTED_EXT_RE = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|tiff?)$/i;

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

export default function App() {
  const [items, setItems] = useState([]);
  const [keepICC, setKeepICC] = useState(true);
  const [unique, setUnique] = useState(false);
  const [nameMode, setNameMode] = useState('suffix'); // 'suffix' | 'keep' | 'rename'
  const [isDragOver, setIsDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Live Stats state (fetched from server or updated live)
  const [stats, setStats] = useState({
    images_cleaned: 0,
    ai_detected_count: 0,
    total_visits: 0,
  });

  // PWA install prompt state
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Interactive filename tester state
  const [testFileName, setTestFileName] = useState('ChatGPT Image Oct 14.png');
  const [faqOpen, setFaqOpen] = useState(null);

  const fileInputRef = useRef(null);

  // Initialize stats, record visit, and setup PWA install handler
  useEffect(() => {
    fetchCurrentStats().then(setStats);
    recordVisit();
    syncOfflineQueue();

    // Listen for PWA install prompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallPrompt(null);
        setIsInstalled(true);
      }
    } else {
      alert("Install AI Metadata Remover App:\n\n• On Chrome/Edge (Desktop): Click the Install icon on the right side of the URL address bar.\n• On iPhone/iPad (Safari): Tap the Share button below and tap 'Add to Home Screen'.\n• On Android (Chrome): Tap the 3 dots menu and select 'Install app' or 'Add to Home screen'.");
    }
  };

  // Window-level clipboard paste listener (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }
      const dt = e.clipboardData;
      if (!dt) return;
      let files = [...dt.files];
      if (!files.length) {
        files = [...dt.items]
          .filter(i => i.kind === 'file')
          .map(i => i.getAsFile())
          .filter(Boolean);
      }
      files = files.filter(f => f.type.startsWith('image/') || SUPPORTED_EXT_RE.test(f.name));
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [keepICC, unique]);

  const addFiles = useCallback((fileList) => {
    const newItems = [];
    for (const f of fileList) {
      if (f.type.startsWith('image/') || SUPPORTED_EXT_RE.test(f.name)) {
        newItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file: f,
          status: 'queued', // queued -> processing -> done -> error
          nameAI: detectFileNameAI(f.name),
          open: false,
          out: null,
          url: null,
          error: null,
        });
      }
    }
    if (newItems.length) {
      setItems(prev => [...prev, ...newItems]);
    }
  }, []);

  // Process queued items sequentially
  useEffect(() => {
    const queued = items.find(it => it.status === 'queued');
    if (!queued) return;

    let isMounted = true;

    async function processItem() {
      setItems(prev => prev.map(it => it.id === queued.id ? { ...it, status: 'processing' } : it));

      try {
        const u8 = new Uint8Array(await queued.file.arrayBuffer());
        const cleaned = await cleanBytes(u8, queued.file, { keepICC, unique });
        const blobUrl = URL.createObjectURL(new Blob([cleaned.bytes], { type: cleaned.mime }));

        if (!isMounted) return;

        setItems(prev => prev.map(it => {
          if (it.id === queued.id) {
            return {
              ...it,
              status: 'done',
              out: cleaned,
              url: blobUrl,
            };
          }
          return it;
        }));

        // Telemetry update
        const aiCount = (cleaned.ai ? cleaned.ai.length : 0) + (queued.nameAI.length ? 1 : 0);
        recordCleanedImages(1, aiCount);
        setStats(prev => ({
          ...prev,
          images_cleaned: prev.images_cleaned + 1,
          ai_detected_count: prev.ai_detected_count + (aiCount > 0 ? 1 : 0),
        }));

        // Trigger confetti celebration when last queued item finishes
        const remaining = items.filter(it => it.status === 'queued');
        if (remaining.length <= 1) {
          try {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.7 },
              colors: ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6']
            });
          } catch (e) {}
        }

      } catch (err) {
        if (!isMounted) return;
        setItems(prev => prev.map(it => {
          if (it.id === queued.id) {
            return {
              ...it,
              status: 'error',
              error: err.message || 'Could not process this image',
            };
          }
          return it;
        }));
      }
    }

    processItem();

    return () => { isMounted = false; };
  }, [items, keepICC, unique]);

  const generateOutputName = (item, index, doneList) => {
    if (!item.out) return item.file.name;
    const base = item.file.name.replace(/\.[^.]+$/, '');
    const ext = item.out.ext;

    if (nameMode === 'keep') return `${base}.${ext}`;
    if (nameMode === 'suffix') return `${base}-clean.${ext}`;
    return `image-${String(index + 1).padStart(3, '0')}.${ext}`;
  };

  const handleCopy = async (item) => {
    if (!item.out || !navigator.clipboard) return;
    try {
      let pngBlob;
      if (item.out.mime === 'image/png') {
        pngBlob = new Blob([item.out.bytes], { type: 'image/png' });
      } else {
        const bmp = await createImageBitmap(new Blob([item.out.bytes], { type: item.out.mime }));
        const canvas = document.createElement('canvas');
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        canvas.getContext('2d').drawImage(bmp, 0, 0);
        if (bmp.close) bmp.close();
        pngBlob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      alert('Copy to clipboard failed. Please use download button instead.');
    }
  };

  const handleDownloadAll = () => {
    const doneItems = items.filter(it => it.status === 'done');
    if (!doneItems.length) return;

    const filesForZip = doneItems.map((it, idx) => ({
      name: generateOutputName(it, idx, doneItems),
      bytes: it.out.bytes,
    }));

    const zipBlob = makeZip(filesForZip);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = 'cleaned-images-devwonder.zip';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  };

  const handleClearAll = () => {
    items.forEach(it => it.url && URL.revokeObjectURL(it.url));
    setItems([]);
  };

  const removeItem = (id) => {
    setItems(prev => {
      const item = prev.find(x => x.id === id);
      if (item && item.url) URL.revokeObjectURL(item.url);
      return prev.filter(x => x.id !== id);
    });
  };

  const doneCount = items.filter(it => it.status === 'done').length;
  const pendingCount = items.filter(it => it.status === 'queued' || it.status === 'processing').length;

  // Filename AI tester logic
  const detectedTestAI = detectFileNameAI(testFileName);

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="navbar">
        <a href="https://www.devwonderbd.com" target="_blank" rel="noopener noreferrer" className="brand">
          <img src={devWonderLogo} alt="Dev Wonder" className="brand-logo" />
          <span className="brand-text">Dev Wonder</span>
        </a>
        <div className="nav-actions">
          <button 
            type="button" 
            onClick={handleInstallClick} 
            className="install-app-btn"
            title="Install app to your device for offline use"
          >
            <Download size={16} />
            <span>{isInstalled ? 'App Installed' : 'Install App'}</span>
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="hero-pill">
          <ShieldCheck size={16} />
          <span>100% Client-Side: Your images never leave your browser</span>
        </div>
        <h1>AI Metadata Remover</h1>
        <p className="hero-sub">
          Remove hidden AI generation tags, C2PA Content Credentials, Midjourney & ChatGPT prompts, and camera EXIF data losslessly in bulk.
        </p>

        {/* Minimal 3-Item Clean Stats Bar */}
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-dot green"></span>
            <span><strong>{stats.images_cleaned.toLocaleString()}</strong> images cleaned</span>
          </div>
          <div className="stat-item">
            <span className="stat-dot amber"></span>
            <span><strong>{stats.ai_detected_count.toLocaleString()}</strong> AI traces stripped</span>
          </div>
          <div className="stat-item">
            <span className="stat-dot"></span>
            <span><strong>0 MB</strong> uploaded (100% Private)</span>
          </div>
        </div>
      </section>

      {/* Main Dropzone */}
      <div 
        className={`dropzone ${isDragOver ? 'active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          multiple 
          accept="image/*,.heic,.heif,.avif"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="drop-icon-wrap">
          <FolderDown size={28} />
        </div>
        <div className="drop-title">Drag & drop your images here, or click to browse</div>
        <div className="drop-desc">Supports JPG, PNG, WebP, HEIC, AVIF, and more with zero quality loss.</div>
        <button type="button" className="drop-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
          <Sparkles size={16} />
          <span>Select Images</span>
        </button>
        <div className="paste-hint">
          or press <kbd>Ctrl+V</kbd> / <kbd>⌘V</kbd> anywhere to paste from clipboard
        </div>
      </div>

      {/* Options Bar */}
      <div className="options-bar">
        <div className="options-group">
          <label className="option-checkbox">
            <input 
              type="checkbox" 
              checked={keepICC} 
              onChange={(e) => setKeepICC(e.target.checked)} 
            />
            <span>Keep original color profile (ICC)</span>
          </label>
          <label className="option-checkbox">
            <input 
              type="checkbox" 
              checked={unique} 
              onChange={(e) => setUnique(e.target.checked)} 
            />
            <span>Make each image unique <small style={{ color: 'var(--text-subtle)' }}>(imperceptible noise)</small></span>
          </label>
        </div>
        <div className="option-select">
          <span style={{ color: 'var(--text-muted)' }}>Naming:</span>
          <select value={nameMode} onChange={(e) => setNameMode(e.target.value)}>
            <option value="suffix">photo-clean.jpg</option>
            <option value="keep">Same as original</option>
            <option value="rename">image-001, image-002…</option>
          </select>
        </div>
      </div>

      {/* Batch Summary Bar */}
      {items.length > 0 && (
        <div className="batch-bar">
          <div className="batch-stats">
            <CheckCircle2 size={18} color="var(--success)" />
            <span>
              <strong>{doneCount}</strong> of {items.length} image{items.length > 1 ? 's' : ''} cleaned
              {pendingCount > 0 && ` · processing ${pendingCount} more…`}
            </span>
          </div>
          <div className="batch-actions">
            <button className="btn-secondary" onClick={handleClearAll}>
              <RefreshCw size={14} />
              <span>Start over</span>
            </button>
            <button className="btn-primary" disabled={doneCount === 0 || pendingCount > 0} onClick={handleDownloadAll}>
              <Download size={16} />
              <span>Download All (.ZIP)</span>
            </button>
          </div>
        </div>
      )}

      {/* Image Rows List */}
      <div className="image-list">
        {items.map((it, idx) => {
          const doneList = items.filter(x => x.status === 'done');
          const outName = generateOutputName(it, idx, doneList);
          const aiCount = (it.out?.ai ? it.out.ai.length : 0) + (it.nameAI?.length ? 1 : 0);

          return (
            <div key={it.id} className="image-card">
              <div className="image-row-main">
                <div className="image-thumb-wrap">
                  <img 
                    className="image-thumb" 
                    src={it.url || URL.createObjectURL(it.file)} 
                    alt="" 
                  />
                </div>
                <div className="image-info">
                  <div className="image-name">{outName}</div>
                  <div className="image-meta-text">
                    {it.status === 'done' 
                      ? `${formatBytes(it.file.size)} → ${formatBytes(it.out.bytes.length)} · ${it.out.method}`
                      : `${formatBytes(it.file.size)} · ${it.status === 'processing' ? 'processing…' : 'queued'}`
                    }
                  </div>
                  <div className="tags-row">
                    {it.status === 'done' && (
                      <>
                        {aiCount > 0 ? (
                          <span className="tag-badge ai">
                            <Sparkles size={12} />
                            AI Traces Found ({aiCount})
                          </span>
                        ) : (
                          <span className="tag-badge">No AI Traces</span>
                        )}
                        <span className="tag-badge">
                          {it.out.removed.length} item{it.out.removed.length === 1 ? '' : 's'} removed
                        </span>
                        {it.out.verified && (
                          <span className="tag-badge clean">
                            <CheckCircle2 size={12} />
                            Clean
                          </span>
                        )}
                      </>
                    )}
                    {it.status === 'error' && (
                      <span className="tag-badge error">
                        <AlertCircle size={12} />
                        {it.error}
                      </span>
                    )}
                  </div>
                </div>

                <div className="image-actions">
                  {it.status === 'done' && (
                    <>
                      <button 
                        className="action-btn-sm" 
                        onClick={() => setItems(prev => prev.map(x => x.id === it.id ? { ...x, open: !x.open } : x))}
                      >
                        {it.open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <span>{it.open ? 'Hide' : 'Inspect'}</span>
                      </button>
                      <button 
                        className="action-btn-sm" 
                        onClick={() => handleCopy(it)}
                      >
                        <Copy size={14} />
                        <span>{copiedId === it.id ? 'Copied!' : 'Copy'}</span>
                      </button>
                      <a 
                        className="action-btn-sm" 
                        style={{ background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }}
                        href={it.url} 
                        download={outName}
                      >
                        <Download size={14} />
                        <span>Download</span>
                      </a>
                    </>
                  )}
                  <button 
                    className="icon-btn" 
                    title="Remove"
                    onClick={() => removeItem(it.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Expandable Inspection Details */}
              {it.open && it.out && (
                <div className="image-details">
                  <div className="detail-col">
                    <h4>What Was Detected</h4>
                    <ul>
                      {it.out.ai && it.out.ai.length > 0 ? (
                        it.out.ai.map((d, i) => (
                          <li key={i}>
                            <strong>{d.name}</strong>
                            {d.evidence.map((ev, k) => (
                              <span key={k} className="detail-evidence">{ev}</span>
                            ))}
                          </li>
                        ))
                      ) : (
                        <li>No AI tags found</li>
                      )}
                      {it.nameAI && it.nameAI.length > 0 && (
                        <li>
                          <strong>Filename matches {it.nameAI.join(', ')}</strong>
                          <span className="detail-evidence">{it.file.name}</span>
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="detail-col">
                    <h4>What Was Removed</h4>
                    <ul>
                      {it.out.removed.map((r, i) => (
                        <li key={i}>
                          <strong>{r.label}</strong>
                          {r.bytes ? ` (${formatBytes(r.bytes)})` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="detail-col">
                    <h4>What Was Kept</h4>
                    <ul>
                      {it.out.kept.map((k, i) => (
                        <li key={i}>✓ {k}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive AI File Name Detector */}
      <section className="filename-widget">
        <h3>File Name AI Analyzer</h3>
        <p>AI tools like ChatGPT, Midjourney, and Gemini often label their output directly in the filename.</p>
        <div className="filename-input-wrap">
          <input 
            type="text" 
            className="filename-input" 
            value={testFileName}
            onChange={(e) => setTestFileName(e.target.value)}
            placeholder="Type any image filename..."
          />
        </div>
        <div className="filename-result-grid">
          <div className="fn-res-item">
            <span>Detected Tool:</span>
            <strong className={detectedTestAI.length ? 'warn' : 'ok'}>
              {detectedTestAI.length ? detectedTestAI.join(', ') : 'No AI tool named'}
            </strong>
          </div>
          <div className="fn-res-item">
            <span>Cleaned as (Suffix):</span>
            <strong>{testFileName.replace(/(\.[^.]+)$/, '')}-clean.jpg</strong>
          </div>
          <div className="fn-res-item">
            <span>Cleaned as (Sequential):</span>
            <strong>image-001.jpg</strong>
          </div>
        </div>
        <div className="fn-samples">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', alignSelf: 'center' }}>Try samples:</span>
          {['ChatGPT Image Oct 14.png', 'midjourney_cyberpunk_v6.jpg', 'Gemini_Generated_Image_8a.png', 'family_vacation_photo.jpg'].map(sample => (
            <button 
              key={sample} 
              type="button" 
              className="fn-sample-btn"
              onClick={() => setTestFileName(sample)}
            >
              {sample}
            </button>
          ))}
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="faq-sec">
        <h3>Frequently Asked Questions</h3>
        <div className="faq-list">
          {[
            {
              q: "Does this tool upload my images anywhere?",
              a: "No. Everything runs 100% inside your browser using client-side binary parsing and Canvas APIs. Your images never touch any server, and the tool works completely offline as an installable PWA."
            },
            {
              q: "Does removing metadata reduce image quality?",
              a: "No. For JPG, PNG, and WebP, the cleaning is completely lossless. The actual pixel data is left untouched; only the metadata header chunks (EXIF, XMP, C2PA, Prompts) are stripped out."
            },
            {
              q: "Can it remove invisible pixel watermarks like Google SynthID?",
              a: "No. SynthID and similar technologies embed microscopic statistical watermarks directly into the pixel values themselves. Because that is image data rather than metadata, no metadata remover can take it out without degrading the image."
            },
            {
              q: "What does 'Make each image unique' do?",
              a: "It injects imperceptible noise into approximately 25% of visible pixels (changing a color channel value by ±1). This completely alters the cryptographic hash (SHA-256 / MD5) to prevent duplicate detection while remaining invisible to the human eye."
            }
          ].map((item, idx) => (
            <div key={idx} className="faq-item">
              <button 
                type="button" 
                className="faq-question"
                onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
              >
                <span>{item.q}</span>
                {faqOpen === idx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {faqOpen === idx && (
                <div className="faq-answer">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div>
          An open source initiative by{' '}
          <a href="https://www.devwonderbd.com" target="_blank" rel="noopener noreferrer" className="footer-brand-link">
            Dev Wonder
          </a>
        </div>
        <div className="footer-right">
          <a 
            href="https://github.com/DevWonderBD/ai-metadata-remover" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="footer-github-btn"
          >
            <Star size={14} fill="currentColor" />
            <span>Star on GitHub</span>
          </a>
          <div className="footer-nav">
            <a href="https://github.com/DevWonderBD/ai-metadata-remover" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href="https://github.com/DevWonderBD/ai-metadata-remover/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">
              MIT License
            </a>
            <a href="https://github.com/DevWonderBD/ai-metadata-remover/issues" target="_blank" rel="noopener noreferrer">
              Report Issue
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

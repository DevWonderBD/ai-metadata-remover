import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { 
  ShieldCheck, 
  Download, 
  Copy, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  FolderDown, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Star,
  Plus,
  Sparkles,
  Info,
  Sun,
  Moon,
  X,
  Monitor,
  Smartphone
} from 'lucide-react';

import { cleanBytes } from './core/stripper.js';
import { detectFileNameAI } from './core/detectAI.js';
import { makeZip } from './core/zip.js';
import { fetchCurrentStats, recordVisit, recordCleanedImages, syncOfflineQueue } from './services/statsService.js';
import devWonderEmblem from './assets/dev-wonder-logo-clean.png';
import appIcon from './assets/ai-remover-icon-1024.png';
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
  const [recentUpload, setRecentUpload] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Theme state: track device OS preference, toggleable, persisted in localStorage
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dw_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dw_theme', theme);
  }, [theme]);

  // Sync with device OS theme changes if user hasn't explicitly locked a preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleOSThemeChange = (e) => {
      const manual = localStorage.getItem('dw_theme_manual');
      if (!manual) {
        setTheme(e.matches ? 'light' : 'dark');
      }
    };
    mediaQuery.addEventListener?.('change', handleOSThemeChange);
    return () => mediaQuery.removeEventListener?.('change', handleOSThemeChange);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('dw_theme_manual', 'true');
    showToast(`Switched to ${nextTheme === 'light' ? 'Light' : 'Dark'} mode`, 'info');
  };

  // App version tracking (from package.json define)
  const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState(currentVersion);

  // Live Stats state
  const [stats, setStats] = useState({
    images_cleaned: 0,
    ai_detected_count: 0,
    total_visits: 0,
  });

  // PWA install prompt & standalone state
  const [installPrompt, setInstallPrompt] = useState(window.__pwaInstallPrompt || null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    return localStorage.getItem('dw_pwa_installed') === 'true';
  });

  // FAQ accordion state
  const [faqOpen, setFaqOpen] = useState(null);

  const fileInputRef = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const showToast = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3800);
  }, []);

  // Initialize stats, record visit, and setup PWA install & standalone detection
  useEffect(() => {
    const checkStandalone = () => {
      const isStand = window.matchMedia('(display-mode: standalone)').matches 
        || window.navigator.standalone === true 
        || document.referrer.includes('android-app://');
      setIsStandalone(Boolean(isStand));
      if (isStand) {
        setIsInstalled(true);
        localStorage.setItem('dw_pwa_installed', 'true');
      }
    };

    checkStandalone();
    const mql = window.matchMedia('(display-mode: standalone)');
    if (mql.addEventListener) {
      mql.addEventListener('change', checkStandalone);
    }

    // Check if app is already installed on the OS via getInstalledRelatedApps
    if ('getInstalledRelatedApps' in navigator) {
      navigator.getInstalledRelatedApps().then(apps => {
        if (apps && apps.length > 0) {
          setIsInstalled(true);
          localStorage.setItem('dw_pwa_installed', 'true');
        }
      }).catch(() => {});
    }

    fetchCurrentStats().then(setStats);
    recordVisit();
    syncOfflineQueue();

    // Check if prompt was captured early by index.html
    if (window.__pwaInstallPrompt) {
      setInstallPrompt(window.__pwaInstallPrompt);
    }

    const handlePromptReady = () => {
      if (window.__pwaInstallPrompt) {
        setInstallPrompt(window.__pwaInstallPrompt);
      }
    };
    window.addEventListener('pwa-prompt-ready', handlePromptReady);

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      window.__pwaInstallPrompt = e;
      setInstallPrompt(e);
      // Browser triggered prompt => app is not installed yet
      setIsInstalled(false);
      localStorage.removeItem('dw_pwa_installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', () => {
      window.__pwaInstallPrompt = null;
      setInstallPrompt(null);
      setIsInstalled(true);
      localStorage.setItem('dw_pwa_installed', 'true');
      setShowInstallModal(false);
      showToast('✓ App installed to your device successfully!', 'success');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      if (mql.removeEventListener) {
        mql.removeEventListener('change', checkStandalone);
      }
    };
  }, [showToast]);

  // Check for remote/production updates (SW & version.json comparison)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return;

        if (reg.waiting) {
          setUpdateAvailable(true);
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
                showToast('⚡ A new update is available for AI Metadata Remover!', 'info');
              }
            });
          }
        });
      }).catch(() => {});
    }

    const checkRemoteVersion = () => {
      fetch(`/version.json?t=${Date.now()}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.version && data.version !== currentVersion) {
            setUpdateAvailable(true);
            setRemoteVersion(data.version);
            showToast(`⚡ Update available: v${data.version}! Click Update to apply.`, 'info');
          }
        })
        .catch(() => {});
    };

    checkRemoteVersion();
    const interval = setInterval(checkRemoteVersion, 60000);
    return () => clearInterval(interval);
  }, [currentVersion, showToast]);

  const handleApplyUpdate = () => {
    showToast('🔄 Updating to latest build...', 'info');
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }
    setTimeout(() => {
      window.location.reload(true);
    }, 400);
  };

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        window.__pwaInstallPrompt = null;
        setInstallPrompt(null);
        setIsInstalled(true);
        localStorage.setItem('dw_pwa_installed', 'true');
        showToast('✓ App installed to your device successfully!', 'success');
      }
    } else if (isInstalled || isStandalone) {
      handleCheckUpdate();
    } else {
      setShowInstallModal(true);
    }
  };

  const handleCheckUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) reg.update();
      });
    }

    fetch(`/version.json?t=${Date.now()}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.version && data.version !== currentVersion) {
          setUpdateAvailable(true);
          setRemoteVersion(data.version);
          showToast(`⚡ New version v${data.version} available! Click Update to apply.`, 'info');
        } else {
          showToast(`✓ App is up to date (v${currentVersion}). You are on the latest version.`, 'success');
        }
      })
      .catch(() => {
        showToast(`✓ App is up to date (v${currentVersion})`, 'success');
      });
  };

  // Process a single item asynchronously without effect unmount cancellation
  const processSingleItem = useCallback(async (item, options) => {
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, status: 'processing' } : x));

    try {
      const u8 = new Uint8Array(await item.file.arrayBuffer());
      const cleaned = await cleanBytes(u8, item.file, options);
      const blobUrl = URL.createObjectURL(new Blob([cleaned.bytes], { type: cleaned.mime }));

      setItems(prev => prev.map(x => {
        if (x.id === item.id) {
          return {
            ...x,
            status: 'done',
            out: cleaned,
            url: blobUrl,
          };
        }
        return x;
      }));

      // Telemetry update
      const aiCount = (cleaned.ai ? cleaned.ai.length : 0) + (item.nameAI.length ? 1 : 0);
      recordCleanedImages(1, aiCount);
      setStats(prev => ({
        ...prev,
        images_cleaned: prev.images_cleaned + 1,
        ai_detected_count: prev.ai_detected_count + (aiCount > 0 ? 1 : 0),
      }));

      showToast(`✓ Cleaned ${item.file.name}`, 'success');

      // Check if all are done, trigger celebration
      setTimeout(() => {
        const current = itemsRef.current;
        const allDone = current.length > 0 && current.every(x => x.status === 'done' || x.status === 'error');
        if (allDone) {
          confetti({
            particleCount: 50,
            spread: 65,
            origin: { y: 0.65 },
            colors: ['#06b6d4', '#10b981', '#38bdf8', '#34d399']
          });
        }
      }, 200);

    } catch (err) {
      console.error('Processing error:', err);
      setItems(prev => prev.map(x => {
        if (x.id === item.id) {
          return {
            ...x,
            status: 'error',
            error: err.message || 'Processing failed',
          };
        }
        return x;
      }));
      showToast(`Error processing ${item.file.name}`, 'error');
    }
  }, [showToast]);

  const addFiles = useCallback((fileList) => {
    const newItems = [];
    for (const f of fileList) {
      if (f.type.startsWith('image/') || SUPPORTED_EXT_RE.test(f.name)) {
        newItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file: f,
          status: 'queued',
          nameAI: detectFileNameAI(f.name),
          open: false,
          out: null,
          url: null,
          error: null,
        });
      }
    }
    if (!newItems.length) return;

    setItems(prev => [...prev, ...newItems]);
    setRecentUpload(true);
    setTimeout(() => setRecentUpload(false), 1400);

    showToast(`📥 Received ${newItems.length} image${newItems.length > 1 ? 's' : ''}! Cleaning...`, 'info');

    // Run processing on all new items immediately
    const currentOpts = { keepICC, unique };
    newItems.forEach(it => {
      processSingleItem(it, currentOpts);
    });
  }, [keepICC, unique, processSingleItem, showToast]);

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
  }, [addFiles]);

  // Handle options change: re-clean existing items
  const handleKeepICCChange = (checked) => {
    setKeepICC(checked);
    items.forEach(it => {
      processSingleItem(it, { keepICC: checked, unique });
    });
  };

  const handleUniqueChange = (checked) => {
    setUnique(checked);
    items.forEach(it => {
      processSingleItem(it, { keepICC, unique: checked });
    });
  };

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
      showToast('📋 Copied cleaned image to clipboard!', 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      alert('Copy to clipboard failed in your browser. Please use the Download button.');
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
    showToast(`📦 Downloaded ${filesForZip.length} cleaned images in ZIP!`, 'success');
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  };

  const handleClearAll = () => {
    items.forEach(it => it.url && URL.revokeObjectURL(it.url));
    setItems([]);
    showToast('Cleaned list reset', 'info');
  };

  const removeItem = (id) => {
    setItems(prev => {
      const item = prev.find(x => x.id === id);
      if (item && item.url) URL.revokeObjectURL(item.url);
      return prev.filter(x => x.id !== id);
    });
  };

  const doneCount = items.filter(it => it.status === 'done').length;
  const processingCount = items.filter(it => it.status === 'processing' || it.status === 'queued').length;

  return (
    <div className="app-container">
      {/* Toast Notifications Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' && <CheckCircle2 size={16} className="toast-icon success" />}
            {t.type === 'info' && <FolderDown size={16} className="toast-icon info" />}
            {t.type === 'error' && <AlertCircle size={16} className="toast-icon error" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Top Navbar */}
      <header className="navbar">
        <a href="https://www.devwonderbd.com" target="_blank" rel="noopener noreferrer" className="brand">
          <div className="brand-emblem-wrap">
            <img src={devWonderEmblem} alt="Dev Wonder" className="brand-logo" />
          </div>
          <div className="brand-info">
            <span className="brand-title">Dev Wonder</span>
            <span className="brand-tagline">Simplifying Tech</span>
          </div>
        </a>
        <div className="nav-actions">
          {/* Light / Dark Mode Toggle */}
          <button 
            type="button" 
            onClick={toggleTheme} 
            className="theme-toggle-btn"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {updateAvailable ? (
            <button 
              type="button" 
              onClick={handleApplyUpdate} 
              className="app-status-chip update-available"
              title={`New version v${remoteVersion} available. Click to update now!`}
            >
              <span className="status-update-dot"></span>
              <span>Update Available</span>
            </button>
          ) : isStandalone || isInstalled ? (
            <button 
              type="button" 
              onClick={handleCheckUpdate} 
              className="app-status-chip"
              title={`App is up to date (v${currentVersion}). Click to check for updates.`}
            >
              <span className="status-pulse-dot"></span>
              <span>Up to date</span>
            </button>
          ) : (
            <button 
              type="button" 
              onClick={handleInstallClick} 
              className="install-app-btn"
              title="Install app to your device for 100% offline use"
            >
              <Download size={14} />
              <span>Install App</span>
            </button>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="hero-pill">
          <ShieldCheck size={14} />
          <span>100% Client-Side: Your images never leave your browser</span>
        </div>
        <h1>AI Metadata Remover</h1>
        <p className="hero-sub">
          Remove hidden AI generation tags, C2PA Content Credentials, Midjourney & ChatGPT prompts, and camera EXIF data losslessly in bulk.
        </p>

        {/* Minimal 3-Item Clean Stats Bar */}
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-dot cyan"></span>
            <span><strong>{stats.images_cleaned.toLocaleString()}</strong> images cleaned</span>
          </div>
          <div className="stat-item">
            <span className="stat-dot green"></span>
            <span><strong>{stats.ai_detected_count.toLocaleString()}</strong> AI traces stripped</span>
          </div>
          <div className="stat-item">
            <span className="stat-dot"></span>
            <span><strong>0 MB</strong> uploaded (100% Private)</span>
          </div>
        </div>
      </section>

      {/* Dynamic Dropzone: Collapses into sleek compact mode when items exist */}
      <div 
        className={`dropzone ${items.length > 0 ? 'compact' : ''} ${isDragOver ? 'active' : ''} ${recentUpload ? 'recent-upload' : ''}`}
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

        {items.length === 0 ? (
          <>
            <div className="drop-icon-wrap">
              <FolderDown size={28} />
            </div>
            <div className="drop-title">Drag & drop your images here, or click to browse</div>
            <div className="drop-desc">Supports JPG, PNG, WebP, HEIC, AVIF, and more with zero quality loss.</div>
            <button type="button" className="drop-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              <Plus size={16} />
              <span>Select Images</span>
            </button>
            <div className="paste-hint">
              or press <kbd>Ctrl+V</kbd> / <kbd>⌘V</kbd> anywhere to paste from clipboard
            </div>
          </>
        ) : (
          <>
            <div className="compact-content">
              <div className="compact-icon">
                <FolderDown size={22} />
              </div>
              <div className="compact-text">
                <h4>Add more images to clean</h4>
                <p>Drag & drop files or click to add (supports JPG, PNG, WebP · Ctrl+V)</p>
              </div>
            </div>
            <button type="button" className="compact-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              <Plus size={15} />
              <span>Browse Files</span>
            </button>
          </>
        )}
      </div>

      {/* Options Bar with Clear Friendly Explanations */}
      <div className="options-bar">
        <div className="options-group">
          <label className="option-item">
            <input 
              type="checkbox" 
              checked={keepICC} 
              onChange={(e) => handleKeepICCChange(e.target.checked)} 
            />
            <div className="option-content">
              <div className="option-title-row">
                <span className="option-title">Keep original colors</span>
                <span className="badge-pill badge-recommended">Recommended</span>
              </div>
              <span className="option-desc">Preserves display color profile (ICC)</span>
            </div>
          </label>

          <label className="option-item">
            <input 
              type="checkbox" 
              checked={unique} 
              onChange={(e) => handleUniqueChange(e.target.checked)} 
            />
            <div className="option-content">
              <div className="option-title-row">
                <span className="option-title">Make each image unique</span>
                <span className="badge-pill badge-optional">Optional</span>
              </div>
              <span className="option-desc">Invisible pixel tweaks to alter duplicate file hash</span>
            </div>
          </label>
        </div>

        <div className="option-select-wrap">
          <label>File Naming:</label>
          <select value={nameMode} onChange={(e) => setNameMode(e.target.value)}>
            <option value="suffix">photo-clean.jpg (Adds -clean suffix)</option>
            <option value="keep">photo.jpg (Keep original name)</option>
            <option value="rename">image-001.jpg (Sequential numbering)</option>
          </select>
        </div>
      </div>

      {/* Batch Summary Bar */}
      {items.length > 0 && (
        <div className="batch-bar">
          <div className="batch-stats">
            <CheckCircle2 size={18} color="var(--accent)" />
            <span>
              <strong>{doneCount}</strong> of {items.length} image{items.length > 1 ? 's' : ''} cleaned
              {processingCount > 0 && ` · cleaning ${processingCount} in progress…`}
            </span>
          </div>
          <div className="batch-actions">
            <button className="btn-secondary" onClick={handleClearAll}>
              <RefreshCw size={14} />
              <span>Start over</span>
            </button>
            {/* Show ZIP only when there are multiple images */}
            {doneCount > 1 && (
              <button className="btn-primary" disabled={doneCount === 0 || processingCount > 0} onClick={handleDownloadAll}>
                <Download size={15} />
                <span>Download All ({doneCount}) as ZIP</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Image Rows List - Directly visible right below without scrolling */}
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
                      : `${formatBytes(it.file.size)} · ${it.status === 'processing' ? 'Cleaning metadata…' : 'Queued'}`
                    }
                  </div>
                  <div className="tags-row">
                    {it.status === 'processing' && (
                      <span className="tag-badge processing">
                        <RefreshCw size={11} className="spin" />
                        Processing...
                      </span>
                    )}
                    {it.status === 'done' && (
                      <>
                        {aiCount > 0 ? (
                          <span className="tag-badge ai">
                            <Sparkles size={11} />
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
                            <CheckCircle2 size={11} />
                            Clean
                          </span>
                        )}
                      </>
                    )}
                    {it.status === 'error' && (
                      <span className="tag-badge error">
                        <AlertCircle size={11} />
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
                        {it.open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        <span>{it.open ? 'Hide' : 'Inspect'}</span>
                      </button>
                      <button 
                        className="action-btn-sm" 
                        onClick={() => handleCopy(it)}
                      >
                        <Copy size={13} />
                        <span>{copiedId === it.id ? 'Copied!' : 'Copy'}</span>
                      </button>
                      <a 
                        className="action-btn-sm" 
                        style={{ background: 'linear-gradient(135deg, #06b6d4, #10b981)', color: '#0c0e14', borderColor: 'transparent', fontWeight: 700 }}
                        href={it.url} 
                        download={outName}
                      >
                        <Download size={13} />
                        <span>Download</span>
                      </a>
                    </>
                  )}
                  <button 
                    className="icon-btn" 
                    title="Remove"
                    onClick={() => removeItem(it.id)}
                  >
                    <Trash2 size={15} />
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
                {faqOpen === idx ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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
        <div className="footer-left">
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

      {/* Sleek Install Guide Modal (replaces browser alert with visual guidance) */}
      {showInstallModal && (
        <div className="modal-overlay" onClick={() => setShowInstallModal(false)}>
          <div className="install-modal" onClick={e => e.stopPropagation()}>
            <div className="install-modal-header">
              <div className="install-modal-title">
                <img src={appIcon} alt="App Icon" className="install-modal-logo" />
                <div>
                  <h3>Install AI Metadata Remover</h3>
                  <p>100% Client-Side &amp; Works Fully Offline</p>
                </div>
              </div>
              <button 
                type="button" 
                className="install-modal-close"
                onClick={() => setShowInstallModal(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="install-modal-body">
              <div className="install-step-card">
                <Monitor size={22} className="install-step-icon" />
                <div className="install-step-info">
                  <h4>Desktop (Chrome / Brave / Edge)</h4>
                  <p>Look at your browser's address/URL bar on the right side and click the <strong>Install / Open App icon (⊕ / 📥)</strong>, or click the browser's 3-dots menu ➔ <em>Install Dev Wonder AI Metadata Remover</em>.</p>
                </div>
              </div>

              <div className="install-step-card">
                <Smartphone size={22} className="install-step-icon" />
                <div className="install-step-info">
                  <h4>iPhone &amp; iPad (Safari)</h4>
                  <p>Tap the <strong>Share</strong> button (box with upward arrow at bottom) ➔ scroll down and tap <strong>Add to Home Screen (+)</strong>.</p>
                </div>
              </div>

              <div className="install-step-card">
                <Smartphone size={22} className="install-step-icon" />
                <div className="install-step-info">
                  <h4>Android (Chrome / Brave)</h4>
                  <p>Tap the <strong>3-dots menu (⋮)</strong> at top right ➔ tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
                </div>
              </div>
            </div>

            <div className="install-modal-footer">
              <button 
                type="button" 
                className="install-modal-gotit-btn"
                onClick={() => setShowInstallModal(false)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

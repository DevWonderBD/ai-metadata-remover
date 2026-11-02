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
  Sun,
  Moon,
  X,
  Monitor,
  Smartphone,
  ExternalLink,
} from 'lucide-react';

import { cleanBytes } from './core/stripper.js';
import { detectFileNameAI } from './core/detectAI.js';
import { makeZip } from './core/zip.js';
import { fetchCurrentStats, recordVisit, recordCleanedImages, syncOfflineQueue } from './services/statsService.js';
import devWonderEmblem from './assets/dev-wonder-logo-clean.png';
import appIcon from './assets/ai-remover-icon-1024.png';
import './App.css';

const SUPPORTED_EXT_RE = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|tiff?)$/i;

function GithubIcon({ size = 14, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

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
  const [nameMode, setNameMode] = useState('suffix');
  const [isDragOver, setIsDragOver] = useState(false);
  const [recentUpload, setRecentUpload] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Theme state
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dw_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dw_theme', theme);
  }, [theme]);

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

  // App version tracking
  const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState(currentVersion);

  // Live Stats
  const [stats, setStats] = useState({
    images_cleaned: 0,
    ai_detected_count: 0,
    total_visits: 0,
  });

  // PWA install
  const [installPrompt, setInstallPrompt] = useState(window.__pwaInstallPrompt || null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    return localStorage.getItem('dw_pwa_installed') === 'true';
  });
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);

  // FAQ accordion
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
      setIsInstalled(false);
      localStorage.removeItem('dw_pwa_installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', () => {
      window.__pwaInstallPrompt = null;
      setInstallPrompt(null);
      setIsInstalled(true);
      setIsInstalling(false);
      setInstallProgress(100);
      localStorage.setItem('dw_pwa_installed', 'true');
      setShowInstallModal(false);
      showToast('✓ App installed successfully!', 'success');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      if (mql.removeEventListener) {
        mql.removeEventListener('change', checkStandalone);
      }
    };
  }, [showToast]);

  // Check for remote updates
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
                showToast('A new update is available!', 'info');
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
          }
        })
        .catch(() => {});
    };

    checkRemoteVersion();
    const interval = setInterval(checkRemoteVersion, 60000);
    return () => clearInterval(interval);
  }, [currentVersion, showToast]);

  const handleApplyUpdate = () => {
    showToast('Updating to latest version…', 'info');
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
      // Native install prompt available - trigger it
      setIsInstalling(true);
      setInstallProgress(0);
      
      // Animate progress bar while waiting for install
      const progressInterval = setInterval(() => {
        setInstallProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90; // Hold at 90% until appinstalled event
          }
          return prev + Math.random() * 15;
        });
      }, 300);

      try {
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
          // User accepted, wait for appinstalled event to set 100%
          // If no appinstalled event fires within 8s, complete anyway
          setTimeout(() => {
            clearInterval(progressInterval);
            setInstallProgress(100);
            setTimeout(() => {
              setIsInstalling(false);
              window.__pwaInstallPrompt = null;
              setInstallPrompt(null);
              setIsInstalled(true);
              localStorage.setItem('dw_pwa_installed', 'true');
            }, 600);
          }, 8000);
        } else {
          clearInterval(progressInterval);
          setIsInstalling(false);
          setInstallProgress(0);
        }
      } catch {
        clearInterval(progressInterval);
        setIsInstalling(false);
        setInstallProgress(0);
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
          showToast(`Update v${data.version} available!`, 'info');
        } else {
          showToast(`App is up to date (v${currentVersion})`, 'success');
        }
      })
      .catch(() => {
        showToast(`App is up to date (v${currentVersion})`, 'success');
      });
  };

  // Processing logic
  const processSingleItem = useCallback(async (item, options) => {
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, status: 'processing' } : x));

    try {
      const u8 = new Uint8Array(await item.file.arrayBuffer());
      const cleaned = await cleanBytes(u8, item.file, options);
      const blobUrl = URL.createObjectURL(new Blob([cleaned.bytes], { type: cleaned.mime }));

      setItems(prev => prev.map(x => {
        if (x.id === item.id) {
          return { ...x, status: 'done', out: cleaned, url: blobUrl };
        }
        return x;
      }));

      const aiCount = (cleaned.ai ? cleaned.ai.length : 0) + (item.nameAI.length ? 1 : 0);
      recordCleanedImages(1, aiCount);
      setStats(prev => ({
        ...prev,
        images_cleaned: prev.images_cleaned + 1,
        ai_detected_count: prev.ai_detected_count + (aiCount > 0 ? 1 : 0),
      }));

      showToast(`Cleaned ${item.file.name}`, 'success');

      setTimeout(() => {
        const current = itemsRef.current;
        const allDone = current.length > 0 && current.every(x => x.status === 'done' || x.status === 'error');
        if (allDone) {
          confetti({
            particleCount: 50,
            spread: 65,
            origin: { y: 0.65 },
            colors: ['#38bdf8', '#818cf8', '#10b981', '#06b6d4']
          });
        }
      }, 200);

    } catch (err) {
      console.error('Processing error:', err);
      setItems(prev => prev.map(x => {
        if (x.id === item.id) {
          return { ...x, status: 'error', error: err.message || 'Processing failed' };
        }
        return x;
      }));
      showToast(`Error: ${item.file.name}`, 'error');
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

    showToast(`Received ${newItems.length} image${newItems.length > 1 ? 's' : ''}`, 'info');

    const currentOpts = { keepICC, unique };
    newItems.forEach(it => {
      processSingleItem(it, currentOpts);
    });
  }, [keepICC, unique, processSingleItem, showToast]);

  // Clipboard paste
  useEffect(() => {
    const handlePaste = (e) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
      const dt = e.clipboardData;
      if (!dt) return;
      let files = [...dt.files];
      if (!files.length) {
        files = [...dt.items].filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean);
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

  const handleKeepICCChange = (checked) => {
    setKeepICC(checked);
    items.forEach(it => { processSingleItem(it, { keepICC: checked, unique }); });
  };

  const handleUniqueChange = (checked) => {
    setUnique(checked);
    items.forEach(it => { processSingleItem(it, { keepICC, unique: checked }); });
  };

  const generateOutputName = (item, index) => {
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
      showToast('Copied to clipboard', 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      alert('Copy failed. Please use the Download button.');
    }
  };

  const handleDownloadAll = () => {
    const doneItems = items.filter(it => it.status === 'done');
    if (!doneItems.length) return;
    const filesForZip = doneItems.map((it, idx) => ({
      name: generateOutputName(it, idx),
      bytes: it.out.bytes,
    }));
    const zipBlob = makeZip(filesForZip);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = 'cleaned-images.zip';
    link.click();
    showToast(`Downloaded ${filesForZip.length} images as ZIP`, 'success');
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  };

  const handleClearAll = () => {
    items.forEach(it => it.url && URL.revokeObjectURL(it.url));
    setItems([]);
    showToast('All cleared', 'info');
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
    <div className="app-shell">
      {/* ==================== Toast Notifications ==================== */}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            {t.type === 'success' && <CheckCircle2 size={16} />}
            {t.type === 'info' && <FolderDown size={16} />}
            {t.type === 'error' && <AlertCircle size={16} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* ==================== Install Progress Overlay ==================== */}
      {isInstalling && (
        <div className="install-progress-overlay">
          <div className="install-progress-card">
            <img src={appIcon} alt="" className="install-progress-icon" />
            <div className="install-progress-info">
              <h3>Installing AI Metadata Remover…</h3>
              <p className="install-progress-sub">Registering app &amp; caching offline resources</p>
            </div>
            <div className="install-progress-bar-track">
              <div 
                className="install-progress-bar-fill" 
                style={{ width: `${Math.min(installProgress, 100)}%` }}
              />
            </div>
            <div className="install-progress-footer">
              <span className="install-progress-label">
                {installProgress >= 100 ? '✓ Ready in your App Drawer!' : 'Installing…'}
              </span>
              <span className="install-progress-percent">{Math.round(installProgress)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Top Navigation ==================== */}
      <header className="topbar">
        <a href="/" className="topbar__brand" title="AI Metadata Remover">
          <img src={appIcon} alt="" className="topbar__logo" />
          <div className="topbar__text">
            <span className="topbar__title">AI Metadata Remover</span>
            <span className="topbar__subtitle">by Dev Wonder</span>
          </div>
        </a>

        <nav className="topbar__actions">
          {/* GitHub Star */}
          <a 
            href="https://github.com/DevWonderBD/ai-metadata-remover" 
            target="_blank" 
            rel="noopener noreferrer"
            className="topbar__github-btn"
            title="Star on GitHub"
          >
            <Star size={14} />
            <span>Star</span>
          </a>

          {/* Theme Toggle */}
          <button 
            type="button" 
            onClick={toggleTheme} 
            className="topbar__icon-btn"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Install / Update / Status */}
          {updateAvailable ? (
            <button 
              type="button" 
              onClick={handleApplyUpdate} 
              className="topbar__chip topbar__chip--update"
              title={`Update to v${remoteVersion}`}
            >
              <span className="pulse-dot pulse-dot--amber" />
              <span>Update</span>
            </button>
          ) : isStandalone || isInstalled ? (
            <button 
              type="button" 
              onClick={handleCheckUpdate} 
              className="topbar__chip"
              title={`v${currentVersion} — Check for updates`}
            >
              <span className="pulse-dot pulse-dot--green" />
              <span>App Installed</span>
            </button>
          ) : (
            <button 
              type="button" 
              onClick={handleInstallClick} 
              className="topbar__install-btn"
              title="Install for offline use"
            >
              <Download size={14} />
              <span>Install</span>
            </button>
          )}
        </nav>
      </header>

      {/* ==================== Main Content ==================== */}
      <main className="main">
        {/* Hero Section */}
        <section className="hero">
          <div className="hero__badge">
            <ShieldCheck size={14} />
            <span>100% Client-Side · Your images never leave your browser</span>
          </div>
          <h1 className="hero__title">AI Metadata Remover</h1>
          <p className="hero__desc">
            Remove hidden AI generation tags, C2PA Content Credentials, Midjourney &amp; ChatGPT prompts, and camera EXIF data — losslessly, in bulk.
          </p>

          {/* Stats Chips */}
          <div className="stats-row">
            <div className="stat-chip">
              <span className="stat-dot stat-dot--cyan" />
              <span><strong>{stats.images_cleaned.toLocaleString()}</strong> cleaned</span>
            </div>
            <div className="stat-chip">
              <span className="stat-dot stat-dot--green" />
              <span><strong>{stats.ai_detected_count.toLocaleString()}</strong> AI traces</span>
            </div>
            <div className="stat-chip">
              <span className="stat-dot" />
              <span><strong>0 MB</strong> uploaded</span>
            </div>
          </div>
        </section>

        {/* Dropzone */}
        <div 
          className={`dropzone ${items.length > 0 ? 'dropzone--compact' : ''} ${isDragOver ? 'dropzone--active' : ''} ${recentUpload ? 'dropzone--pulse' : ''}`}
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
              <div className="dropzone__icon">
                <FolderDown size={28} />
              </div>
              <div className="dropzone__title">Drag &amp; drop images here, or click to browse</div>
              <div className="dropzone__desc">JPG, PNG, WebP, HEIC, AVIF — zero quality loss</div>
              <button type="button" className="dropzone__btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <Plus size={16} />
                <span>Select Images</span>
              </button>
              <div className="dropzone__hint">
                or press <kbd>Ctrl+V</kbd> / <kbd>⌘V</kbd> to paste from clipboard
              </div>
            </>
          ) : (
            <div className="dropzone__compact-row">
              <div className="dropzone__compact-left">
                <div className="dropzone__compact-icon">
                  <FolderDown size={20} />
                </div>
                <div>
                  <h4>Add more images</h4>
                  <p>Drag &amp; drop or click · Ctrl+V to paste</p>
                </div>
              </div>
              <button type="button" className="dropzone__compact-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <Plus size={15} />
                <span>Browse</span>
              </button>
            </div>
          )}
        </div>

        {/* Options Panel */}
        <div className="options-panel">
          <div className="options-panel__group">
            <label className="option">
              <input 
                type="checkbox" 
                checked={keepICC} 
                onChange={(e) => handleKeepICCChange(e.target.checked)} 
              />
              <div className="option__body">
                <div className="option__header">
                  <span className="option__label">Keep original colors</span>
                  <span className="pill pill--accent">Recommended</span>
                </div>
                <span className="option__hint">Preserves ICC color profile</span>
              </div>
            </label>

            <label className="option">
              <input 
                type="checkbox" 
                checked={unique} 
                onChange={(e) => handleUniqueChange(e.target.checked)} 
              />
              <div className="option__body">
                <div className="option__header">
                  <span className="option__label">Make each image unique</span>
                  <span className="pill pill--muted">Optional</span>
                </div>
                <span className="option__hint">Invisible pixel tweaks alter file hash</span>
              </div>
            </label>
          </div>

          <div className="options-panel__select">
            <label>File Naming</label>
            <select value={nameMode} onChange={(e) => setNameMode(e.target.value)}>
              <option value="suffix">photo-clean.jpg</option>
              <option value="keep">photo.jpg (original)</option>
              <option value="rename">image-001.jpg (sequential)</option>
            </select>
          </div>
        </div>

        {/* Batch Action Bar */}
        {items.length > 0 && (
          <div className="batch-bar">
            <div className="batch-bar__status">
              <CheckCircle2 size={18} color="var(--accent)" />
              <span>
                <strong>{doneCount}</strong> / {items.length} cleaned
                {processingCount > 0 && ` · ${processingCount} in progress…`}
              </span>
            </div>
            <div className="batch-bar__actions">
              <button className="btn btn--ghost" onClick={handleClearAll}>
                <RefreshCw size={14} />
                <span>Clear</span>
              </button>
              {doneCount > 1 && (
                <button className="btn btn--filled" disabled={doneCount === 0 || processingCount > 0} onClick={handleDownloadAll}>
                  <Download size={15} />
                  <span>Download All ({doneCount})</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Image Results */}
        <div className="results">
          {items.map((it, idx) => {
            const outName = generateOutputName(it, idx);
            const aiCount = (it.out?.ai ? it.out.ai.length : 0) + (it.nameAI?.length ? 1 : 0);

            return (
              <div key={it.id} className="card">
                <div className="card__row">
                  <div className="card__thumb">
                    <img src={it.url || URL.createObjectURL(it.file)} alt="" />
                  </div>
                  <div className="card__info">
                    <div className="card__name">{outName}</div>
                    <div className="card__meta">
                      {it.status === 'done' 
                        ? `${formatBytes(it.file.size)} → ${formatBytes(it.out.bytes.length)} · ${it.out.method}`
                        : `${formatBytes(it.file.size)} · ${it.status === 'processing' ? 'Cleaning…' : 'Queued'}`
                      }
                    </div>
                    <div className="card__tags">
                      {it.status === 'processing' && (
                        <span className="tag tag--processing">
                          <RefreshCw size={11} className="spin" />
                          Processing
                        </span>
                      )}
                      {it.status === 'done' && (
                        <>
                          {aiCount > 0 ? (
                            <span className="tag tag--ai">
                              <Sparkles size={11} />
                              AI Found ({aiCount})
                            </span>
                          ) : (
                            <span className="tag">No AI</span>
                          )}
                          <span className="tag">
                            {it.out.removed.length} removed
                          </span>
                          {it.out.verified && (
                            <span className="tag tag--clean">
                              <CheckCircle2 size={11} />
                              Clean
                            </span>
                          )}
                        </>
                      )}
                      {it.status === 'error' && (
                        <span className="tag tag--error">
                          <AlertCircle size={11} />
                          {it.error}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="card__actions">
                    {it.status === 'done' && (
                      <>
                        <button 
                          className="btn btn--sm" 
                          onClick={() => setItems(prev => prev.map(x => x.id === it.id ? { ...x, open: !x.open } : x))}
                        >
                          {it.open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          <span className="btn__label-desktop">{it.open ? 'Hide' : 'Inspect'}</span>
                        </button>
                        <button className="btn btn--sm" onClick={() => handleCopy(it)}>
                          <Copy size={13} />
                          <span className="btn__label-desktop">{copiedId === it.id ? 'Copied!' : 'Copy'}</span>
                        </button>
                        <a className="btn btn--sm btn--accent" href={it.url} download={outName}>
                          <Download size={13} />
                          <span className="btn__label-desktop">Download</span>
                        </a>
                      </>
                    )}
                    <button className="btn btn--icon-only btn--danger-hover" title="Remove" onClick={() => removeItem(it.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Expandable Details */}
                {it.open && it.out && (
                  <div className="card__details">
                    <div className="detail-col">
                      <h4>Detected</h4>
                      <ul>
                        {it.out.ai && it.out.ai.length > 0 ? (
                          it.out.ai.map((d, i) => (
                            <li key={i}>
                              <strong>{d.name}</strong>
                              {d.evidence.map((ev, k) => (
                                <span key={k} className="evidence">{ev}</span>
                              ))}
                            </li>
                          ))
                        ) : (
                          <li>No AI tags found</li>
                        )}
                        {it.nameAI && it.nameAI.length > 0 && (
                          <li>
                            <strong>Filename: {it.nameAI.join(', ')}</strong>
                            <span className="evidence">{it.file.name}</span>
                          </li>
                        )}
                      </ul>
                    </div>
                    <div className="detail-col">
                      <h4>Removed</h4>
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
                      <h4>Kept</h4>
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

        {/* FAQ */}
        <section className="faq">
          <h3 className="faq__heading">Frequently Asked Questions</h3>
          <div className="faq__list">
            {[
              {
                q: "Does this tool upload my images anywhere?",
                a: "No. Everything runs 100% inside your browser using client-side binary parsing. Your images never touch any server, and the tool works completely offline as a PWA."
              },
              {
                q: "Does removing metadata reduce image quality?",
                a: "No. For JPG, PNG, and WebP, the cleaning is completely lossless. Pixel data is untouched — only metadata chunks (EXIF, XMP, C2PA) are stripped."
              },
              {
                q: "Can it remove pixel watermarks like SynthID?",
                a: "No. SynthID embeds watermarks directly into pixel values. No metadata remover can remove that without degrading the image."
              },
              {
                q: "What does 'Make each image unique' do?",
                a: "It injects imperceptible noise into ~25% of pixels (±1 color channel), completely altering the file hash while remaining invisible to the eye."
              }
            ].map((item, idx) => (
              <div key={idx} className="faq__item">
                <button 
                  type="button" 
                  className="faq__q"
                  onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
                >
                  <span>{item.q}</span>
                  {faqOpen === idx ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {faqOpen === idx && (
                  <div className="faq__a">{item.a}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ==================== Footer (Material 3 Minimalist) ==================== */}
      <footer className="footer">
        <div className="footer__brand-wrap">
          <a 
            href="https://www.devwonderbd.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="footer__dw-link"
            title="Dev Wonder - Simplifying Tech"
          >
            <img src={devWonderEmblem} alt="Dev Wonder" className="footer__dw-logo" />
          </a>
          <p className="footer__copyright">
            © {new Date().getFullYear()} Dev Wonder · Simplifying Tech
          </p>
        </div>

        <nav className="footer__nav" aria-label="Footer links">
          <a href="https://github.com/DevWonderBD/ai-metadata-remover" target="_blank" rel="noopener noreferrer">
            <GithubIcon size={13} />
            <span>GitHub</span>
          </a>
          <a href="https://github.com/DevWonderBD/ai-metadata-remover/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={12} />
            <span>MIT License</span>
          </a>
          <a href="https://github.com/DevWonderBD/ai-metadata-remover/issues" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={12} />
            <span>Report Issue</span>
          </a>
        </nav>

        {/* Version Badge is strictly at the very bottom */}
        <div className="footer__version-wrap">
          <span className="footer__version-badge">v{currentVersion}</span>
        </div>
      </footer>

      {/* ==================== Install Guide Modal ==================== */}
      {showInstallModal && (
        <div className="modal-backdrop" onClick={() => setShowInstallModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title-row">
                <img src={appIcon} alt="" className="modal__icon" />
                <div>
                  <h3>AI Metadata Remover</h3>
                  <p>Dev Wonder Open Source</p>
                </div>
              </div>
              <button type="button" className="modal__close" onClick={() => setShowInstallModal(false)}>
                <X size={18} />
              </button>
            </div>

            {isInstalled || isStandalone ? (
              <div className="modal__body modal__body--center">
                <div className="modal__success-icon">
                  <CheckCircle2 size={30} color="var(--accent)" />
                </div>
                <h4>Already Installed!</h4>
                <p>Open from your App Drawer or Application Launcher.</p>
                <div className="modal__hint-box">
                  💡 <strong>Reinstall?</strong> Uninstall the existing app first, then reload this page.
                </div>
              </div>
            ) : (
              <div className="modal__body">
                <div className="modal__step">
                  <Monitor size={20} className="modal__step-icon" />
                  <div>
                    <h4>Desktop (Chrome / Brave / Edge)</h4>
                    <p>Click the <strong>Install icon (⊕ / 📥)</strong> in the address bar, or browser menu → <em>Install AI Metadata Remover</em>.</p>
                  </div>
                </div>
                <div className="modal__step">
                  <Smartphone size={20} className="modal__step-icon" />
                  <div>
                    <h4>iPhone &amp; iPad (Safari)</h4>
                    <p>Tap <strong>Share</strong> → scroll down → <strong>Add to Home Screen (+)</strong>.</p>
                  </div>
                </div>
                <div className="modal__step">
                  <Smartphone size={20} className="modal__step-icon" />
                  <div>
                    <h4>Android (Chrome / Brave)</h4>
                    <p>Tap <strong>⋮ menu</strong> → <strong>Install app</strong>.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="modal__footer">
              <button type="button" className="btn btn--filled" onClick={() => setShowInstallModal(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

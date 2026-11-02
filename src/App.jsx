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
import { fetchCurrentStats, recordVisit, recordCleanedImages, syncOfflineQueue, getStoredStats } from './services/statsService.js';
import devWonderEmblem from './assets/dev-wonder-logo-clean.png';
import appIcon from './assets/ai-remover-icon-1024.png';

const SUPPORTED_EXT_RE = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|tiff?)$/i;

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

function GithubIcon({ size = 14, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

/* Lottie-style Vector Animated Icons */
function LottieUploadIcon({ isDragOver = false }) {
  return (
    <div className="relative flex items-center justify-center w-16 h-16 mb-3.5">
      {/* Outer pulsing radar ring */}
      <div className={`absolute inset-0 rounded-2xl bg-sky-500/15 ${isDragOver ? 'scale-125 bg-sky-500/30' : 'lottie-pulse-ring'}`} />
      
      {/* Animated Folder Box */}
      <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-b from-sky-400/20 to-indigo-500/20 border border-sky-400/35 flex items-center justify-center shadow-inner overflow-hidden">
        {/* Twinkling star particle */}
        <span className="absolute top-1.5 right-1.5 text-sky-400 lottie-sparkle">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
          </svg>
        </span>
        <span className="absolute bottom-1.5 left-1.5 text-indigo-400 lottie-sparkle-delay">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
          </svg>
        </span>
        
        {/* Bouncing Arrow */}
        <div className={isDragOver ? 'translate-y-1 scale-110 text-sky-500 transition-transform' : 'lottie-bounce text-sky-500'}>
          <FolderDown size={28} strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );
}

function LottieShieldIcon() {
  return (
    <span className="relative flex items-center justify-center w-4 h-4">
      <span className="absolute inset-0 rounded-full bg-sky-500/30 lottie-pulse-ring" />
      <ShieldCheck size={14} className="relative text-sky-500 shrink-0" />
    </span>
  );
}

function LottieDownloadIcon({ size = 15, className = "" }) {
  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      <span className="lottie-bounce inline-flex items-center">
        <Download size={size} strokeWidth={2.4} />
      </span>
    </span>
  );
}

function LottieSparkleIcon({ size = 14, className = "text-emerald-500" }) {
  return (
    <span className={`inline-flex items-center justify-center lottie-sparkle ${className}`}>
      <Sparkles size={size} />
    </span>
  );
}

function LottieVisitorIcon({ size = 14, className = "text-indigo-500" }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <span className="absolute -inset-0.5 rounded-full bg-indigo-500/25 lottie-pulse-ring" />
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="relative">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" className="lottie-pulse-slow fill-indigo-500/40" />
      </svg>
    </span>
  );
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

  // Live Persistent Stats (survives page refreshes offline)
  const [stats, setStats] = useState(() => getStoredStats());

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

  // Initialize stats, record visit, and setup PWA install
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
      if (window.__installCleanup) {
        window.__installCleanup();
      }
      setInstallProgress(100);
      setTimeout(() => {
        setIsInstalling(false);
        localStorage.setItem('dw_pwa_installed', 'true');
        setShowInstallModal(false);
        showToast('✓ App installed successfully!', 'success');
      }, 500);
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
      try {
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;

        if (outcome === 'accepted') {
          setIsInstalling(true);
          setInstallProgress(15);

          const startTime = Date.now();
          const targetDuration = 2600;
          
          const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const pct = Math.min(92, Math.round(15 + (elapsed / targetDuration) * 77));
            setInstallProgress(pct);
            if (pct >= 92) {
              clearInterval(progressInterval);
            }
          }, 100);

          const completeTimeout = setTimeout(() => {
            clearInterval(progressInterval);
            setInstallProgress(100);
            setTimeout(() => {
              setIsInstalling(false);
              window.__pwaInstallPrompt = null;
              setInstallPrompt(null);
              setIsInstalled(true);
              localStorage.setItem('dw_pwa_installed', 'true');
              showToast('✓ App installed to your device successfully!', 'success');
            }, 600);
          }, 3000);

          window.__installCleanup = () => {
            clearInterval(progressInterval);
            clearTimeout(completeTimeout);
          };
        } else {
          setIsInstalling(false);
          setInstallProgress(0);
        }
      } catch (err) {
        console.error('Install error:', err);
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
    <div className="w-full sm:w-[94%] lg:w-[85%] max-w-[1260px] mx-auto px-4 sm:px-6 py-6 pb-20 min-h-screen flex flex-col relative">
      {/* Toast Stack */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm w-full">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-medium backdrop-blur-md shadow-lg border transition-all ${
              t.type === 'success' 
                ? 'bg-white/95 dark:bg-[#11162e]/95 text-slate-900 dark:text-slate-100 border-l-4 border-l-emerald-500 border-slate-200 dark:border-[#1e264a]' 
                : t.type === 'error'
                ? 'bg-white/95 dark:bg-[#11162e]/95 text-slate-900 dark:text-slate-100 border-l-4 border-l-rose-500 border-slate-200 dark:border-[#1e264a]'
                : 'bg-white/95 dark:bg-[#11162e]/95 text-slate-900 dark:text-slate-100 border-l-4 border-l-sky-500 border-slate-200 dark:border-[#1e264a]'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
            {t.type === 'info' && <FolderDown size={16} className="text-sky-500 shrink-0" />}
            {t.type === 'error' && <AlertCircle size={16} className="text-rose-500 shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Install Progress Overlay */}
      {isInstalling && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-5">
          <div className="bg-white dark:bg-[#11162e] border border-slate-200 dark:border-[#1e264a] rounded-3xl p-7 max-w-sm w-full text-center shadow-2xl">
            <img src={appIcon} alt="" className="w-14 h-14 rounded-2xl mx-auto mb-3.5 object-cover shadow-lg shadow-sky-500/20" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Installing AI Metadata Remover…</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Registering app &amp; caching offline resources</p>
            <div className="w-full h-2 bg-slate-100 dark:bg-[#141a38] rounded-full overflow-hidden border border-slate-200 dark:border-[#1e264a] mb-3">
              <div 
                className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(installProgress, 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
              <span>{installProgress >= 100 ? '✓ Ready in your App Drawer!' : 'Installing…'}</span>
              <span className="font-mono font-semibold text-sky-500">{Math.round(installProgress)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <header className="flex items-center justify-between gap-4 pb-5 mb-8 border-b border-slate-200 dark:border-[#1e264a]">
        {/* Left Brand Container (Height: 44px) */}
        <a href="/" className="flex items-center gap-3 text-slate-900 dark:text-slate-100 hover:opacity-90 transition-opacity min-w-0 h-11" title="AI Metadata Remover">
          <img src={appIcon} alt="" className="w-11 h-11 rounded-2xl object-cover shrink-0 shadow-md shadow-sky-500/20 border border-white/10" />
          <div className="flex flex-col justify-center min-w-0">
            <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-slate-100 leading-tight truncate">AI Metadata Remover</span>
            <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 font-medium leading-none">
              by <span className="font-['Syne',sans-serif] font-bold uppercase tracking-[0.06em] text-slate-900 dark:text-white">DEV WONDER</span>
            </span>
          </div>
        </a>

        {/* Right Actions Container (Matching 44px height for all buttons) */}
        <nav className="flex items-center gap-2.5 shrink-0 h-11">
          {/* Theme Toggle (Matching h-11 w-11) */}
          <button 
            type="button" 
            onClick={toggleTheme} 
            className="w-11 h-11 inline-flex items-center justify-center rounded-2xl bg-white dark:bg-[#11162e] border border-slate-200 dark:border-[#1e264a] text-slate-600 dark:text-slate-300 hover:text-sky-500 hover:border-sky-500/40 shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} className="lottie-sparkle" /> : <Moon size={18} />}
          </button>

          {/* Install / Update / Status Button (Matching h-11 height) */}
          {updateAvailable ? (
            <button 
              type="button" 
              onClick={handleApplyUpdate} 
              className="h-11 inline-flex items-center gap-2 px-4 sm:px-5 text-xs sm:text-sm font-semibold rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-sm hover:shadow transition-all cursor-pointer"
              title={`Update to v${remoteVersion}`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 animate-pulse-amber" />
              <span>Update</span>
            </button>
          ) : isStandalone || isInstalled ? (
            <button 
              type="button" 
              onClick={handleCheckUpdate} 
              className="h-11 inline-flex items-center gap-2 px-4 sm:px-5 text-xs sm:text-sm font-semibold rounded-2xl bg-white dark:bg-[#11162e] border border-slate-200 dark:border-[#1e264a] text-slate-800 dark:text-slate-200 shadow-sm hover:shadow transition-all cursor-pointer"
              title={`v${currentVersion} — Check for updates`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse-green" />
              <span>App Installed</span>
            </button>
          ) : (
            <button 
              type="button" 
              onClick={handleInstallClick} 
              className="h-11 inline-flex items-center gap-2.5 px-5 sm:px-6 text-xs sm:text-sm font-bold rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white shadow-md shadow-sky-500/25 hover:shadow-lg transition-all active:scale-95 cursor-pointer"
              title="Install for offline use"
            >
              <LottieDownloadIcon size={16} />
              <span>Install App</span>
            </button>
          )}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/25 mb-4">
            <LottieShieldIcon />
            <span>100% Private · Your photos never leave your device</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mb-3 leading-tight">
            AI Metadata Remover
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto mb-6 leading-relaxed">
            Clean hidden AI traces, prompts, camera details, and location data from your photos in seconds. Free, lossless, and works completely offline.
          </p>

          {/* Stats Chips */}
          <div className="flex justify-center items-center gap-2.5 flex-wrap mb-7">
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#11162e] border border-slate-200 dark:border-[#1e264a] rounded-full text-xs sm:text-sm text-slate-500 dark:text-slate-400 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0 lottie-pulse-ring" />
              <span><strong className="text-slate-900 dark:text-slate-100 font-bold">{stats.images_cleaned.toLocaleString()}</strong> photos cleaned</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#11162e] border border-slate-200 dark:border-[#1e264a] rounded-full text-xs sm:text-sm text-slate-500 dark:text-slate-400 shadow-sm">
              <LottieSparkleIcon size={14} className="text-emerald-500 shrink-0" />
              <span><strong className="text-slate-900 dark:text-slate-100 font-bold">{stats.ai_detected_count.toLocaleString()}</strong> AI traces removed</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#11162e] border border-slate-200 dark:border-[#1e264a] rounded-full text-xs sm:text-sm text-slate-500 dark:text-slate-400 shadow-sm">
              <LottieVisitorIcon size={15} className="text-indigo-500 shrink-0" />
              <span><strong className="text-slate-900 dark:text-slate-100 font-bold">{stats.total_visits.toLocaleString()}</strong> site visits</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#11162e] border border-slate-200 dark:border-[#1e264a] rounded-full text-xs sm:text-sm text-slate-500 dark:text-slate-400 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
              <span><strong className="text-slate-900 dark:text-slate-100 font-bold">0 B</strong> uploaded · 100% local</span>
            </div>
          </div>
        </section>

        {/* Dropzone */}
        <div 
          className={`flex flex-col items-center justify-center p-8 sm:p-11 bg-white dark:bg-[#11162e] border-2 border-dashed rounded-3xl cursor-pointer transition-all shadow-sm text-center relative ${
            isDragOver 
              ? 'border-sky-500 bg-sky-500/5 shadow-md' 
              : recentUpload 
              ? 'border-sky-500' 
              : 'border-slate-200 dark:border-[#1e264a] hover:border-sky-500/70 hover:bg-slate-50/50 dark:hover:bg-[#141a38]/50 hover:shadow-md'
          }`}
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
              <LottieUploadIcon isDragOver={isDragOver} />
              <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                Drop your photos here, or click to choose files
              </div>
              <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4">
                Supports JPG, PNG, WebP, HEIC &amp; AVIF · Zero quality loss
              </div>
              <button 
                type="button" 
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-bold text-sm rounded-full shadow-md shadow-sky-500/25 hover:shadow-lg transition-all active:scale-95 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                <LottieSparkleIcon size={16} className="text-white shrink-0" />
                <span>Select Images</span>
              </button>
              <div className="mt-3.5 text-xs text-slate-400 dark:text-slate-500">
                or press <kbd className="bg-slate-100 dark:bg-[#141a38] border border-slate-200 dark:border-[#1e264a] px-1.5 py-0.5 rounded font-mono text-[11px] text-slate-700 dark:text-slate-300">Ctrl+V</kbd> / <kbd className="bg-slate-100 dark:bg-[#141a38] border border-slate-200 dark:border-[#1e264a] px-1.5 py-0.5 rounded font-mono text-[11px] text-slate-700 dark:text-slate-300">⌘V</kbd> to paste from clipboard
              </div>
            </>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3.5">
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/25 grid place-items-center shrink-0">
                  <FolderDown size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">Add more photos</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Drop files here, click to browse, or paste with Ctrl+V</p>
                </div>
              </div>
              <button 
                type="button" 
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full bg-slate-100 dark:bg-[#141a38] border border-slate-200 dark:border-[#1e264a] text-slate-900 dark:text-slate-100 hover:border-sky-500/50 hover:text-sky-500 transition-all cursor-pointer"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                <Plus size={15} />
                <span>Add More</span>
              </button>
            </div>
          )}
        </div>

        {/* Options Panel */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-[#11162e] border border-slate-200 dark:border-[#1e264a] rounded-2xl shadow-sm mt-4">
          <div className="flex flex-wrap items-center gap-5 sm:gap-6">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={keepICC} 
                onChange={(e) => handleKeepICCChange(e.target.checked)} 
                className="w-4 h-4 mt-0.5 accent-sky-500 rounded cursor-pointer"
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100">Keep original colors</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/25">Recommended</span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Preserves true photo colors without any tint shift</span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={unique} 
                onChange={(e) => handleUniqueChange(e.target.checked)} 
                className="w-4 h-4 mt-0.5 accent-sky-500 rounded cursor-pointer"
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100">Make each file unique</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#141a38] text-slate-500 border border-slate-200 dark:border-[#1e264a]">Optional</span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Adds invisible tweaks so platforms see it as a brand-new file</span>
              </div>
            </label>
          </div>

          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Save files as</label>
            <select 
              value={nameMode} 
              onChange={(e) => setNameMode(e.target.value)}
              className="bg-slate-50 dark:bg-[#141a38] border border-slate-200 dark:border-[#1e264a] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="suffix">photo-clean.jpg (Cleaned suffix)</option>
              <option value="keep">photo.jpg (Keep original name)</option>
              <option value="rename">image-001.jpg (Numbered)</option>
            </select>
          </div>
        </div>

        {/* Batch Bar */}
        {items.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-[#11162e] border border-slate-200 dark:border-[#1e264a] rounded-2xl shadow-sm mt-4">
            <div className="flex items-center gap-2 text-sm text-slate-900 dark:text-slate-100">
              <CheckCircle2 size={18} className="text-sky-500" />
              <span>
                <strong>{doneCount}</strong> of {items.length} photos cleaned
                {processingCount > 0 ? ` · ${processingCount} cleaning…` : ' · Ready to save'}
              </span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button 
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full bg-slate-100 dark:bg-[#141a38] border border-slate-200 dark:border-[#1e264a] text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#1e264a] transition-all cursor-pointer"
                onClick={handleClearAll}
              >
                <RefreshCw size={14} />
                <span>Start Over</span>
              </button>
              {doneCount > 1 && (
                <button 
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  disabled={doneCount === 0 || processingCount > 0} 
                  onClick={handleDownloadAll}
                >
                  <LottieDownloadIcon size={15} />
                  <span>Download All as ZIP ({doneCount})</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Image Results */}
        <div className="flex flex-col gap-2.5 mt-3.5">
          {items.map((it, idx) => {
            const outName = generateOutputName(it, idx);
            const aiCount = (it.out?.ai ? it.out.ai.length : 0) + (it.nameAI?.length ? 1 : 0);

            return (
              <div key={it.id} className="bg-white dark:bg-[#11162e] border border-slate-200 dark:border-[#1e264a] rounded-2xl p-3.5 shadow-sm hover:border-sky-500/40 hover:shadow-md transition-all">
                <div className="grid grid-cols-[48px_1fr] sm:grid-cols-[48px_1fr_auto] items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-[#141a38] border border-slate-200 dark:border-[#1e264a] shrink-0">
                    <img src={it.url || URL.createObjectURL(it.file)} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{outName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {it.status === 'done' 
                        ? `${formatBytes(it.file.size)} → ${formatBytes(it.out.bytes.length)} · ${it.out.method}`
                        : `${formatBytes(it.file.size)} · ${it.status === 'processing' ? 'Cleaning…' : 'Queued'}`
                      }
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {it.status === 'processing' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/25">
                          <RefreshCw size={11} className="animate-spin" />
                          Cleaning…
                        </span>
                      )}
                      {it.status === 'done' && (
                        <>
                          {aiCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              <Sparkles size={11} />
                              AI Traces Found ({aiCount})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#141a38] text-slate-500">
                              No AI Found
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#141a38] text-slate-500">
                            {it.out.removed.length} tags cleaned
                          </span>
                          {it.out.verified && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/25">
                              <CheckCircle2 size={11} />
                              Clean
                            </span>
                          )}
                        </>
                      )}
                      {it.status === 'error' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                          <AlertCircle size={11} />
                          {it.error}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-1 flex items-center justify-end gap-1.5 mt-2 sm:mt-0">
                    {it.status === 'done' && (
                      <>
                        <button 
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-full bg-slate-100 dark:bg-[#141a38] border border-slate-200 dark:border-[#1e264a] text-slate-800 dark:text-slate-200 hover:border-sky-500/50 hover:text-sky-500 transition-all cursor-pointer" 
                          onClick={() => setItems(prev => prev.map(x => x.id === it.id ? { ...x, open: !x.open } : x))}
                        >
                          {it.open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          <span className="hidden sm:inline">{it.open ? 'Hide' : 'Details'}</span>
                        </button>
                        <button 
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-full bg-slate-100 dark:bg-[#141a38] border border-slate-200 dark:border-[#1e264a] text-slate-800 dark:text-slate-200 hover:border-sky-500/50 hover:text-sky-500 transition-all cursor-pointer"
                          onClick={() => handleCopy(it)}
                        >
                          <Copy size={13} />
                          <span className="hidden sm:inline">{copiedId === it.id ? 'Copied!' : 'Copy'}</span>
                        </button>
                        <a 
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white shadow-sm transition-all cursor-pointer"
                          href={it.url} 
                          download={outName}
                        >
                          <Download size={13} />
                          <span className="hidden sm:inline">Download</span>
                        </a>
                      </>
                    )}
                    <button 
                      className="w-8 h-8 rounded-full grid place-items-center text-slate-400 hover:bg-rose-500/15 hover:text-rose-500 transition-all cursor-pointer" 
                      title="Remove" 
                      onClick={() => removeItem(it.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Expandable Details */}
                {it.open && it.out && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-[#1e264a] grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                    <div>
                      <h4 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1.5">Detected AI Traces</h4>
                      <ul className="flex flex-col gap-1 text-slate-600 dark:text-slate-400">
                        {it.out.ai && it.out.ai.length > 0 ? (
                          it.out.ai.map((d, i) => (
                            <li key={i}>
                              <strong className="text-slate-900 dark:text-slate-100 font-semibold">{d.name}</strong>
                              {d.evidence.map((ev, k) => (
                                <span key={k} className="block font-mono text-[11px] bg-slate-100 dark:bg-[#141a38] p-1 rounded text-amber-500 break-all mt-0.5">{ev}</span>
                              ))}
                            </li>
                          ))
                        ) : (
                          <li>No AI tags found</li>
                        )}
                        {it.nameAI && it.nameAI.length > 0 && (
                          <li>
                            <strong className="text-slate-900 dark:text-slate-100 font-semibold">Filename: {it.nameAI.join(', ')}</strong>
                            <span className="block font-mono text-[11px] bg-slate-100 dark:bg-[#141a38] p-1 rounded text-amber-500 break-all mt-0.5">{it.file.name}</span>
                          </li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1.5">Removed Data</h4>
                      <ul className="flex flex-col gap-1 text-slate-600 dark:text-slate-400">
                        {it.out.removed.map((r, i) => (
                          <li key={i}>
                            <strong className="text-slate-900 dark:text-slate-100 font-semibold">{r.label}</strong>
                            {r.bytes ? ` (${formatBytes(r.bytes)})` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1.5">Preserved Info</h4>
                      <ul className="flex flex-col gap-1 text-slate-600 dark:text-slate-400">
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
        <section className="mt-14 max-w-3xl mx-auto w-full">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 text-center mb-4">Frequently Asked Questions</h3>
          <div className="flex flex-col gap-2.5">
            {[
              {
                q: "Does this tool upload my photos to any server?",
                a: "Never. Everything runs 100% inside your own browser. Your photos never leave your device, and nobody else can see them."
              },
              {
                q: "Does removing metadata reduce photo quality?",
                a: "Not at all. Your photos stay 100% crisp with zero quality loss. The tool only deletes invisible background tags (such as camera settings, GPS location, and AI prompts) without modifying your photo pixels."
              },
              {
                q: "Can it remove visible watermarks or Google SynthID?",
                a: "No. This tool cleans hidden file metadata. It cannot remove stamps, logos, or pixel-level watermarks that are embedded directly inside the image pixels (like SynthID)."
              },
              {
                q: "What does 'Make each file unique' do?",
                a: "It adds tiny, invisible tweaks so platforms and websites treat the photo as a brand-new file, while looking completely identical to human eyes."
              },
              {
                q: "Can I use this app without internet (offline)?",
                a: "Yes! Click the 'Install' button at the top to save it to your phone or computer. Once installed, it works fully offline anytime, anywhere."
              }
            ].map((item, idx) => (
              <div key={idx} className="bg-white dark:bg-[#11162e] border border-slate-200 dark:border-[#1e264a] rounded-2xl overflow-hidden shadow-sm hover:border-sky-500/30 transition-colors">
                <button 
                  type="button" 
                  className="w-full px-4 py-3.5 flex justify-between items-center text-left text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-sky-500 gap-3 cursor-pointer"
                  onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
                >
                  <span>{item.q}</span>
                  {faqOpen === idx ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {faqOpen === idx && (
                  <div className="px-4 pb-3.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-[#141a38] pt-2.5">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer (2-Column + Bottom Bar Layout) */}
      <footer className="mt-16 pt-8 border-t border-slate-200 dark:border-[#1e264a] flex flex-col gap-6 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start gap-6 w-full text-center sm:text-left">
          {/* Dev Wonder Info (Desktop: Left / Order 1, Mobile: Bottom / Order 2) */}
          <div className="order-2 sm:order-1 flex flex-col items-center sm:items-start gap-1.5">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
              An open source initiative by
            </span>

            <a
              href="https://www.devwonderbd.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 text-slate-900 dark:text-slate-100 hover:opacity-85 transition-opacity"
              title="Dev Wonder - Simplifying Tech"
            >
              <img
                src={devWonderEmblem}
                alt="Dev Wonder"
                className="h-6 sm:h-7 w-auto object-contain"
              />
              <div className="flex flex-col text-left">
                <span className="font-['Syne',sans-serif] font-bold text-[12px] sm:text-[13px] uppercase tracking-[0.02em] text-black dark:text-white leading-tight">
                  DEV WONDER
                </span>
                <span className="font-['Syne',sans-serif] font-bold text-[9px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                  SIMPLIFYING TECH
                </span>
              </div>
            </a>
          </div>

          {/* GitHub Star button and repository links (Desktop: Right / Order 2, Mobile: Top / Order 1) */}
          <div className="order-1 sm:order-2 flex flex-col items-center sm:items-end gap-3">
            <a
              href="https://github.com/DevWonderBD/ai-metadata-remover"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-white dark:bg-[#11162e] border border-slate-200 dark:border-[#1e264a] text-slate-900 dark:text-slate-100 shadow-sm hover:border-sky-400 hover:text-sky-500 transition-all cursor-pointer"
              title="Star on GitHub"
            >
              <Star size={14} fill="currentColor" />
              <span>Star on GitHub</span>
            </a>

            <nav className="flex items-center justify-center sm:justify-end gap-3 text-xs text-slate-500 dark:text-slate-400" aria-label="Footer links">
              <a
                href="https://github.com/DevWonderBD/ai-metadata-remover"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-sky-500 transition-colors"
              >
                <GithubIcon size={14} />
                <span>GitHub</span>
              </a>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <a
                href="https://github.com/DevWonderBD/ai-metadata-remover/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-sky-500 transition-colors"
              >
                <ExternalLink size={12} />
                <span>MIT License</span>
              </a>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <a
                href="https://github.com/DevWonderBD/ai-metadata-remover/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-sky-500 transition-colors"
              >
                <ExternalLink size={12} />
                <span>Report Issue</span>
              </a>
            </nav>
          </div>
        </div>

        {/* Bottom Bar: Copyright on Left, Version on Right */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2.5 pt-5 border-t border-slate-200 dark:border-[#1e264a] w-full text-xs text-slate-500">
          <p className="m-0">
            © {new Date().getFullYear()} AI Metadata Remover.
          </p>
          <div className="flex items-center">
            <span className="font-mono px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#141a38] border border-slate-200 dark:border-[#1e264a] text-slate-600 dark:text-slate-400">
              v{currentVersion}
            </span>
          </div>
        </div>
      </footer>

      {/* Install Guide Modal */}
      {showInstallModal && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowInstallModal(false)}
        >
          <div 
            className="bg-white dark:bg-[#11162e] border border-slate-200 dark:border-[#1e264a] rounded-3xl max-w-md w-full shadow-2xl overflow-hidden" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-[#1e264a]">
              <div className="flex items-center gap-3">
                <img src={appIcon} alt="" className="w-9 h-9 rounded-xl object-cover" />
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">AI Metadata Remover</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Dev Wonder Open Source</p>
                </div>
              </div>
              <button 
                type="button" 
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#141a38] transition-all cursor-pointer"
                onClick={() => setShowInstallModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {isInstalled || isStandalone ? (
              <div className="p-6 text-center">
                <div className="w-13 h-13 rounded-full bg-sky-500/10 border border-sky-500/25 grid place-items-center mx-auto mb-3 text-sky-500">
                  <CheckCircle2 size={30} />
                </div>
                <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 mb-1">Already Installed!</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">You can open this app anytime from your home screen or app launcher.</p>
                <div className="bg-slate-50 dark:bg-[#141a38] border border-slate-200 dark:border-[#1e264a] rounded-xl p-3 text-left text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  💡 <strong>Want to reinstall?</strong> Uninstall the app first, then reload this page.
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-5 flex flex-col gap-3">
                <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-[#141a38] border border-slate-200 dark:border-[#1e264a] rounded-xl">
                  <Monitor size={20} className="text-sky-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 mb-0.5">Desktop (Chrome / Edge / Brave)</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">Click the <strong>Install icon (⊕ / 📥)</strong> in your browser address bar or menu.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-[#141a38] border border-slate-200 dark:border-[#1e264a] rounded-xl">
                  <Smartphone size={20} className="text-sky-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 mb-0.5">iPhone &amp; iPad (Safari)</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">Tap the <strong>Share</strong> button, scroll down, and tap <strong>Add to Home Screen (+)</strong>.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-[#141a38] border border-slate-200 dark:border-[#1e264a] rounded-xl">
                  <Smartphone size={20} className="text-sky-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 mb-0.5">Android (Chrome / Brave)</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">Tap the <strong>three dots (⋮)</strong> at the top right, then tap <strong>Install app</strong>.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 sm:p-5 pt-0 flex justify-end">
              <button 
                type="button" 
                className="px-5 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white shadow-sm transition-all cursor-pointer"
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

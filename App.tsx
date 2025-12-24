
import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, 
  Video, 
  Layers, 
  Sparkles, 
  Save, 
  Plus, 
  Trash2, 
  Clipboard, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Key,
  Download,
  Clock,
  Send,
  FileText,
  Terminal,
  Cpu,
  BrainCircuit,
  Youtube,
  ShieldCheck,
  Info,
  Copy,
  Activity,
  Zap,
  TestTube2,
  CalendarClock,
  UploadCloud,
  Share2,
  Play,
  Maximize2,
  Globe,
  ListPlus,
  RefreshCw,
  Pencil
} from 'lucide-react';
import { SoraScript, ApiKeys, AppTab, GenerationStatus, AIEngine } from './types';
import { generateSoraScripts, refineVisualPrompt } from './services/aiService';
import { uploadToYouTube } from './services/youtubeService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('generator');
  const [isApiPanelOpen, setIsApiPanelOpen] = useState(false);
  
  const [inputIdea, setInputIdea] = useState('');
  const [scriptCount, setScriptCount] = useState(3);
  const [selectedDuration, setSelectedDuration] = useState('10s');
  const [selectedEngine, setSelectedEngine] = useState<AIEngine>('gemini');
  
  const [scripts, setScripts] = useState<SoraScript[]>([]);
  const [activeScriptIdx, setActiveScriptIdx] = useState(0);
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [selectedScriptIds, setSelectedScriptIds] = useState<Set<string>>(new Set());

  // Tab 3 Publisher State
  const [isUploading, setIsUploading] = useState(false);
  const [userTimezone, setUserTimezone] = useState('');

  // Prompt Refresh State
  const [isRefiningPrompt, setIsRefiningPrompt] = useState(false);

  // 進度條相關狀態
  const [elapsedTime, setElapsedTime] = useState(0);
  const [simulatedProgress, setSimulatedProgress] = useState(0);
  const [systemActivity, setSystemActivity] = useState("Initializing...");

  // Temporary inputs for adding new keys
  const [newSoraCurl, setNewSoraCurl] = useState('');
  const [newYoutubeKey, setNewYoutubeKey] = useState('');
  const [newGeminiKey, setNewGeminiKey] = useState('');

  const [keys, setKeys] = useState<ApiKeys>(() => {
    const STORAGE_KEY = 'sora_app_v6_final_keys';
    const saved = localStorage.getItem(STORAGE_KEY);
    // Default structure
    const defaultKeys: ApiKeys = { 
      soraCurls: [],
      activeSoraCurlIndex: 0,
      youtubeKeys: [], 
      geminiKeys: [],
      openAiKey: '',
      useSimulation: false
    };

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration logic for old format (string) to new format (array)
        return {
           ...defaultKeys,
           ...parsed,
           // If migrating from old version where these were strings
           soraCurls: Array.isArray(parsed.soraCurls) ? parsed.soraCurls : (parsed.soraCurl ? [parsed.soraCurl] : []),
           youtubeKeys: Array.isArray(parsed.youtubeKeys) ? parsed.youtubeKeys : (parsed.youtubeKey ? [parsed.youtubeKey] : []),
           geminiKeys: Array.isArray(parsed.geminiKeys) ? parsed.geminiKeys : (parsed.geminiKey ? [parsed.geminiKey] : []),
        };
      } catch (e) {
        return defaultKeys;
      }
    }
    return defaultKeys;
  });

  useEffect(() => {
    // 取得使用者電腦時區
    setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const saveKeys = () => {
    try {
      if (keys.openAiKey && keys.openAiKey.startsWith('AIzaSy')) {
        alert("警告：您在 OpenAI 欄位填入了 Google/Gemini 的金鑰。請更換為 OpenAI 的金鑰 (sk-...)。");
        return;
      }
      localStorage.setItem('sora_app_v6_final_keys', JSON.stringify(keys));
      alert("✅ 設定已成功儲存！");
      setIsApiPanelOpen(false);
    } catch (e) {
      alert("❌ 儲存失敗。");
    }
  };

  // Helper function to add keys
  const addKey = (type: 'sora' | 'youtube' | 'gemini') => {
    if (type === 'sora' && newSoraCurl.trim()) {
        setKeys(prev => ({ ...prev, soraCurls: [...prev.soraCurls, newSoraCurl.trim()] }));
        setNewSoraCurl('');
    } else if (type === 'youtube' && newYoutubeKey.trim()) {
        setKeys(prev => ({ ...prev, youtubeKeys: [...prev.youtubeKeys, newYoutubeKey.trim()] }));
        setNewYoutubeKey('');
    } else if (type === 'gemini' && newGeminiKey.trim()) {
        setKeys(prev => ({ ...prev, geminiKeys: [...prev.geminiKeys, newGeminiKey.trim()] }));
        setNewGeminiKey('');
    }
  };

  // Helper function to remove keys
  const removeKey = (type: 'sora' | 'youtube' | 'gemini', index: number) => {
    if (type === 'sora') {
        const newArr = keys.soraCurls.filter((_, i) => i !== index);
        setKeys(prev => ({ 
            ...prev, 
            soraCurls: newArr,
            activeSoraCurlIndex: prev.activeSoraCurlIndex >= newArr.length ? 0 : prev.activeSoraCurlIndex 
        }));
    } else if (type === 'youtube') {
        setKeys(prev => ({ ...prev, youtubeKeys: prev.youtubeKeys.filter((_, i) => i !== index) }));
    } else if (type === 'gemini') {
        setKeys(prev => ({ ...prev, geminiKeys: prev.geminiKeys.filter((_, i) => i !== index) }));
    }
  };

  const parseHeadersFromCurl = (curlStr: string) => {
    const headers: Record<string, string> = {};
    const headerMatches = curlStr.match(/-H\s+['"]([^'"]+):\s+([^'"]+)['"]/g) || 
                          curlStr.match(/-H\s+([^:\s]+):\s+([^'"\s]+)/g);
    if (headerMatches) {
      headerMatches.forEach(m => {
        const parts = m.match(/-H\s+['"]?([^: '"]+):\s+([^'"]+)['"]?/);
        if (parts && parts.length >= 3) {
          headers[parts[1].toLowerCase()] = parts[2];
        }
      });
    }
    return headers;
  };

  // Script Editing Functions
  const handleScriptUpdate = (id: string, field: keyof SoraScript, value: any) => {
    setScripts(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleTagsUpdate = (id: string, value: string) => {
    const tags = value.split(',').map(t => t.trim()).filter(t => t);
    handleScriptUpdate(id, 'videoTags', tags);
  };

  const handleRefinePrompt = async (script: SoraScript) => {
    if (isRefiningPrompt) return;
    setIsRefiningPrompt(true);
    try {
        const newPrompt = await refineVisualPrompt(script.concept, keys.geminiKeys);
        handleScriptUpdate(script.id, 'visualPrompt', newPrompt);
        alert("Prompt 已根據中文創意同步更新！");
    } catch (e: any) {
        alert(e.message || "更新失敗");
    } finally {
        setIsRefiningPrompt(false);
    }
  };

  const handleGenerateScripts = async () => {
    if (!inputIdea.trim()) {
      setErrorMsg("請先輸入劇本構思。");
      return;
    }
    setStatus(GenerationStatus.GENERATING);
    setErrorMsg('');
    try {
      // 傳遞整個 geminiKeys 陣列給 service 進行輪替
      const results = await generateSoraScripts(
          selectedEngine, 
          inputIdea, 
          scriptCount, 
          selectedDuration, 
          keys.openAiKey,
          keys.geminiKeys
      );
      setScripts(results);
      setSelectedScriptIds(new Set(results.map(r => r.id)));
      setStatus(GenerationStatus.SUCCESS);
      setActiveTab('results');
      setActiveScriptIdx(0);
    } catch (err: any) {
      setStatus(GenerationStatus.ERROR);
      setErrorMsg(err.message || "劇本編寫失敗。");
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleSelect = (id: string) => {
    setSelectedScriptIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("內容已複製到剪貼簿！");
  };

  const getLocalISOString = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
  };

  const handleTimeChange = (id: string, newTime: string) => {
    setScripts(prev => prev.map(s => s.id === id ? { ...s, publishTime: newTime } : s));
  };

  const applySmartSchedule = () => {
    const selected = scripts.filter(s => selectedScriptIds.has(s.id) && s.status === 'completed');
    if (selected.length === 0) return alert("請先勾選要排程的影片。");

    const startDate = new Date();
    startDate.setHours(startDate.getHours() + 1);
    startDate.setMinutes(0);

    const intervalMs = selected.length > 1 ? (24 * 60 * 60 * 1000) / selected.length : 0;

    let updatedCount = 0;
    const newScripts = scripts.map(s => {
        if (selectedScriptIds.has(s.id) && s.status === 'completed') {
            const publishAt = new Date(startDate.getTime() + (updatedCount * intervalMs));
            updatedCount++;
            return { ...s, publishTime: getLocalISOString(publishAt) };
        }
        return s;
    });
    setScripts(newScripts);
    alert(`已依據您的電腦時間 (${userTimezone})，為 ${selected.length} 部影片設定 24 小時內的排程。`);
  };

  useEffect(() => {
    const currentScript = scripts[activeScriptIdx];
    if (!currentScript) return;

    if (currentScript.status === 'processing' || currentScript.status === 'monitoring') {
      const startTime = currentScript.startTime || Date.now();
      const timer = setInterval(() => {
        const now = Date.now();
        const seconds = Math.floor((now - startTime) / 1000);
        setElapsedTime(seconds);
        const estimatedTotal = selectedDuration === '15s' ? 300 : 180;
        let progress = (seconds / estimatedTotal) * 100;
        if (progress > 98) progress = 98;
        setSimulatedProgress(progress);
        const activities = [
          "Allocating Neural Grid...", "Synthesizing Frame Textures...", "Denoising Vector Fields...",
          "Syncing Audio Channels...", "Refining 3D Geometry...", "Calculating Physics...", "Raytracing Global Illumination..."
        ];
        if (seconds % 5 === 0) {
          setSystemActivity(activities[Math.floor(Math.random() * activities.length)]);
        }
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setElapsedTime(0);
      setSimulatedProgress(0);
    }
  }, [activeScriptIdx, scripts, selectedDuration]);

  const handleManualDownload = async (script: SoraScript) => {
    if (!script.videoUrl) return alert("未找到影片連結，請重新執行生產。");
    const safeTitle = script.title.replace(/[\\/:*?"<>|]/g, '_');
    const videoFilename = `${safeTitle}.mp4`;
    const textFilename = `${safeTitle}_說明標籤.txt`;
    try {
      const res = await fetch(script.videoUrl);
      const blob = await res.blob();
      downloadBlob(blob, videoFilename);
      setTimeout(() => {
        const textContent = `標題: ${script.title}\n\n核心創意: ${script.concept}\n\n解說: ${script.videoDescription}\n\n標籤: ${script.videoTags.join(', ')}\n\nPrompt: ${script.visualPrompt}`;
        downloadBlob(new Blob([textContent], { type: 'text/plain' }), textFilename);
      }, 500);
    } catch (e) {
      alert("下載失敗，連結可能已過期。請重新執行生產。");
    }
  };

  const handleSoraProduction = async () => {
    const selected = scripts.filter(s => selectedScriptIds.has(s.id));
    if (selected.length === 0) return alert("請至少勾選一個腳本方案。");
    
    // Check Active Sora Curl
    const activeCurl = keys.soraCurls[keys.activeSoraCurlIndex];

    if (!keys.useSimulation && !activeCurl) {
      setIsApiPanelOpen(true);
      return alert("請先新增並選取一組 Sora cURL 憑證，或開啟「模擬測試模式」。");
    }

    let authHeaders: Record<string, string> = {};
    if (!keys.useSimulation) {
      authHeaders = parseHeadersFromCurl(activeCurl);
      if (!authHeaders['authorization']) return alert("目前的 cURL 憑證無效，未找到 Authorization。");
    }

    const scriptStartTime = Math.floor(Date.now() / 1000) - 10;
    const nowTs = Date.now();

    setScripts(prev => prev.map(s => 
      selectedScriptIds.has(s.id) ? { 
        ...s, 
        status: 'processing', 
        progressLog: keys.useSimulation ? '🧪 [模擬模式] 正在連接虛擬伺服器...' : `🚀 使用帳號 #${keys.activeSoraCurlIndex + 1} 連接 SORA...`,
        startTime: nowTs
      } : s
    ));

    let completedCount = 0;

    const processScript = async (script: SoraScript) => {
      try {
        if (keys.useSimulation) {
           await new Promise(res => setTimeout(res, 2000 + Math.random() * 2000));
           const taskId = `SIM-${Math.floor(Math.random() * 100000)}`;
           setScripts(prev => prev.map(s => 
             s.id === script.id ? { ...s, status: 'monitoring', progressLog: `✅ [模擬] 任務提交成功 ID: ${taskId}\n📡 監控佇列中...` } : s
           ));
           await new Promise(res => setTimeout(res, 5000 + Math.random() * 3000));
           const sampleVideoUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";
           const videoRes = await fetch(sampleVideoUrl);
           const videoBlob = await videoRes.blob();
           const localVideoUrl = URL.createObjectURL(videoBlob);
           
           downloadBlob(videoBlob, `[模擬]_${script.title}.mp4`);
           setScripts(prev => prev.map(s => s.id === script.id ? { 
             ...s, 
             status: 'completed', 
             progressLog: '🎉 [模擬] 生產完畢！',
             videoUrl: localVideoUrl 
           } : s));
        } else {
           const nFrames = selectedDuration === '15s' ? 450 : 300;
           const prompt = script.visualPrompt || script.concept;
 
           const response = await fetch("https://sora.chatgpt.com/backend/nf/create", {
             method: "POST",
             headers: {
               'accept': '*/*',
               'authorization': authHeaders['authorization'],
               'content-type': 'application/json',
               'openai-sentinel-token': authHeaders['openai-sentinel-token'] || '',
             },
             body: JSON.stringify({ kind: "video", prompt: prompt, orientation: "landscape", size: "small", n_frames: nFrames, model: "sy_8", n: 1 })
           });
 
           if (!response.ok) {
             const errText = await response.text();
             throw new Error(`伺服器回應錯誤 (${response.status}): ${errText.substring(0, 50)}`);
           }
           
           const createData = await response.json();
           const taskId = createData.id;
 
           setScripts(prev => prev.map(s => 
             s.id === script.id ? { ...s, status: 'monitoring', progressLog: `✅ 任務提交成功 ID: ${taskId}\n📡 監控佇列中...` } : s
           ));
 
           let foundDownload = false;
           const monitorUrl = "https://sora.chatgpt.com/backend/project_y/profile/drafts?limit=15";
           const startTime = Date.now();
 
           while (!foundDownload) {
             if (Date.now() - startTime > 1200000) throw new Error("生產超時 (20分鐘)");
             const r = await fetch(monitorUrl, { headers: { 'authorization': authHeaders['authorization'] } });
             if (r.ok) {
               const data = await r.json();
               const items = Array.isArray(data) ? data : (data.items || []);
               const target = items.find((item: any) => item.id === taskId || (item.created_at >= scriptStartTime && item.prompt?.includes(prompt.substring(0, 10))));
               if (target) {
                 const dlUrl = target.downloadable_url || target.url || (target.result && target.result.video_url);
                 if (dlUrl) {
                   const videoRes = await fetch(dlUrl);
                   const videoBlob = await videoRes.blob();
                   const localVideoUrl = URL.createObjectURL(videoBlob); 
                   const videoFilename = `${script.title}.mp4`;
                   downloadBlob(videoBlob, videoFilename);
                   foundDownload = true;
                   setScripts(prev => prev.map(s => s.id === script.id ? { 
                     ...s, 
                     status: 'completed', 
                     progressLog: '🎉 生產完畢！已下載。',
                     videoUrl: localVideoUrl 
                   } : s));
                 }
               }
             }
             if (!foundDownload) await new Promise(res => setTimeout(res, 12000));
           }
        }
      } catch (err: any) {
        let errMsg = err.message;
        if (err instanceof TypeError && errMsg === "Failed to fetch") errMsg = "連線失敗。請確認 CORS 設定。";
        setScripts(prev => prev.map(s => s.id === script.id ? { ...s, status: 'error', progressLog: `❌ 錯誤: ${errMsg}` } : s));
      } finally {
        completedCount++;
        if (completedCount === selected.length) {
            setTimeout(() => {
                setActiveTab('publisher');
                alert("所有任務執行完畢，已切換至「發布排程」分頁。");
            }, 1500);
        }
      }
    };
    selected.forEach(script => processScript(script));
  };

  const handleBatchUpload = async () => {
    const selected = scripts.filter(s => selectedScriptIds.has(s.id) && s.status === 'completed' && s.videoUrl);
    if (selected.length === 0) return alert("請勾選至少一個已完成的影片進行上傳。");
    
    // Check if we have YouTube keys
    if (!keys.useSimulation && keys.youtubeKeys.length === 0) {
        setIsApiPanelOpen(true);
        return alert("請先新增 YouTube OAuth Access Token。");
    }

    const missingTime = selected.find(s => !s.publishTime);
    if (missingTime) return alert(`影片 "${missingTime.title}" 尚未設定發布時間。`);

    setIsUploading(true);

    // Copy keys to a temporary list to rotate through during this batch
    let availableKeys = [...keys.youtubeKeys]; 

    for (let i = 0; i < selected.length; i++) {
        const script = selected[i];
        const publishAt = new Date(script.publishTime!); 
        
        setScripts(prev => prev.map(s => s.id === script.id ? { ...s, uploadStatus: 'uploading' } : s));

        try {
            let videoId = "";
            if (keys.useSimulation) {
                await new Promise(r => setTimeout(r, 2000));
                videoId = "sim_yt_" + Math.random().toString(36).substring(7);
            } else {
                // Rotation logic
                let success = false;
                let lastError = null;

                while (availableKeys.length > 0 && !success) {
                    const currentKey = availableKeys[0]; // Always try the first available
                    try {
                        const res = await fetch(script.videoUrl!);
                        const blob = await res.blob();
                        videoId = await uploadToYouTube(script, blob, currentKey, publishAt);
                        success = true;
                    } catch (e: any) {
                        console.warn(`YouTube Key failed: ${currentKey.substring(0,5)}...`, e);
                        lastError = e;
                        // Remove failed key and try next
                        availableKeys.shift();
                        if (availableKeys.length > 0) {
                             console.log(`Switching to next key... (${availableKeys.length} left)`);
                        }
                    }
                }

                if (!success) throw lastError || new Error("All YouTube keys failed.");
            }

            setScripts(prev => prev.map(s => s.id === script.id ? { 
                ...s, 
                uploadStatus: 'success',
                youtubeId: videoId
            } : s));

        } catch (e: any) {
            console.error(e);
            setScripts(prev => prev.map(s => s.id === script.id ? { ...s, uploadStatus: 'failed' } : s));
        }
    }
    setIsUploading(false);
    alert("批次上傳流程結束！");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#020817] text-slate-100 overflow-hidden font-sans">
      <nav className="w-full md:w-64 border-r border-blue-900/20 bg-[#030e21] flex flex-col p-4 z-50">
        <div className="flex items-center gap-3 px-3 mb-10">
          <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="block font-black text-xl text-white tracking-tighter">SORA 2</span>
            <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">Architect</span>
          </div>
        </div>
        <div className="space-y-2 flex-1">
          <button onClick={() => setActiveTab('generator')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${activeTab === 'generator' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}>
            <Sparkles className="w-4 h-4" /> <span className="text-sm font-bold">1. 劇本生成</span>
          </button>
          <button onClick={() => setActiveTab('results')} disabled={scripts.length === 0} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${activeTab === 'results' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-slate-400'} ${scripts.length === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}>
            <Layers className="w-4 h-4" /> <span className="text-sm font-bold">2. 生產控制</span>
          </button>
           <button onClick={() => setActiveTab('publisher')} disabled={scripts.filter(s => s.status === 'completed').length === 0} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${activeTab === 'publisher' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-slate-400'} ${scripts.filter(s => s.status === 'completed').length === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:text-white'}`}>
            <Share2 className="w-4 h-4" /> <span className="text-sm font-bold">3. 發布排程</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 relative flex flex-col overflow-y-auto bg-[#020817] custom-scrollbar">
        <div className="sticky top-0 z-40 p-4 border-b border-blue-900/10 bg-[#020817]/95 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto">
            <button onClick={() => setIsApiPanelOpen(!isApiPanelOpen)} className="w-full flex items-center justify-between px-6 py-4 bg-blue-900/10 border border-blue-500/20 rounded-2xl">
              <div className="flex items-center gap-3">
                <Settings className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-black text-blue-200 uppercase tracking-widest">API 中心</span>
              </div>
              {isApiPanelOpen ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />}
            </button>

            {isApiPanelOpen && (
              <div className="mt-4 p-8 bg-[#030e21] border border-blue-900/30 rounded-[2.5rem] shadow-2xl space-y-8 animate-in slide-in-from-top-4">
                
                {/* 模擬模式開關 */}
                <div className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg">
                            <TestTube2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <span className="block text-sm font-bold text-white">模擬測試模式 (Simulation Mode)</span>
                            <span className="text-[10px] text-blue-300">開啟後將模擬 API 回應，無需真實 Token 或 CORS 擴充功能即可測試流程。</span>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={keys.useSimulation || false} onChange={(e) => setKeys({...keys, useSimulation: e.target.checked})} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {/* SORA cURL Section */}
                <div className="space-y-4 border-b border-slate-800 pb-8">
                  <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest">Sora cURL 憑證管理</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">使用中:</span>
                        <select 
                            value={keys.activeSoraCurlIndex} 
                            onChange={(e) => setKeys(p => ({...p, activeSoraCurlIndex: parseInt(e.target.value)}))}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs outline-none"
                        >
                            {keys.soraCurls.length === 0 && <option value={0}>無憑證</option>}
                            {keys.soraCurls.map((_, i) => (
                                <option key={i} value={i}>憑證 #{i + 1}</option>
                            ))}
                        </select>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <textarea value={newSoraCurl} onChange={(e) => setNewSoraCurl(e.target.value)} placeholder="貼上來自 Chrome Network 的 cURL..." className="flex-1 h-20 bg-slate-950 border border-slate-800 rounded-xl p-4 text-[10px] font-mono text-emerald-400 outline-none resize-none" />
                      <button onClick={() => addKey('sora')} className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-xl flex items-center justify-center"><Plus className="w-5 h-5"/></button>
                  </div>
                  <div className="space-y-2">
                      {keys.soraCurls.map((k, i) => (
                          <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${i === keys.activeSoraCurlIndex ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-900/50 border-slate-800'}`}>
                              <span className="text-xs font-mono text-slate-400 truncate w-3/4">憑證 #{i + 1}: {k.substring(0, 30)}...</span>
                              <button onClick={() => removeKey('sora', i)} className="text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                          </div>
                      ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Gemini Keys */}
                  <div className="space-y-4">
                      <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                          Gemini API Keys <span className="text-[9px] bg-slate-800 px-1 rounded text-slate-400">自動輪替</span>
                      </h3>
                      <div className="flex gap-2">
                          <input type="password" value={newGeminiKey} onChange={(e) => setNewGeminiKey(e.target.value)} placeholder="輸入 Gemini API Key..." className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs" />
                          <button onClick={() => addKey('gemini')} className="bg-blue-600 hover:bg-blue-500 text-white px-3 rounded-xl"><Plus className="w-4 h-4"/></button>
                      </div>
                      <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-2">
                          {keys.geminiKeys.map((k, i) => (
                              <div key={i} className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-800">
                                  <span className="text-xs font-mono text-slate-400">...{k.slice(-4)}</span>
                                  <button onClick={() => removeKey('gemini', i)} className="text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3"/></button>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* YouTube Keys */}
                  <div className="space-y-4">
                      <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                          YouTube Access Tokens <span className="text-[9px] bg-slate-800 px-1 rounded text-slate-400">自動輪替</span>
                      </h3>
                      <div className="flex gap-2">
                          <input type="password" value={newYoutubeKey} onChange={(e) => setNewYoutubeKey(e.target.value)} placeholder="輸入 OAuth Token..." className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs" />
                          <button onClick={() => addKey('youtube')} className="bg-red-600 hover:bg-red-500 text-white px-3 rounded-xl"><Plus className="w-4 h-4"/></button>
                      </div>
                      <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-2">
                          {keys.youtubeKeys.map((k, i) => (
                              <div key={i} className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-800">
                                  <span className="text-xs font-mono text-slate-400">Token #{i+1}</span>
                                  <button onClick={() => removeKey('youtube', i)} className="text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3"/></button>
                              </div>
                          ))}
                      </div>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-6">
                     <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">OpenAI Key (單一)</h3>
                     <input type="password" value={keys.openAiKey} onChange={(e) => setKeys({...keys, openAiKey: e.target.value})} placeholder="OpenAI Key (sk-...)" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs" />
                </div>

                <button onClick={saveKeys} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-black rounded-xl">儲存所有設定 (Local Storage)</button>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto p-6 md:p-12 w-full">
          {activeTab === 'generator' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8">
              <header className="space-y-4">
                <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter leading-none">SORA 2<br/><span className="text-blue-500">腳本工程師</span></h1>
                <p className="text-slate-400 text-lg max-w-2xl leading-relaxed">輸入您的創意核心，AI 將自動編寫多組具備視覺提示詞、運鏡與解說標籤的生產方案。</p>
              </header>

              <div className="bg-slate-900/40 border border-blue-900/20 rounded-[3rem] p-8 md:p-12 space-y-10 shadow-2xl">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1 space-y-4">
                    <label className="text-xs font-black text-blue-500 uppercase">AI 引擎</label>
                    <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-950 rounded-2xl">
                      <button onClick={() => setSelectedEngine('gemini')} className={`py-3.5 rounded-xl text-xs font-black ${selectedEngine === 'gemini' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Gemini 3 Pro</button>
                      <button onClick={() => setSelectedEngine('openai')} className={`py-3.5 rounded-xl text-xs font-black ${selectedEngine === 'openai' ? 'bg-[#10a37f] text-white' : 'text-slate-500'}`}>GPT-4o</button>
                    </div>
                  </div>
                  <div className="w-full md:w-48 space-y-4">
                    <label className="text-xs font-black text-slate-500 uppercase">預計時長</label>
                    <select value={selectedDuration} onChange={(e) => setSelectedDuration(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 font-bold text-white outline-none">
                      <option value="10s">10 秒 (300 幀)</option>
                      <option value="15s">15 秒 (450 幀)</option>
                    </select>
                  </div>
                  <div className="w-full md:w-32 space-y-4">
                    <label className="text-xs font-black text-slate-500 uppercase">數量</label>
                    <input type="number" min="1" max="10" value={scriptCount} onChange={(e) => setScriptCount(parseInt(e.target.value) || 1)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center font-bold text-white outline-none" />
                  </div>
                </div>
                <textarea value={inputIdea} onChange={(e) => setInputIdea(e.target.value)} placeholder="在此描述您的畫面內容細節..." className="w-full h-64 bg-slate-950 border border-slate-800 rounded-3xl p-8 text-xl focus:border-blue-500/50 outline-none resize-none" />
                <button onClick={handleGenerateScripts} disabled={status === GenerationStatus.GENERATING} className="w-full h-20 bg-blue-600 text-white font-black rounded-[2rem] flex items-center justify-center gap-4 hover:bg-blue-500 active:scale-95 transition-all">
                  {status === GenerationStatus.GENERATING ? <Loader2 className="w-8 h-8 animate-spin" /> : <Sparkles className="w-8 h-8" />}
                  <span className="text-xl">啟動 AI 腳本編寫流程</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'results' && (
            <div className="space-y-10 animate-in fade-in zoom-in-95">
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-blue-900/10 pb-10">
                <div>
                  <h1 className="text-4xl font-black text-white">生產控制室</h1>
                  <p className="text-slate-500 text-sm mt-1">選取的劇本方案將在點擊下方按鈕後自動進入 SORA 生產序列。</p>
                </div>
                <button onClick={handleSoraProduction} className="px-12 py-5 bg-gradient-to-r from-blue-700 to-indigo-600 text-white rounded-[2rem] font-black shadow-2xl flex items-center gap-4 active:scale-95 transition-all text-lg">
                  <Send className="w-6 h-6" /> 執行批次生產下載
                </button>
              </header>

              <div className="flex flex-wrap gap-3 p-3 bg-slate-900/60 rounded-[2rem] border border-blue-900/10 sticky top-28 z-30 backdrop-blur-xl">
                {scripts.map((s, idx) => {
                  const isActive = activeScriptIdx === idx;
                  let containerClass = "";
                  let textClass = "";
                  let icon = null;

                  if (s.status === 'processing' || s.status === 'monitoring') {
                    containerClass = isActive 
                      ? "bg-blue-500/20 ring-1 ring-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]" 
                      : "bg-blue-500/5 border border-blue-500/10";
                    textClass = "text-blue-400";
                    icon = <Loader2 className="w-3.5 h-3.5 animate-spin" />;
                  } else if (s.status === 'completed') {
                    containerClass = isActive 
                      ? "bg-emerald-500/20 ring-1 ring-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]" 
                      : "bg-emerald-500/5 border border-emerald-500/10";
                    textClass = "text-emerald-400";
                    icon = <CheckCircle2 className="w-3.5 h-3.5" />;
                  } else if (s.status === 'error') {
                     containerClass = isActive 
                      ? "bg-rose-500/20 ring-1 ring-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]" 
                      : "bg-rose-500/5 border border-rose-500/10";
                    textClass = "text-rose-400";
                    icon = <AlertCircle className="w-3.5 h-3.5" />;
                  } else {
                    // IDLE
                    containerClass = isActive 
                      ? "bg-slate-700/50 ring-1 ring-slate-500 shadow-lg" 
                      : "hover:bg-slate-800/50 border border-transparent";
                    textClass = isActive ? "text-white" : "text-slate-500 hover:text-slate-300";
                  }

                  return (
                    <div key={s.id} className={`flex items-center gap-1 rounded-2xl transition-all duration-300 ${containerClass}`}>
                      <div className="pl-4">
                        <input 
                          type="checkbox" 
                          checked={selectedScriptIds.has(s.id)} 
                          onChange={() => toggleSelect(s.id)} 
                          className={`w-5 h-5 cursor-pointer rounded-md ${
                            s.status === 'completed' ? 'accent-emerald-500' : 
                            s.status === 'error' ? 'accent-rose-500' : 'accent-blue-600'
                          }`} 
                        />
                      </div>
                      <button onClick={() => setActiveScriptIdx(idx)} className={`px-5 py-3 rounded-2xl text-xs font-black flex items-center gap-2 ${textClass}`}>
                        {icon}
                        <span>方案 {idx + 1}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {scripts[activeScriptIdx] && (
                <div className="bg-slate-900/30 border border-blue-900/20 rounded-[3rem] overflow-hidden shadow-2xl backdrop-blur-sm animate-in slide-in-from-right-8">
                  <div className="p-8 md:p-14 space-y-12">
                    <div className="flex flex-col md:flex-row justify-between gap-8 border-b border-blue-900/10 pb-12">
                      <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-blue-500 tracking-widest px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg uppercase">DATA BLOCK</span>
                        </div>
                        {/* 標題編輯 */}
                        <input 
                           value={scripts[activeScriptIdx].title}
                           onChange={(e) => handleScriptUpdate(scripts[activeScriptIdx].id, 'title', e.target.value)}
                           className="w-full bg-transparent text-4xl font-black text-white outline-none border-b border-transparent focus:border-blue-500/50 transition-colors placeholder-slate-600"
                           placeholder="輸入標題..."
                        />
                        {/* 核心創意編輯 */}
                        <div className="relative group">
                            <textarea 
                                value={scripts[activeScriptIdx].concept}
                                onChange={(e) => handleScriptUpdate(scripts[activeScriptIdx].id, 'concept', e.target.value)}
                                className="w-full bg-transparent text-xl italic text-slate-400 border-l-4 border-blue-600 pl-4 leading-relaxed font-light outline-none resize-none focus:bg-slate-900/30 transition-colors rounded-r-lg"
                                rows={2}
                                placeholder="輸入核心創意..."
                            />
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <Pencil className="w-4 h-4 text-slate-600" />
                            </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">生產影片長度</label>
                        <div className="bg-slate-950 px-6 py-3 rounded-3xl border border-slate-800 flex items-center gap-4 h-fit shadow-2xl">
                          <Clock className="w-5 h-5 text-blue-400" />
                          <select 
                            value={selectedDuration} 
                            onChange={(e) => setSelectedDuration(e.target.value)}
                            className="bg-transparent text-xl font-black text-blue-400 outline-none cursor-pointer appearance-none pr-4"
                          >
                            <option value="10s" className="bg-slate-900">10 秒</option>
                            <option value="15s" className="bg-slate-900">15 秒</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {scripts[activeScriptIdx].status === 'completed' && scripts[activeScriptIdx].videoUrl && (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="w-full bg-slate-950 rounded-[2.5rem] border border-blue-500/20 overflow-hidden shadow-[0_0_40px_rgba(59,130,246,0.15)] relative group">
                          <video 
                            src={scripts[activeScriptIdx].videoUrl} 
                            controls 
                            className="w-full max-h-[600px] object-contain"
                          />
                          <div className="absolute top-4 right-4 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full text-xs font-black text-white border border-white/10 pointer-events-none">
                            PREVIEW MONITOR
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                      <div className="space-y-12">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                             <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2"><Video className="w-4 h-4" /> 視覺核心提示詞 (Visual Prompt)</h4>
                             <button 
                                onClick={() => handleRefinePrompt(scripts[activeScriptIdx])}
                                disabled={isRefiningPrompt}
                                className="text-[10px] bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white px-3 py-1.5 rounded-lg border border-blue-500/30 flex items-center gap-2 transition-all"
                                title="根據中文核心創意重新生成英文 Prompt"
                             >
                                <RefreshCw className={`w-3 h-3 ${isRefiningPrompt ? 'animate-spin' : ''}`} />
                                {isRefiningPrompt ? '同步優化中...' : 'AI 同步更新 Prompt'}
                             </button>
                          </div>
                          <div className="bg-slate-950 p-2 rounded-[2.5rem] border border-slate-800 shadow-inner relative group focus-within:border-blue-500/50 transition-colors">
                            <textarea 
                                value={scripts[activeScriptIdx].visualPrompt}
                                onChange={(e) => handleScriptUpdate(scripts[activeScriptIdx].id, 'visualPrompt', e.target.value)}
                                className="w-full h-48 bg-transparent p-6 text-sm text-slate-300 leading-relaxed outline-none resize-none custom-scrollbar"
                                placeholder="AI 正在編寫中..."
                            />
                            <div className="absolute bottom-4 right-6 flex gap-2">
                                <button 
                                    onClick={() => copyToClipboard(scripts[activeScriptIdx].visualPrompt)}
                                    className="p-2 bg-slate-800 hover:bg-blue-600 rounded-lg text-slate-400 hover:text-white transition-all shadow-lg"
                                    title="複製提示詞"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2"><FileText className="w-4 h-4" /> 影片解說與標籤</h4>
                          <div className="p-6 bg-blue-600/5 rounded-[2.5rem] border border-blue-500/10 space-y-4 relative group focus-within:bg-blue-600/10 focus-within:border-blue-500/30 transition-all">
                            <textarea 
                                value={scripts[activeScriptIdx].videoDescription}
                                onChange={(e) => handleScriptUpdate(scripts[activeScriptIdx].id, 'videoDescription', e.target.value)}
                                className="w-full bg-transparent text-sm text-slate-300 italic outline-none resize-none"
                                rows={4}
                                placeholder="影片解說..."
                            />
                            <div className="pt-4 border-t border-blue-500/10">
                              <label className="text-[9px] text-blue-400 mb-2 block">標籤 (逗號分隔):</label>
                              <input 
                                value={scripts[activeScriptIdx].videoTags.join(', ')}
                                onChange={(e) => handleTagsUpdate(scripts[activeScriptIdx].id, e.target.value)}
                                className="w-full bg-slate-950/50 text-[10px] font-black text-blue-300 px-4 py-3 rounded-xl border border-blue-500/10 outline-none focus:border-blue-500/40"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-8">
                        <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2"><Terminal className="w-4 h-4" /> 生產日誌終端</h4>
                        <div className="bg-slate-950 p-10 rounded-[3rem] border border-slate-800 h-[520px] flex flex-col font-mono text-[11px] shadow-2xl relative">
                          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                            {scripts[activeScriptIdx].status === 'idle' ? (
                              <p className="text-slate-700 italic">等待點擊「執行生產」發送任務...</p>
                            ) : (
                              <div className={`${scripts[activeScriptIdx].status === 'error' ? 'text-red-400' : 'text-emerald-500'} leading-loose`}>
                                <pre className="whitespace-pre-wrap">{scripts[activeScriptIdx].progressLog}</pre>
                              </div>
                            )}
                          </div>
                          
                          {(scripts[activeScriptIdx].status === 'processing' || scripts[activeScriptIdx].status === 'monitoring') && (
                            <div className="mt-6 pt-6 border-t border-slate-800 space-y-5 animate-in slide-in-from-bottom-2">
                              {/* 儀表板區域 */}
                              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2 text-blue-400">
                                    <Activity className="w-3 h-3 animate-pulse" />
                                    <span>SYS_ACTIVE</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Cpu className="w-3 h-3" />
                                    <span>GPU_LOAD: {Math.floor(simulatedProgress * 0.4 + 60)}%</span>
                                  </div>
                                </div>
                                <div className="font-mono text-blue-300">
                                  T+{formatTime(elapsedTime)}
                                </div>
                              </div>

                              {/* 進度條 */}
                              <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                  <span className="text-[10px] text-blue-500 uppercase tracking-widest animate-pulse">{systemActivity}</span>
                                  <span className="text-xs font-black text-blue-400">{Math.floor(simulatedProgress)}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                                  <div 
                                    className="h-full bg-gradient-to-r from-blue-600 via-blue-400 to-cyan-300 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-300 ease-out"
                                    style={{ width: `${simulatedProgress}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 手動下載按鈕 - 僅在完成時顯示 */}
                          {scripts[activeScriptIdx].status === 'completed' && (
                            <div className="mt-4 pt-4 border-t border-slate-800 animate-in fade-in">
                               <button 
                                 onClick={() => handleManualDownload(scripts[activeScriptIdx])}
                                 className="w-full py-3 bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-600/20 transition-all text-xs uppercase tracking-widest"
                               >
                                 <Download className="w-4 h-4" /> 再次下載影片與資料
                               </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'publisher' && (
             <div className="space-y-10 animate-in fade-in zoom-in-95">
                 <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-blue-900/10 pb-10">
                    <div>
                        <h1 className="text-4xl font-black text-white">發布排程中心</h1>
                        <p className="text-slate-500 text-sm mt-1">選取已完成的影片，設定 24H 內的排程並自動上傳至 YouTube。</p>
                        <div className="mt-2 flex items-center gap-2">
                             <Globe className="w-3 h-3 text-slate-500" />
                             <span className="text-[10px] text-slate-500 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800">
                                您的時區: {userTimezone}
                             </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={applySmartSchedule} className="px-6 py-5 bg-blue-900/30 text-blue-300 border border-blue-500/30 rounded-[2rem] font-bold flex items-center gap-2 hover:bg-blue-900/50 transition-all text-sm">
                            <CalendarClock className="w-5 h-5" /> 智慧 24H 排程
                        </button>
                        <button onClick={handleBatchUpload} disabled={isUploading} className={`px-10 py-5 bg-gradient-to-r from-red-700 to-red-600 text-white rounded-[2rem] font-black shadow-2xl flex items-center gap-4 active:scale-95 transition-all text-lg ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
                            {isUploading ? '執行批次上傳' : '執行批次上傳'}
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                    {scripts.filter(s => s.status === 'completed').length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-32 text-slate-600 gap-6">
                            <Layers className="w-16 h-16 opacity-20" />
                            <p className="text-xl font-light">暫無已完成的影片可供排程</p>
                        </div>
                    )}

                    {scripts.filter(s => s.status === 'completed').map((s) => (
                        <div key={s.id} className={`group bg-slate-950 border rounded-[2.5rem] overflow-hidden transition-all duration-300 ${selectedScriptIds.has(s.id) ? 'border-blue-500/40 shadow-[0_0_30px_rgba(59,130,246,0.1)]' : 'border-slate-800 hover:border-slate-700'}`}>
                            {/* Header: Select & Info */}
                            <div className="p-6 pb-4 flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedScriptIds.has(s.id)} 
                                            onChange={() => toggleSelect(s.id)} 
                                            className="w-5 h-5 accent-blue-600 cursor-pointer rounded-md" 
                                        />
                                        <h4 className="font-bold text-white truncate" title={s.title}>{s.title}</h4>
                                    </div>
                                    <p className="text-xs text-slate-500 line-clamp-1 pl-8">{s.concept}</p>
                                </div>
                            </div>

                            {/* Video Preview */}
                            <div className="relative aspect-video bg-black group-hover:bg-slate-900 transition-colors">
                                <video 
                                    src={s.videoUrl} 
                                    controls 
                                    className="w-full h-full object-contain"
                                    preload="metadata"
                                />
                            </div>

                            {/* Footer: Schedule Input & Status */}
                            <div className="p-6 pt-5 bg-slate-900/30 border-t border-slate-800 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <Clock className="w-3 h-3" /> 排程發布時間
                                    </label>
                                    <input 
                                        type="datetime-local" 
                                        value={s.publishTime || ''}
                                        onChange={(e) => handleTimeChange(s.id, e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all font-mono" 
                                    />
                                    <p className="text-[10px] text-slate-600">※ 依據您的電腦時間</p>
                                </div>
                                
                                {/* Status Indicator */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
                                    <div className="flex gap-2">
                                        <span className="text-[10px] px-2 py-1 bg-slate-800 rounded text-slate-400">Private</span>
                                    </div>
                                    <div>
                                         {s.uploadStatus === 'uploading' && <span className="text-xs text-blue-400 flex items-center gap-1 font-bold"><Loader2 className="w-3 h-3 animate-spin"/> 上傳中...</span>}
                                         {s.uploadStatus === 'success' && <span className="text-xs text-emerald-400 flex items-center gap-1 font-bold"><CheckCircle2 className="w-3 h-3"/> 上傳成功</span>}
                                         {s.uploadStatus === 'failed' && <span className="text-xs text-red-400 flex items-center gap-1 font-bold"><AlertCircle className="w-3 h-3"/> 上傳失敗</span>}
                                         {!s.uploadStatus && <span className="text-[10px] text-slate-600 font-medium">尚未上傳</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
             </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;

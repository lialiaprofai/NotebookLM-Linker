import React, { useState, useEffect, useRef } from "react";

const API_BASE = window.location.port === "5173" ? "http://localhost:8000" : "";

export default function App() {
  const [topics, setTopics] = useState([]);
  const [driveAuth, setDriveAuth] = useState({ authenticated: false, message: "Проверка..." });
  const [screen, setScreen] = useState("wizard"); // "wizard", "approval", "loading", "completed"
  
  // Wizard & Planning States
  const [inputTopic, setInputTopic] = useState("");
  const [planningLoading, setPlanningLoading] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [refinedTopic, setRefinedTopic] = useState("");
  const [proposedSources, setProposedSources] = useState([]);
  const [checkedSourceIds, setCheckedSourceIds] = useState({});
  const [selectedFolderOption, setSelectedFolderOption] = useState("__new__");
  const [newFolderName, setNewFolderName] = useState("");
  
  // Custom Search Settings
  const [searchDepth, setSearchDepth] = useState("standard"); // "standard" or "deep"
  const [freshness, setFreshness] = useState(true);
  const [authorityBoost, setAuthorityBoost] = useState(true);
  
  // Custom API keys stored in localstorage
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem("gemini_api_key") || "");
  const [perplexityApiKey, setPerplexityApiKey] = useState(localStorage.getItem("perplexity_api_key") || "");
  const [anthropicApiKey, setAnthropicApiKey] = useState(localStorage.getItem("anthropic_api_key") || "");
  const [modelProvider, setModelProvider] = useState(localStorage.getItem("model_provider") || "gemini");

  useEffect(() => {
    localStorage.setItem("gemini_api_key", geminiApiKey);
  }, [geminiApiKey]);

  useEffect(() => {
    localStorage.setItem("perplexity_api_key", perplexityApiKey);
  }, [perplexityApiKey]);

  useEffect(() => {
    localStorage.setItem("anthropic_api_key", anthropicApiKey);
  }, [anthropicApiKey]);

  useEffect(() => {
    localStorage.setItem("model_provider", modelProvider);
  }, [modelProvider]);
  
  // Loading & Sync States
  const [taskStatus, setTaskStatus] = useState(null); // { status, step, message, log: [] }
  const [driveLink, setDriveLink] = useState("");
  
  // Pre-search Chat States
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Google Sheets Assistant States
  const [sheetInfo, setSheetInfo] = useState(null);
  const [selectedSheetTab, setSelectedSheetTab] = useState("");
  const [sheetSearchQuery, setSheetSearchQuery] = useState("");
  const [sheetSearchLoading, setSheetSearchLoading] = useState(false);
  const [sheetMatches, setSheetMatches] = useState([]);
  const [sheetCombinedText, setSheetCombinedText] = useState("");
  const [sheetInfoLoading, setSheetInfoLoading] = useState(false);
  const [sheetSaveLoading, setSheetSaveLoading] = useState(false);
  const [sheetFolderOption, setSheetFolderOption] = useState("__new__");
  const [sheetNewFolderName, setSheetNewFolderName] = useState("");
  const [sheetSaveFileName, setSheetSaveFileName] = useState("");
  const [sheetSaveSuccess, setSheetSaveSuccess] = useState(null);

  const logEndRef = useRef(null);
  const chatEndRef = useRef(null);

  // Load startup data
  useEffect(() => {
    fetchTopics();
    checkAuthStatus();
  }, []);

  // Poll task status when syncing in background
  useEffect(() => {
    let interval;
    const isTaskRunning = !taskStatus || (taskStatus.status !== "completed" && taskStatus.status !== "failed");
    if (taskId && isTaskRunning) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/api/tasks/${taskId}`);
          if (!res.ok) return;
          const status = await res.json();
          setTaskStatus(status);
          
          if (status.status === "completed") {
            clearInterval(interval);
            setDriveLink(status.drive_folder_link);
            setScreen(currentScreen => {
              if (currentScreen === "loading") {
                return "completed";
              }
              return currentScreen;
            });
            fetchTopics();
          } else if (status.status === "failed") {
            clearInterval(interval);
          }
        } catch (err) {
          console.error("Error polling task status:", err);
        }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [taskId, taskStatus?.status]);

  // Scroll to bottom of terminal console log
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [taskStatus?.log]);

  // Scroll to bottom of pre-search chat list
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, chatLoading]);

  const copyToClipboard = (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => alert("Ссылка скопирована в буфер обмена!"))
        .catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      alert("Ссылка скопирована в буфер обмена!");
    } catch (err) {
      console.error("Fallback copy failed: ", err);
      alert("Не удалось скопировать. Скопируйте ссылку вручную.");
    }
    document.body.removeChild(textArea);
  };

  const checkAuthStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/drive/auth-status`);
      if (res.ok) {
        const data = await res.json();
        setDriveAuth(data);
      }
    } catch (err) {
      console.error("Error checking auth status:", err);
    }
  };

  const fetchTopics = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/topics`);
      if (res.ok) {
        const data = await res.json();
        setTopics(data);
      }
    } catch (err) {
      console.error("Error fetching topics:", err);
    }
  };

  const handleGoToResearch = () => {
    if (taskId && taskStatus) {
      if (taskStatus.status === "pending" || taskStatus.status === "running") {
        setScreen("loading");
        return;
      }
      if (taskStatus.status === "completed") {
        setScreen("completed");
        return;
      }
    }
    setScreen("wizard");
    resetForm();
  };

  const handleDeleteTopic = async (slug) => {
    if (!window.confirm("Вы уверены, что хотите удалить это исследование из истории?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/topics/${slug}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchTopics();
      } else {
        const errData = await res.json();
        alert(`Ошибка при удалении: ${errData.detail || "Неизвестная ошибка"}`);
      }
    } catch (err) {
      console.error("Error deleting topic:", err);
      alert(`Ошибка при удалении: ${err.message}`);
    }
  };

  const sendWelcomeMessage = async () => {
    if (!inputTopic.trim() || chatLoading) return;
    setChatLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/topics/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: inputTopic,
          message: "Привет! Давай обсудим тему исследования. Каковы мои цели и на чем сделать акцент?",
          chat_history: [],
          gemini_api_key: geminiApiKey || null,
          anthropic_api_key: anthropicApiKey || null,
          model_provider: modelProvider
        })
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages([
          { role: "user", content: `Начать обсуждение темы: "${inputTopic}"` },
          { role: "assistant", content: data.reply }
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendChatMessage = async (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    
    const updatedMessages = [...chatMessages, { role: "user", content: userMessage }];
    setChatMessages(updatedMessages);
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/topics/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: inputTopic || "Без темы",
          message: userMessage,
          chat_history: chatMessages,
          gemini_api_key: geminiApiKey || null,
          anthropic_api_key: anthropicApiKey || null,
          model_provider: modelProvider
        })
      });

      if (!res.ok) throw new Error("Failed to get chat response");
      const data = await res.json();

      setChatMessages([...updatedMessages, { role: "assistant", content: data.reply }]);
    } catch (err) {
      alert(`Ошибка чата: ${err.message}`);
    } finally {
      setChatLoading(false);
    }
  };

  // Google Sheets API Handlers
  const fetchSheetInfo = async () => {
    setSheetInfoLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/sheets/info`);
      if (res.ok) {
        const data = await res.json();
        setSheetInfo(data);
        if (data.sheets && data.sheets.length > 0) {
          const target = data.sheets.find(s => s.toLowerCase() === "выгрузка из jdy") || data.sheets[0];
          setSelectedSheetTab(target);
        }
      }
    } catch (err) {
      console.error("Error fetching sheet info:", err);
    } finally {
      setSheetInfoLoading(false);
    }
  };

  const handleSheetSearch = async (e) => {
    if (e) e.preventDefault();
    if (!sheetSearchQuery.trim() || sheetSearchLoading) return;
    setSheetSearchLoading(true);
    setSheetSaveSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/api/sheets/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: sheetSearchQuery,
          sheet_name: selectedSheetTab
        })
      });
      if (!res.ok) throw new Error("Search request failed");
      const data = await res.json();
      setSheetMatches(data.matches);
      setSheetCombinedText(data.combined_text);
      // Pre-fill save filename
      setSheetSaveFileName(`Закупки_${sheetSearchQuery.trim().replace(/[^a-zA-Z0-9а-яА-Я-_]/g, "_")}.md`);
      setSheetNewFolderName(`Закупки ${sheetSearchQuery.trim()}`);
    } catch (err) {
      alert(`Ошибка поиска: ${err.message}`);
    } finally {
      setSheetSearchLoading(false);
    }
  };

  const handleSheetSaveToDrive = async () => {
    if (!sheetCombinedText || sheetSaveLoading) return;
    setSheetSaveLoading(true);
    setSheetSaveSuccess(null);
    
    const targetFolder = sheetFolderOption === "__new__" ? sheetNewFolderName : sheetFolderOption;
    if (!targetFolder.trim()) {
      alert("Пожалуйста, укажите имя папки.");
      setSheetSaveLoading(false);
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE}/api/sheets/save-to-drive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: sheetSaveFileName || "sheet_extract.md",
          content: sheetCombinedText,
          folder_name: targetFolder
        })
      });
      if (!res.ok) throw new Error("Save request failed");
      const data = await res.json();
      setSheetSaveSuccess(data);
      fetchTopics(); // Refresh available folders in UI list
    } catch (err) {
      alert(`Ошибка сохранения: ${err.message}`);
    } finally {
      setSheetSaveLoading(false);
    }
  };

  const resetSheetsForm = () => {
    setSheetSearchQuery("");
    setSheetMatches([]);
    setSheetCombinedText("");
    setSheetSaveSuccess(null);
  };

  useEffect(() => {
    if (screen === "sheets" && !sheetInfo) {
      fetchSheetInfo();
    }
  }, [screen]);

  const resetForm = () => {
    setInputTopic("");
    setRefinedTopic("");
    setSelectedFolderOption("__new__");
    setNewFolderName("");
    setChatMessages([]);
    setShowChat(false);
  };

  const startPlanning = async (e) => {
    if (e) e.preventDefault();
    if (!inputTopic.trim() || planningLoading) return;

    setPlanningLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/topics/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          topic: inputTopic,
          depth: searchDepth,
          freshness: freshness,
          authority_boost: authorityBoost,
          chat_history: showChat ? chatMessages : [],
          gemini_api_key: geminiApiKey || null,
          anthropic_api_key: anthropicApiKey || null,
          model_provider: modelProvider
        })
      });

      if (!res.ok) throw new Error("Plan generation failed");
      const data = await res.json();
      
      setTaskId(data.task_id);
      setProposedSources(data.proposed_sources);
      
      if (selectedFolderOption === "__new__") {
        setNewFolderName(data.refined_topic);
        setRefinedTopic(data.refined_topic);
      } else {
        setRefinedTopic(selectedFolderOption);
      }
      
      // Select all sources by default
      const initialChecked = {};
      data.proposed_sources.forEach(src => {
        initialChecked[src.id] = true;
      });
      setCheckedSourceIds(initialChecked);
      
      setScreen("approval");
    } catch (err) {
      alert(`Ошибка при планировании исследования: ${err.message}`);
    } finally {
      setPlanningLoading(false);
    }
  };

  const toggleSourceCheckbox = (id) => {
    setCheckedSourceIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const executeSync = async () => {
    const approved = proposedSources.filter(src => checkedSourceIds[src.id]);
    if (approved.length === 0) {
      alert("Пожалуйста, выберите хотя бы один источник для синхронизации.");
      return;
    }

    let currentTaskId = taskId;
    if (!currentTaskId) {
      currentTaskId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
      setTaskId(currentTaskId);
    }

    setScreen("loading");
    setTaskStatus({
      status: "pending",
      step: "init",
      message: "Отправка запроса на синхронизацию...",
      log: ["Инициализация процесса выгрузки..."]
    });

    try {
      const res = await fetch(`${API_BASE}/api/topics/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: currentTaskId,
          topic: inputTopic,
          refined_topic: refinedTopic,
          approved_sources: approved,
          perplexity_api_key: perplexityApiKey || null
        })
      });

      if (!res.ok) throw new Error("Failed to start sync");
    } catch (err) {
      setTaskStatus({
        status: "failed",
        step: "error",
        message: `Ошибка: ${err.message}`,
        log: [`Сбой при запуске: ${err.message}`]
      });
    }
  };

  const getSourceBadgeColor = (type) => {
    if (type === "documentation") return "bg-emerald-950/40 border-emerald-500/30 text-emerald-400";
    if (type === "youtube") return "bg-red-950/40 border-red-500/30 text-red-400";
    return "bg-cyan-950/40 border-cyan-500/30 text-cyan-400";
  };

  const getSourceBadgeLabel = (type) => {
    if (type === "documentation") return "Документация";
    if (type === "youtube") return "YouTube Видео";
    return "Статья/Гайд";
  };

  const docsSources = proposedSources.filter(src => src.type === "documentation");
  const youtubeSources = proposedSources.filter(src => src.type === "youtube");
  const articleSources = proposedSources.filter(src => src.type === "article");

  const renderSourceCard = (src) => {
    const isChecked = !!checkedSourceIds[src.id];
    return (
      <div 
        key={src.id}
        onClick={() => toggleSourceCheckbox(src.id)}
        className={`source-card ${isChecked ? "" : "unchecked"}`}
      >
        <div className="flex-shrink-0 pt-1" onClick={(e) => e.stopPropagation()}>
          <input 
            type="checkbox"
            checked={isChecked}
            onChange={() => toggleSourceCheckbox(src.id)}
            className="card-checkbox"
          />
        </div>
        <div className="flex-grow space-y-2">
          <h3 className="font-semibold text-base text-gray-800" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {src.title}
          </h3>
          <div className="ai-justification">
            <span className="material-symbols-outlined text-primary text-[18px]">auto_awesome</span>
            <p className="ai-justification-text">"{src.reason}"</p>
          </div>
          <div className="query-badge">
            <span className="material-symbols-outlined text-[16px]">search</span>
            <span>Query: "{src.query}"</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ paddingBottom: '90px' }}>
      {/* Header bar */}
      <header className="app-header">
        <div className="flex items-center gap-3 cursor-pointer" onClick={handleGoToResearch}>
          <span className="material-symbols-outlined text-primary text-[28px]">hub</span>
          <h1 className="font-bold text-lg text-primary" style={{ fontFamily: 'Outfit, sans-serif' }}>NotebookLM Linker</h1>
        </div>

        {/* Google Drive Status Indicator + Profile */}
        <div className="flex items-center gap-4">
          <span className={`text-xs px-2.5 py-1 rounded-full border ${
            driveAuth.authenticated 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" 
              : "bg-amber-500/10 border-amber-500/20 text-amber-700"
          }`} style={{ fontWeight: '500' }}>
            Drive: {driveAuth.message}
          </span>
          <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden border border-outline-variant" style={{ width: '40px', height: '40px', borderRadius: '50%' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>account_circle</span>
          </div>
        </div>
      </header>

      {/* Main body viewport */}
      <main className="flex-1 flex flex-col p-6 max-w-5xl mx-auto w-full justify-center">

        {/* Warning if credentials file is missing entirely */}
        {!driveAuth.has_credentials && screen === "wizard" && (
          <div className="mb-8 p-4 glass-panel border-amber-500/20 bg-amber-500/5 text-left text-sm rounded-2xl flex items-start space-x-3">
            <div className="text-amber-500 text-lg font-bold">⚠️</div>
            <div className="text-gray-700">
              <strong className="text-amber-600">Файл credentials.json не найден:</strong> Для работы синхронизации с вашим Google Диском поместите скачанный из Google Cloud Console файл в корень проекта.
            </div>
          </div>
        )}

        {/* Info if credentials file is found but not yet authenticated */}
        {driveAuth.has_credentials && !driveAuth.authenticated && screen === "wizard" && (
          <div className="mb-8 p-4 glass-panel border-cyan-500/20 bg-cyan-500/5 text-left text-sm rounded-2xl flex items-start space-x-3">
            <div className="text-cyan-500 text-lg font-bold">ℹ️</div>
            <div className="text-gray-700">
              <strong className="text-cyan-600">Ключи авторизации найдены:</strong> Файл Google Client Secret обнаружен в проекте! При первом запуске синхронизации откроется окно браузера для входа в ваш Google-аккаунт.
            </div>
          </div>
        )}

        {/* SCREEN 1: Wizard (Input Topic) */}
        {screen === "wizard" && (
          <div className="flex flex-col items-center text-center my-6 max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-2xl shadow-emerald-500/10 mb-8" style={{ width: '64px', height: '64px', borderRadius: '18px' }}>
              <span className="material-symbols-outlined text-white text-[32px]">auto_stories</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'Outfit, sans-serif', color: '#191c1d' }}>
              Подготовьте источники для <span className="text-gradient">NotebookLM</span>
            </h1>
            <p className="text-gray-500 mb-8 text-base leading-relaxed">
              Введите тему. ИИ найдет лучшие статьи, гайды и YouTube видео, получит транскрипты, позволит вам утвердить список и автоматически выгрузит их в папку Google Диска, подключенную к вашему NotebookLM.
            </p>

            <form onSubmit={startPlanning} className="w-full glass-panel p-6 flex flex-col space-y-4">
              <div className="relative group w-full">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>search</span>
                </div>
                <input
                  type="text"
                  value={inputTopic}
                  onChange={(e) => {
                    setInputTopic(e.target.value);
                    setSelectedFolderOption("__new__");
                  }}
                  placeholder="Например: Основы программирования на языке Rust..."
                  className="input-field"
                  disabled={planningLoading}
                  style={{ paddingLeft: '48px' }}
                />
              </div>
              
              {/* Search Settings Panel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl text-left text-xs text-gray-500" style={{ background: 'var(--surface-container-low)', border: '1px solid var(--border-color)' }}>
                {/* Search Depth Selector */}
                <div className="flex flex-col space-y-2">
                  <label className="font-semibold" style={{ color: 'var(--text-primary)' }}>Глубина поиска</label>
                  <select 
                    value={searchDepth}
                    onChange={(e) => setSearchDepth(e.target.value)}
                    className="bg-white border border-gray-300 rounded-lg p-2 text-xs text-gray-800 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                    disabled={planningLoading}
                  >
                    <option value="standard">Стандартный (5-7 источников)</option>
                    <option value="deep">Глубокий (10-12 источников)</option>
                  </select>
                </div>
                
                {/* Freshness Checkbox */}
                <div className="flex items-center space-x-2 pt-4 md:pt-6">
                  <input 
                    type="checkbox"
                    id="freshness"
                    checked={freshness}
                    onChange={(e) => setFreshness(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    disabled={planningLoading}
                  />
                  <label htmlFor="freshness" className="cursor-pointer select-none font-medium text-gray-700">
                    Свежесть инфо (2025/2026)
                  </label>
                </div>

                {/* Authority Checkbox */}
                <div className="flex items-center space-x-2 pt-2 md:pt-6">
                  <input 
                    type="checkbox"
                    id="authorityBoost"
                    checked={authorityBoost}
                    onChange={(e) => setAuthorityBoost(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    disabled={planningLoading}
                  />
                  <label htmlFor="authorityBoost" className="cursor-pointer select-none font-medium text-gray-700">
                    Авторитетные источники
                  </label>
                </div>
              </div>
              
              {/* Refinement Chat Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', textAlign: 'left' }}>
                <input 
                  type="checkbox"
                  id="showChatToggle"
                  checked={showChat}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setShowChat(checked);
                    if (checked && chatMessages.length === 0 && inputTopic.trim()) {
                      sendWelcomeMessage();
                    }
                  }}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  disabled={planningLoading}
                />
                <label htmlFor="showChatToggle" style={{ cursor: 'pointer', userSelect: 'none', fontSize: '12px', fontWeight: '600', color: '#006948', transition: 'color 0.2s' }}>
                  💬 Обсудить и настроить поиск с ИИ перед планированием
                </label>
              </div>

              {/* Refinement Chat Panel */}
              {showChat && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '12px', background: 'rgba(0, 105, 72, 0.02)', border: '1px solid var(--border-color)', textAlign: 'left', width: '100%', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 0, 0, 0.06)', paddingBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '13px' }}>Настройка направления с ИИ</span>
                    <button
                      type="button"
                      onClick={() => {
                        setChatMessages([]);
                        if (inputTopic.trim()) {
                          setChatLoading(true);
                          fetch(`${API_BASE}/api/topics/chat`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              topic: inputTopic,
                              message: "Привет! Давай обсудим тему исследования. Каковы мои цели и на чем сделать акцент?",
                              chat_history: []
                            })
                          }).then(res => res.json()).then(data => {
                            setChatMessages([
                              { role: "user", content: `Начать обсуждение темы: "${inputTopic}"` },
                              { role: "assistant", content: data.reply }
                            ]);
                          }).catch(err => console.error(err)).finally(() => setChatLoading(false));
                        }
                      }}
                      style={{ fontSize: '10px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
                      disabled={chatLoading}
                    >
                      Очистить диалог
                    </button>
                  </div>
                  
                  {/* Messages list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                    {chatMessages.length === 0 && !chatLoading && (
                      <p style={{ color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: '16px 0', fontSize: '12px' }}>
                        Опишите ваши пожелания, например: "Ищи статьи на Хабре, а видео только на русском языке"
                      </p>
                    )}
                    {chatMessages.map((msg, idx) => (
                      <div 
                        key={idx} 
                        className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}
                      >
                        <span style={{ fontSize: '9px', fontWeight: 'bold', color: msg.role === "user" ? '#dbe1ff' : '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                          {msg.role === "user" ? "Вы" : "ИИ-ассистент"}
                        </span>
                        <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4', fontSize: '12px', margin: 0 }}>{msg.content}</p>
                      </div>
                    ))}
                    {chatLoading && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', padding: '10px 0', fontSize: '12px' }}>
                        <div className="spinner" style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#006948' }} />
                        <span>ИИ думает...</span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input field container */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(0, 0, 0, 0.06)', width: '100%' }}>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSendChatMessage();
                        }
                      }}
                      placeholder={inputTopic.trim() ? "Напишите пожелание к поиску..." : "Сначала введите тему в поле выше..."}
                      style={{
                        background: '#ffffff',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        flexGrow: 1,
                        outline: 'none',
                        width: '0px',
                        boxSizing: 'border-box'
                      }}
                      disabled={chatLoading || planningLoading || !inputTopic.trim()}
                    />
                    <button
                      type="button"
                      onClick={handleSendChatMessage}
                      disabled={!chatInput.trim() || chatLoading || planningLoading || !inputTopic.trim()}
                      style={{
                        padding: '10px 16px',
                        background: '#006948',
                        border: 'none',
                        color: '#ffffff',
                        fontWeight: '600',
                        borderRadius: '8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        opacity: (!chatInput.trim() || chatLoading || planningLoading || !inputTopic.trim()) ? 0.5 : 1,
                        transition: 'opacity 0.15s',
                        boxSizing: 'border-box'
                      }}
                    >
                      Отправить
                    </button>
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={!inputTopic.trim() || planningLoading}
                className="glow-button w-full flex items-center justify-center space-x-2"
              >
                {planningLoading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-t-black border-white/20 spinner" />
                    <span>Поиск и планирование источников...</span>
                  </>
                ) : (
                  <>
                    <span>Начать планирование</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            {/* Previously Synced Topics List */}
            {topics.length > 0 && (
              <div className="mt-12 w-full text-left" id="past-folders">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Ранее синхронизированные папки</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {topics.map(t => (
                    <div 
                      key={t.slug}
                      onClick={() => {
                        setInputTopic(t.refined_topic);
                        setRefinedTopic(t.refined_topic);
                        setSelectedFolderOption(t.refined_topic);
                        setChatMessages([]); // Reset chat for the new topic
                      }}
                      className="glass-panel p-4 hover:border-emerald-500/40 hover:bg-black/5 transition duration-200 flex items-center justify-between group cursor-pointer"
                      style={{ border: '1px solid var(--border-color)', borderRadius: '16px' }}
                    >
                      <div className="flex flex-col text-left">
                        <span className="font-semibold text-gray-800 line-clamp-1">{t.refined_topic}</span>
                        <span className="text-xs text-emerald-700 font-semibold transition">Нажмите для выбора темы и папки</span>
                      </div>
                      <a 
                        href={`https://drive.google.com/drive/folders/${t.drive_folder_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 hover:bg-black/5 rounded transition"
                        onClick={(e) => e.stopPropagation()} // Prevent card click
                      >
                        <span className="material-symbols-outlined text-gray-400 hover:text-emerald-700">open_in_new</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 2: Source Approval (Checkbox select list) */}
        {screen === "approval" && (
          <div className="w-full max-w-4xl mx-auto my-6 text-left" style={{ paddingBottom: '120px' }}>
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 mb-6 border-b border-gray-200 space-y-4 md:space-y-0">
              <div className="flex-1 max-w-xl">
                <span className="text-xs font-bold text-primary uppercase tracking-wider" style={{ fontFamily: 'Outfit, sans-serif' }}>Шаг 2: Утверждение источников</span>
                
                {/* Destination Folder Select & Input (Material Style) */}
                <div className="flex flex-col space-y-3 mt-3">
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs text-gray-500 font-semibold">Папка на Google Диске (Destination Folder):</label>
                    <select
                      value={selectedFolderOption}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedFolderOption(val);
                        if (val !== "__new__") {
                          setRefinedTopic(val);
                        } else {
                          setRefinedTopic(newFolderName);
                        }
                      }}
                      className="input-field py-3 font-semibold cursor-pointer bg-white"
                      style={{ fontSize: '14px' }}
                    >
                      <option value="__new__">➕ Выбрать новую папку...</option>
                      {topics.map(t => (
                        <option key={t.slug} value={t.refined_topic}>
                          📁 {t.refined_topic}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedFolderOption === "__new__" && (
                    <div className="flex flex-col space-y-1">
                      <label className="text-xs text-gray-500 font-semibold">Название новой папки:</label>
                      <div className="relative w-full">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                          <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>create_new_folder</span>
                        </div>
                        <input
                          type="text"
                          value={newFolderName}
                          onChange={(e) => {
                            setNewFolderName(e.target.value);
                            setRefinedTopic(e.target.value);
                          }}
                          placeholder="Введите имя папки..."
                          className="input-field py-3 font-semibold"
                          style={{ paddingLeft: '44px', fontSize: '14px' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setScreen("wizard")}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-xs text-gray-600 rounded-lg transition self-end md:self-center font-semibold"
              >
                ← Назад
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Ниже приведены авторитетные источники, которые искусственный интеллект подобрал под вашу тему. Пожалуйста, просмотрите и отметьте те, которые необходимо скачать и выгрузить на ваш Google Диск для NotebookLM.
            </p>

            {/* Grouped Source List */}
            <div className="space-y-6">
              
              {/* Documentation Group */}
              {docsSources.length > 0 && (
                <div>
                  <div className="group-header">
                    <h2 className="group-title">Documentation</h2>
                    <span className="group-badge">
                      {docsSources.filter(src => checkedSourceIds[src.id]).length} Selected
                    </span>
                  </div>
                  <div className="space-y-3">
                    {docsSources.map(src => renderSourceCard(src))}
                  </div>
                </div>
              )}

              {/* YouTube Group */}
              {youtubeSources.length > 0 && (
                <div>
                  <div className="group-header">
                    <h2 className="group-title">YouTube Videos</h2>
                    <span className="group-badge">
                      {youtubeSources.filter(src => checkedSourceIds[src.id]).length} Selected
                    </span>
                  </div>
                  <div className="space-y-3">
                    {youtubeSources.map(src => renderSourceCard(src))}
                  </div>
                </div>
              )}

              {/* Articles Group */}
              {articleSources.length > 0 && (
                <div>
                  <div className="group-header">
                    <h2 className="group-title">Articles & Guides</h2>
                    <span className="group-badge">
                      {articleSources.filter(src => checkedSourceIds[src.id]).length} Selected
                    </span>
                  </div>
                  <div className="space-y-3">
                    {articleSources.map(src => renderSourceCard(src))}
                  </div>
                </div>
              )}
            </div>

            {/* Floating Sticky CTA Button matching Google Stitch style */}
            <div className="floating-cta">
              <button onClick={executeSync}>
                <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>cloud_sync</span>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px' }}>Синхронизировать с Google Диском</span>
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 3: Syncing Progress Loading */}
        {screen === "loading" && (
          <div className="w-full max-w-3xl mx-auto my-6 text-center">
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)' }}>Выгрузка на Google Диск...</h2>
            <p className="text-gray-500 mb-8">{taskStatus?.message || "Подключение к Google Drive..."}</p>

            {/* Spinner indicator */}
            {taskStatus?.status === "running" && (
              <div className="flex justify-center mb-8">
                <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-emerald-600 spinner" style={{ width: '40px', height: '40px' }} />
              </div>
            )}

            {/* Terminal logs console */}
            <div className="w-full p-4 bg-gray-950 font-mono text-xs text-emerald-400 overflow-hidden flex flex-col h-80 border border-gray-800 rounded-2xl">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-800 text-gray-500 font-sans">
                <span>GOOGLE_DRIVE_UPLOAD_LOGS</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 pulse" />
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 text-left pr-2">
                {taskStatus?.log?.map((line, idx) => (
                  <div key={idx} className="leading-relaxed">
                    <span className="text-gray-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
                    {line}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>

            {taskStatus?.status === "failed" && (
              <div className="mt-8 text-red-600 text-center">
                <p className="font-bold mb-2 text-lg">Ошибка синхронизации</p>
                <p className="text-sm bg-red-50 border border-red-200 p-4 rounded-xl max-w-lg mx-auto">{taskStatus.message}</p>
                <button 
                  onClick={() => setScreen("wizard")}
                  className="mt-6 px-4 py-2 bg-gray-150 hover:bg-gray-200 border border-gray-300 rounded-xl text-sm font-semibold transition"
                >
                  Вернуться на главный экран
                </button>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 4: Completed panel */}
        {screen === "completed" && (
          <div className="w-full max-w-xl mx-auto my-12 text-center flex flex-col items-center">
            {/* Massive Green Checkmark */}
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/10 mb-8" style={{ width: '80px', height: '80px', borderRadius: '50%' }}>
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '48px' }}>check_circle</span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>Источники готовы!</h1>
            <p className="text-gray-500 text-base mb-8 max-w-md">
              Все выбранные источники (официальные документы, статьи, YouTube расшифровки) успешно загружены на ваш Google Диск в папку <strong className="text-primary">"{refinedTopic}"</strong>.
            </p>

            <div className="w-full space-y-4">
              <a 
                href={driveLink}
                target="_blank"
                rel="noreferrer"
                className="glow-button w-full py-3.5 flex items-center justify-center space-x-2 text-base font-bold"
                style={{ textDecoration: 'none', display: 'flex' }}
              >
                <span>Открыть папку на Google Диске</span>
                <span className="material-symbols-outlined text-[20px]">open_in_new</span>
              </a>

              {/* Copy Links Section */}
              {taskStatus?.original_links && taskStatus.original_links.length > 0 && (
                <div className="glass-panel p-5 text-left text-sm space-y-3">
                  <h4 className="font-bold text-gray-800 uppercase tracking-wider text-xs text-gradient" style={{ fontFamily: 'Outfit, sans-serif' }}>Оригинальные ссылки для NotebookLM:</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Вы можете скопировать эти ссылки и вставить их напрямую в NotebookLM (через "+" {"->"} "Сайт" или "YouTube").
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {taskStatus.original_links.map((link, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-gray-200" style={{ background: 'var(--surface-container-low)' }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-primary/10 text-primary text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ fontSize: '9px' }}>
                              {getSourceBadgeLabel(link.type)}
                            </span>
                            <span className="font-semibold text-xs text-gray-800 line-clamp-1">{link.title}</span>
                          </div>
                          <a href={link.url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline line-clamp-1 font-mono">
                            {link.url}
                          </a>
                        </div>
                        <button 
                          onClick={() => {
                            copyToClipboard(link.url);
                          }}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg text-xs font-semibold transition whitespace-nowrap"
                        >
                          Копировать
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="glass-panel p-5 text-left text-sm space-y-3" style={{ border: '1px solid var(--border-color)' }}>
                <h4 className="font-bold text-gray-800">Что делать дальше в Google NotebookLM:</h4>
                <ol className="list-decimal list-inside space-y-2 text-gray-500">
                  <li>Откройте ваш блокнот в <a href="https://notebooklm.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">Google NotebookLM</a>.</li>
                  <li>Нажмите кнопку добавления источника <strong className="text-gray-700">"+"</strong>.</li>
                  <li>Выберите <strong className="text-gray-700">Google Диск (Google Drive)</strong> и найдите папку <strong className="text-primary">"{refinedTopic}"</strong>.</li>
                  <li>Или вставьте скопированные ссылки выше напрямую в разделы <strong className="text-gray-700">"Сайт" / "YouTube"</strong>.</li>
                </ol>
              </div>

              <button 
                onClick={() => { 
                  setScreen("wizard"); 
                  resetForm();
                }}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700 border-b border-gray-400 hover:border-gray-600 transition-all pt-4"
              >
                Исследовать новую тему
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 6: Settings panel */}
        {screen === "settings" && (
          <div className="w-full max-w-2xl mx-auto my-6 text-left animate-fade-in" style={{ paddingBottom: '120px' }}>
            <h2 className="text-3xl font-extrabold tracking-tight mb-2" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)' }}>Настройки ключей и моделей</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              Вы можете настроить персональные API-ключи для вызовов языковых моделей и поиска информации. Ключи сохраняются локально в вашем браузере (в localStorage) и отправляются в заголовках запросов без сохранения на сервере.
            </p>

            <div className="space-y-6">
              {/* Model Provider Selection */}
              <div className="glass-panel p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  <span className="material-symbols-outlined text-primary">psychology</span>
                  Основной ИИ-ассистент
                </h3>
                <div className="flex flex-col space-y-2">
                  <label className="text-xs font-semibold text-gray-500">Провайдер модели по умолчанию</label>
                  <select 
                    value={modelProvider}
                    onChange={(e) => setModelProvider(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-3 text-sm text-gray-800 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                  >
                    <option value="gemini">Google Gemini (по умолчанию gemini-1.5-flash)</option>
                    <option value="claude">Anthropic Claude (по умолчанию claude-sonnet-4-6)</option>
                  </select>
                </div>
              </div>

              {/* Gemini API Key */}
              <div className="glass-panel p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  <span className="material-symbols-outlined text-emerald-600">api</span>
                  Google Gemini API Key
                </h3>
                <p className="text-xs text-gray-400">
                  Используется для интерактивного чата и генерации планов поиска. Если не задан, сервер будет использовать ключ из файла `.env` (если настроен).
                </p>
                <input 
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500 transition animate-fade-in"
                />
              </div>

              {/* Anthropic Claude API Key */}
              <div className="glass-panel p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  <span className="material-symbols-outlined text-orange-600 font-bold">bolt</span>
                  Anthropic Claude API Key
                </h3>
                <p className="text-xs text-gray-400">
                  Необходим при выборе Anthropic Claude в качестве провайдера. Если не задан, сервер попытается использовать ключ `ANTHROPIC_API_KEY` из файла `.env`.
                </p>
                <input 
                  type="password"
                  value={anthropicApiKey}
                  onChange={(e) => setAnthropicApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500 transition animate-fade-in"
                />
              </div>

              {/* Perplexity API Key */}
              <div className="glass-panel p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  <span className="material-symbols-outlined text-blue-600">manage_search</span>
                  Perplexity API Key
                </h3>
                <p className="text-xs text-gray-400">
                  Необходим для глубокого поиска актуальных статей, ссылок и видеороликов через модель `sonar`. Если не задан, будет использоваться серверный ключ.
                </p>
                <input 
                  type="password"
                  value={perplexityApiKey}
                  onChange={(e) => setPerplexityApiKey(e.target.value)}
                  placeholder="pplx-..."
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500 transition animate-fade-in"
                />
              </div>

              {/* Key Indicators */}
              <div className="p-4 rounded-2xl flex flex-wrap gap-4 items-center justify-between text-xs text-gray-500" style={{ background: 'var(--surface-container-low)', border: '1px solid var(--border-color)' }}>
                <span>Статус локальных ключей:</span>
                <div className="flex gap-4">
                  <span className="flex items-center gap-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${geminiApiKey ? 'bg-emerald-500' : 'bg-gray-300'}`} /> Gemini
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${anthropicApiKey ? 'bg-emerald-500' : 'bg-gray-300'}`} /> Claude
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${perplexityApiKey ? 'bg-emerald-500' : 'bg-gray-300'}`} /> Perplexity
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 5: History / Past topics */}
        {screen === "history" && (
          <div className="w-full max-w-4xl mx-auto my-6 text-left animate-fade-in" style={{ paddingBottom: '120px' }}>
            <div className="flex items-center justify-between pb-3 mb-6 border-b border-gray-200">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  История исследований
                </span>
                <h1 className="text-2xl font-extrabold tracking-tight mt-1 text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Ранее синхронизированные папки
                </h1>
              </div>
              <button 
                onClick={handleGoToResearch}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-xs text-gray-600 rounded-lg transition font-semibold"
              >
                ← Назад к поиску
              </button>
            </div>

            {topics.length === 0 ? (
              <div className="glass-panel p-12 text-center text-gray-500" style={{ border: '1px solid var(--border-color)', borderRadius: '24px' }}>
                <span className="material-symbols-outlined text-gray-300 mb-2" style={{ fontSize: '48px' }}>folder_off</span>
                <p className="font-semibold text-gray-600 text-base">История исследований пуста</p>
                <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">Начните новое исследование на вкладке Research, чтобы сохранить результаты.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topics.map(t => (
                  <div 
                    key={t.slug}
                    className="glass-panel p-5 hover:border-emerald-500/40 hover:bg-black/5 transition duration-200 flex flex-col justify-between"
                    style={{ border: '1px solid var(--border-color)', borderRadius: '24px' }}
                  >
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-bold text-gray-900 text-base line-clamp-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                          {t.refined_topic || t.original_topic}
                        </span>
                        <a 
                          href={`https://drive.google.com/drive/folders/${t.drive_folder_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 hover:bg-black/5 rounded-full transition flex items-center justify-center text-gray-400 hover:text-emerald-700"
                          title="Открыть папку на Google Диске"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>open_in_new</span>
                        </a>
                      </div>
                      <p className="text-xs text-gray-500 mb-4 line-clamp-2">Тема: {t.original_topic}</p>
                      <div className="text-[11px] text-gray-400 font-medium">
                        Источников: {t.approved_sources?.length || 0}
                      </div>
                    </div>
                    
                    <div className="mt-6 flex justify-between items-center pt-3 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setInputTopic(t.original_topic);
                          setRefinedTopic(t.refined_topic);
                          setProposedSources(t.approved_sources);
                          
                          // Check all sources by default
                          const initialChecked = {};
                          t.approved_sources.forEach(src => {
                            initialChecked[src.id] = true;
                          });
                          setCheckedSourceIds(initialChecked);
                          
                          setSelectedFolderOption(t.refined_topic);
                          setScreen("approval");
                        }}
                        className="py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold transition flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">sync</span>
                        Возобновить / Перезапустить
                      </button>
                      <button
                        onClick={() => handleDeleteTopic(t.slug)}
                        className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SCREEN 6: Sheets AI Assistant */}
        {screen === "sheets" && (
          <div className="w-full max-w-4xl mx-auto my-6 text-left animate-fade-in" style={{ paddingBottom: '120px' }}>
            <div className="flex items-center justify-between pb-3 mb-6 border-b border-gray-200">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Интеграция с Google Таблицами
                </span>
                <h1 className="text-2xl font-extrabold tracking-tight mt-1 text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Ассистент по закупкам JDY
                </h1>
              </div>
              <button 
                onClick={fetchSheetInfo}
                disabled={sheetInfoLoading}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-xs text-gray-600 rounded-lg transition font-semibold flex items-center gap-1"
              >
                <span className={`material-symbols-outlined text-[16px] ${sheetInfoLoading ? 'spinner' : ''}`}>sync</span>
                Обновить метаданные
              </button>
            </div>

            {sheetInfoLoading && !sheetInfo ? (
              <div className="glass-panel p-12 text-center text-gray-500">
                <div className="flex justify-center mb-4">
                  <div className="w-8 h-8 rounded-full border-4 border-emerald-200 border-t-emerald-600 spinner" />
                </div>
                <p className="font-semibold text-gray-600">Подключение к Google Sheets...</p>
                <p className="text-xs text-gray-400 mt-1">Считываем структуру табличного файла.</p>
              </div>
            ) : !sheetInfo ? (
              <div className="glass-panel p-8 text-center text-red-500 border-red-200 bg-red-50/5">
                <span className="material-symbols-outlined text-[48px] mb-2">error</span>
                <p className="font-semibold">Не удалось подключиться к Google Sheets</p>
                <p className="text-xs text-gray-500 mt-1">Проверьте credentials.json/token.json и включен ли Google Sheets API.</p>
                <button 
                  onClick={fetchSheetInfo}
                  className="mt-4 px-4 py-2 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 transition"
                >
                  Попробовать снова
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in">
                {/* Spreadsheet Metadata Card */}
                <div className="glass-panel p-5 flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ background: 'var(--surface-container-low)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[36px] text-emerald-600">table_chart</span>
                    <div>
                      <h4 className="font-bold text-gray-850 text-sm leading-tight">{sheetInfo.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">ID таблицы: <span className="font-mono text-[10px] select-all bg-black/5 px-1 py-0.5 rounded">{sheetInfo.spreadsheet_id}</span></p>
                    </div>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Выберите лист:</label>
                    <select 
                      value={selectedSheetTab} 
                      onChange={(e) => {
                        setSelectedSheetTab(e.target.value);
                        resetSheetsForm();
                      }}
                      className="bg-white border border-gray-300 rounded-lg py-1 px-3 text-xs text-gray-800 focus:outline-none focus:border-emerald-500 transition cursor-pointer font-semibold"
                    >
                      {sheetInfo.sheets.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Search Bar Block */}
                <form onSubmit={handleSheetSearch} className="glass-panel p-6 flex flex-col space-y-4">
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Артикул или его часть для поиска:</label>
                    <div className="relative group w-full">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>search</span>
                      </div>
                      <input
                        type="text"
                        value={sheetSearchQuery}
                        onChange={(e) => setSheetSearchQuery(e.target.value)}
                        placeholder="Например: 715-5800..."
                        className="input-field"
                        disabled={sheetSearchLoading}
                        style={{ paddingLeft: '44px', fontSize: '15px' }}
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={!sheetSearchQuery.trim() || sheetSearchLoading}
                    className="glow-button w-full flex items-center justify-center space-x-2"
                  >
                    {sheetSearchLoading ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-t-black border-white/20 spinner" />
                        <span>Поиск по таблице...</span>
                      </>
                    ) : (
                      <>
                        <span>Найти цены и детали</span>
                        <span className="material-symbols-outlined text-[18px]">bolt</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Results Section */}
                {(sheetMatches.length > 0 || sheetSearchQuery) && !sheetSearchLoading && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                      <h3 className="font-bold text-gray-800 text-base flex items-center gap-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                        Результаты поиска 
                        <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-bold ml-1">
                          {sheetMatches.length}
                        </span>
                      </h3>
                      {sheetMatches.length > 0 && (
                        <button
                          onClick={() => {
                            copyToClipboard(sheetCombinedText);
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[16px]">content_copy</span>
                          Копировать текст
                        </button>
                      )}
                    </div>

                    {sheetMatches.length === 0 ? (
                      <div className="glass-panel p-8 text-center text-gray-500">
                        <span className="material-symbols-outlined text-gray-300 text-[36px] mb-1">find_in_page</span>
                        <p className="font-semibold text-xs">Ничего не найдено</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">Попробуйте ввести другую часть артикула (например, 715-5800).</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sheetMatches.map((m, idx) => (
                          <div key={idx} className="glass-panel p-4 flex flex-col justify-between space-y-3" style={{ border: '1px solid var(--border-color)', borderRadius: '16px' }}>
                            <div className="flex items-center justify-between text-[11px] text-gray-500 pb-2 border-b border-gray-100">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                                Заказ: <strong className="text-gray-700">{m.order_no}</strong>
                              </span>
                              <span>{m.date}</span>
                            </div>
                            
                            <div className="text-xs text-gray-700 leading-relaxed text-left flex-grow">
                              Артикул <strong className="text-primary font-bold">{m.article}</strong> закупался в заказе <strong className="text-gray-850">{m.order_no}</strong> от {m.date}, поставщик <strong className="text-gray-850">{m.supplier}</strong>, валюта заказа <strong>{m.currency}</strong> по курсу <strong>{m.rate}</strong>.
                            </div>

                            <div className="flex items-center gap-4 text-xs pt-2 border-t border-gray-100/50">
                              <span className="text-gray-500 font-medium">Цена F = <strong className="text-gray-800">{m.price_f}</strong></span>
                              <span style={{ color: '#00855d', backgroundColor: 'rgba(0, 133, 93, 0.08)', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                                A = {m.price_a}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Text Block for NotebookLM Source */}
                    {sheetMatches.length > 0 && (
                      <div className="glass-panel p-5 space-y-4">
                        <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider" style={{ fontFamily: 'Outfit, sans-serif' }}>Консолидированный ответ</h4>
                        <textarea
                          readOnly
                          value={sheetCombinedText}
                          className="w-full bg-gray-50 text-gray-800 border border-gray-250 rounded-xl p-3 text-xs font-mono h-40 focus:outline-none"
                        />

                        {/* Save to Drive Actions Container */}
                        <div className="p-4 rounded-xl space-y-3" style={{ background: 'var(--surface-container-low)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                          <h5 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-primary text-[18px]">cloud_upload</span>
                            Выгрузить сводку на Google Диск для NotebookLM
                          </h5>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex flex-col space-y-1">
                              <label className="text-[10px] text-gray-500 font-bold">Имя файла:</label>
                              <input 
                                type="text"
                                value={sheetSaveFileName}
                                onChange={(e) => setSheetSaveFileName(e.target.value)}
                                className="bg-white border border-gray-305 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                              />
                            </div>

                            <div className="flex flex-col space-y-1">
                              <label className="text-[10px] text-gray-500 font-bold">Папка назначения:</label>
                              <select 
                                value={sheetFolderOption}
                                onChange={(e) => setSheetFolderOption(e.target.value)}
                                className="bg-white border border-gray-305 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                              >
                                <option value="__new__">➕ Создать новую папку...</option>
                                {topics.map(t => (
                                  <option key={t.slug} value={t.refined_topic}>
                                    📁 {t.refined_topic}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {sheetFolderOption === "__new__" && (
                            <div className="flex flex-col space-y-1">
                              <label className="text-[10px] text-gray-500 font-bold">Имя новой папки:</label>
                              <input 
                                type="text"
                                value={sheetNewFolderName}
                                onChange={(e) => setSheetNewFolderName(e.target.value)}
                                placeholder="Например: Закупки Артикула..."
                                className="bg-white border border-gray-305 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={handleSheetSaveToDrive}
                            disabled={sheetSaveLoading}
                            className="glow-button w-full py-2.5 flex items-center justify-center space-x-2 text-xs font-bold mt-2"
                          >
                            {sheetSaveLoading ? (
                              <>
                                <div className="w-4 h-4 rounded-full border-2 border-t-black border-white/20 spinner" />
                                <span>Выгрузка...</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-[16px]">cloud_sync</span>
                                <span>Сохранить на Google Диск</span>
                              </>
                            )}
                          </button>

                          {sheetSaveSuccess && (
                            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg text-left flex items-start space-x-2">
                              <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                              <div>
                                <p className="font-bold">Успешно загружено!</p>
                                <p className="mt-0.5">
                                  Файл <a href={sheetSaveSuccess.webViewLink} target="_blank" rel="noreferrer" className="underline font-semibold">{sheetSaveSuccess.filename}</a> сохранен в папку Google Drive.
                                </p>
                                <a href={sheetSaveSuccess.folder_link} target="_blank" rel="noreferrer" className="inline-block mt-1 font-bold underline">
                                  Открыть папку диска →
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer bar */}
      <footer className="py-4 border-t border-gray-200 text-center text-xs text-gray-400 bg-white mt-auto">
        <span>© 2026 NotebookLM Linker. Интегрировано с Google Drive API.</span>
      </footer>

      {/* BottomNavBar (Material Design 3 style) */}
      <nav className="app-nav">
        <a 
          className={`nav-item ${screen === "wizard" || screen === "approval" || screen === "loading" || screen === "completed" ? "active" : ""}`} 
          onClick={handleGoToResearch}
        >
          <span className="material-symbols-outlined">search</span>
          <span>Research</span>
        </a>
        <a 
          className={`nav-item ${screen === "history" ? "active" : ""}`} 
          onClick={() => { setScreen("history"); }}
        >
          <span className="material-symbols-outlined">history</span>
          <span>History</span>
        </a>
        <a 
          className={`nav-item ${screen === "settings" ? "active" : ""}`} 
          onClick={() => { setScreen("settings"); }}
        >
          <span className="material-symbols-outlined">settings</span>
          <span>Settings</span>
        </a>
      </nav>

    </div>
  );
}

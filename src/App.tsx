import React, { useState, useRef } from 'react';
import { 
  Search, 
  Video, 
  Clapperboard, 
  Image as ImageIcon, 
  Film, 
  Sparkles, 
  Target, 
  Anchor,
  AlertCircle,
  Loader2,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Music,
  Mic,
  UserCheck,
  Upload,
  Link as LinkIcon,
  Type as TypeIcon,
  Clock
} from 'lucide-react';
import { 
  analyzeProduct, 
  generateDetailedScript, 
  generateSuggestionsFromManualInfo,
  generateImage,
  VideoAnalysis, 
  DetailedScript, 
  ProductInfo, 
  ScriptSuggestion 
} from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [view, setView] = useState<'create' | 'guide'>('create');
  const [inputValue, setInputValue] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<ScriptSuggestion | null>(null);
  const [detailedScript, setDetailedScript] = useState<DetailedScript | null>(null);
  
  const [targetTool, setTargetTool] = useState<'veo' | 'sora' | 'grok'>('veo');
  const [duration, setDuration] = useState<number>(30);
  const [selectedStyle, setSelectedStyle] = useState<string>('Siêu thực');
  const [useCameo, setUseCameo] = useState(false);
  const [cameoUsername, setCameoUsername] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  
  const [originalProductImage, setOriginalProductImage] = useState<string | null>(null);
  const [assetImages, setAssetImages] = useState<Record<number, string>>({});
  const [sceneImages, setSceneImages] = useState<Record<string, string>>({});
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});

  const videoStyles = [
    { id: 'realistic', name: 'Siêu thực', description: 'Giống như đời thật 100%', icon: <Film size={16} /> },
    { id: '3d-anim', name: 'Hoạt hình 3D', description: 'Sản phẩm thành nhân hoá, có tay chân, biết nói', icon: <Sparkles size={16} /> },
    { id: 'mix-3d', name: 'Siêu thực mix 3D', description: 'Nhân vật 3D, sản phẩm và bối cảnh tả thật', icon: <Clapperboard size={16} /> },
    { id: 'anime', name: 'Anime/Ghibli', description: 'Phong cách nghệ thuật Nhật Bản, giàu cảm xúc', icon: <ImageIcon size={16} /> },
    { id: 'cyberpunk', name: 'Cyberpunk', description: 'Công nghệ tương lai, ánh sáng neon rực rỡ', icon: <Target size={16} /> },
    { id: 'claymation', name: 'Claymation', description: 'Phong cách đất sét, độc đáo và thu hút', icon: <Anchor size={16} /> },
  ];

  // Manual Info State
  const [manualInfo, setManualInfo] = useState<ProductInfo>({
    type: 'physical',
    name: '',
    category: '',
    targetAudience: '',
    usp: '',
    mainPillars: []
  });
  const [manualPillarsText, setManualPillarsText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setInputValue(file.name);
      setError(null);
      try {
        const base64 = await fileToBase64(file);
        setOriginalProductImage(base64);
      } catch (err) {
        console.error("Error converting file to base64", err);
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAnalyzeProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() && !selectedFile) {
      setError("Vui lòng nhập tên, link hoặc tải ảnh sản phẩm.");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);
    setSelectedSuggestion(null);
    setDetailedScript(null);

    try {
      let input: any = {};
      if (selectedFile) {
        const base64 = await fileToBase64(selectedFile);
        input.image = base64;
        input.mimeType = selectedFile.type;
      } else if (inputValue.startsWith('http')) {
        input.url = inputValue;
      } else {
        input.name = inputValue;
      }

      const result = await analyzeProduct(input);
      setAnalysis(result);
    } catch (err: any) {
      setError(err.message || "Đã có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmModel = async (modelName: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeProduct({ name: modelName });
      setAnalysis(result);
    } catch (err: any) {
      setError(err.message || "Không thể phân tích model đã chọn.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSuggestion = (suggestion: ScriptSuggestion) => {
    setSelectedSuggestion(suggestion);
    // Auto-match style
    if (suggestion.recommendedStyle) {
      setSelectedStyle(suggestion.recommendedStyle);
    }
    // Scroll to next step
    setTimeout(() => {
      document.getElementById('step-2')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleGenerateDetailedScript = async () => {
    if (!analysis || !selectedSuggestion) return;

    setLoading(true);
    setError(null);
    try {
      const result = await generateDetailedScript(
        analysis.productInfo,
        selectedSuggestion,
        duration,
        targetTool,
        selectedStyle,
        useCameo,
        cameoUsername
      );
      setDetailedScript(result);
      setTimeout(() => {
        document.getElementById('detailed-result')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      setError(err.message || "Không thể tạo kịch bản chi tiết.");
    } finally {
      setLoading(false);
    }
  };

  const getToolSuggestion = (d: number) => {
    if (d <= 0) return null;
    
    // Sora 2: 10s or 15s/scene
    // Veo 3: 8s/scene
    // Grok: 6s/scene
    
    const sora10 = Math.ceil(d / 10);
    const sora15 = Math.ceil(d / 15);
    const veo8 = Math.ceil(d / 8);
    const grok6 = Math.ceil(d / 6);
    
    // Logic: Find the tool that divides the duration most cleanly or has the longest scene length for stability
    if (d % 15 === 0 || d % 10 === 0) {
      const scenes = d % 15 === 0 ? sora15 : sora10;
      const sec = d % 15 === 0 ? 15 : 10;
      return `Phù hợp nhất với Sora 2 - ${scenes} cảnh, mỗi cảnh ${sec}s.`;
    }
    
    if (d % 8 === 0) {
      return `Phù hợp nhất với Veo 3 - ${veo8} cảnh, mỗi cảnh 8s.`;
    }
    
    if (d % 6 === 0) {
      return `Phù hợp nhất với Grok - ${grok6} cảnh, mỗi cảnh 6s.`;
    }
    
    // Default fallback: Sora usually handles longer durations better
    return `Gợi ý: Dùng Sora 2 (${sora10} cảnh x 10s) hoặc Veo 3 (${veo8} cảnh x 8s).`;
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInfo.name || !manualInfo.targetAudience || !manualInfo.usp) {
      setError("Vui lòng điền đầy đủ các thông tin bắt buộc.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const pillars = manualPillarsText.split(',').map(p => p.trim()).filter(p => p !== '');
      const result = await generateSuggestionsFromManualInfo({
        ...manualInfo,
        mainPillars: pillars
      });
      setAnalysis(result);
    } catch (err: any) {
      setError(err.message || "Không thể tạo gợi ý từ thông tin bạn cung cấp.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshSuggestions = async () => {
    if (!analysis || !analysis.productInfo) return;
    
    setLoading(true);
    setError(null);
    try {
      const result = await generateSuggestionsFromManualInfo(analysis.productInfo);
      setAnalysis(result);
      setSelectedSuggestion(null);
      setDetailedScript(null);
    } catch (err: any) {
      setError(err.message || "Không thể làm mới ý tưởng. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleGenerateAssetImage = async (idx: number, prompt: string, type: 'character' | 'product') => {
    setImageLoading(prev => ({ ...prev, [`asset-${idx}`]: true }));
    try {
      const refImage = type === 'product' ? (originalProductImage || undefined) : undefined;
      const imageUrl = await generateImage(prompt, refImage);
      setAssetImages(prev => ({ ...prev, [idx]: imageUrl }));
    } catch (err: any) {
      setError(err.message || "Không thể tạo hình ảnh tài sản.");
    } finally {
      setImageLoading(prev => ({ ...prev, [`asset-${idx}`]: false }));
    }
  };

  const handleGenerateSceneImage = async (idx: number, scene: any, version: string) => {
    const id = `scene-${version}-${idx}`;
    setImageLoading(prev => ({ ...prev, [id]: true }));
    try {
      // Find reference image
      let refImage: string | undefined = undefined;
      if (detailedScript) {
        // Try to find a matching asset
        const text = (scene.description + " " + scene.visualDetail).toLowerCase();
        for (let i = 0; i < detailedScript.visualAssets.length; i++) {
          const asset = detailedScript.visualAssets[i];
          if (text.includes(asset.name.toLowerCase()) || text.includes(asset.type)) {
            if (assetImages[i]) {
              refImage = assetImages[i].split(',')[1]; // Get base64 part
              break;
            } else if (asset.type === 'product' && originalProductImage) {
              refImage = originalProductImage;
              break;
            }
          }
        }
      }

      const imageUrl = await generateImage(scene.imagePrompt, refImage);
      setSceneImages(prev => ({ ...prev, [id]: imageUrl }));
    } catch (err: any) {
      setError(err.message || "Không thể tạo hình ảnh phân cảnh.");
    } finally {
      setImageLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const reset = () => {
    setAnalysis(null);
    setSelectedSuggestion(null);
    setDetailedScript(null);
    setInputValue('');
    setSelectedFile(null);
    setManualInfo({
      type: 'physical',
      name: '',
      category: '',
      targetAudience: '',
      usp: '',
      mainPillars: []
    });
    setManualPillarsText('');
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-orange-100">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={reset}>
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
              <Video size={18} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Video Affiliate Viral</h1>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-500">
            <span 
              onClick={() => setView('create')}
              className={cn("cursor-pointer transition-colors", view === 'create' ? "text-orange-500" : "hover:text-orange-500")}
            >
              Sáng tạo
            </span>
            <span 
              onClick={() => setView('guide')}
              className={cn("cursor-pointer transition-colors", view === 'guide' ? "text-sky-500" : "hover:text-sky-500")}
            >
              Hướng dẫn
            </span>
            <a 
              href="https://zalo.me/g/zqgzkf498" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-sky-500 cursor-pointer transition-colors"
            >
              Cộng đồng
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        {view === 'guide' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-12">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-6 text-gray-900">
                Hướng Dẫn Sử Dụng <br />
                <span className="text-sky-500">Video Affiliate Viral</span>
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed">
                Quy trình 3 bước đơn giản để tạo kịch bản video bán hàng triệu view bằng trí tuệ nhân tạo.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/30">
                <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center mb-6 font-black text-xl">1</div>
                <h4 className="text-xl font-black mb-3">Nhập thông tin</h4>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Tải ảnh sản phẩm, dán link Affiliate hoặc đơn giản là nhập tên sản phẩm. AI sẽ tự động quét dữ liệu từ internet.
                </p>
              </div>
              <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/30">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-6 font-black text-xl">2</div>
                <h4 className="text-xl font-black mb-3">Chọn ý tưởng</h4>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Hệ thống gợi ý 5 hướng tiếp cận viral nhất. Bạn chỉ cần chọn 1 ý tưởng phù hợp với phong cách của mình.
                </p>
              </div>
              <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/30">
                <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center mb-6 font-black text-xl">3</div>
                <h4 className="text-xl font-black mb-3">Tạo kịch bản</h4>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Tùy chỉnh thời lượng và nền tảng AI Video (Veo, Sora, Grok) để nhận kịch bản chi tiết từng phân cảnh.
                </p>
              </div>
            </div>

            <div className="bg-gray-900 rounded-[2.5rem] p-10 text-white">
              <h4 className="text-2xl font-black mb-6 flex items-center gap-3">
                <Sparkles className="text-orange-500" />
                Mẹo để có kết quả tốt nhất
              </h4>
              <ul className="space-y-4 text-gray-400">
                <li className="flex items-start gap-3">
                  <Check className="text-sky-500 mt-1 flex-shrink-0" size={18} />
                  <span>Sử dụng ảnh sản phẩm rõ nét, có đầy đủ logo hoặc đặc điểm nhận dạng.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-sky-500 mt-1 flex-shrink-0" size={18} />
                  <span>Với sản phẩm số, hãy dán link trang bán hàng (Sales Page) để AI quét được USP chính xác.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-sky-500 mt-1 flex-shrink-0" size={18} />
                  <span>Chọn thời lượng 15-30s cho TikTok/Reels để tối ưu tỷ lệ xem hết.</span>
                </li>
              </ul>
              <button 
                onClick={() => setView('create')}
                className="mt-10 px-8 py-4 bg-sky-500 hover:bg-sky-600 text-white font-black rounded-2xl transition-all uppercase tracking-widest"
              >
                Bắt đầu ngay
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Hero Section */}
            {!analysis && (
          <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight mb-6 text-gray-900">
              Biến Sản Phẩm Thành <br />
              <span className="text-orange-500">Video Triệu View</span>
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
              Công cụ AI tối ưu kịch bản Affiliate cho sản phẩm vật lý và sản phẩm số. 
              Chỉ cần tên, link hoặc ảnh sản phẩm.
            </p>
          </div>
        )}

        {/* 3-in-1 Input Section */}
        {!analysis && (
          <div className="max-w-3xl mx-auto mb-16">
            <form onSubmit={handleAnalyzeProduct} className="relative group">
              <div className="relative flex items-center">
                <div className="absolute left-4 flex items-center gap-2 text-gray-400">
                  {selectedFile ? <ImageIcon size={20} className="text-orange-500" /> : <Search size={20} />}
                </div>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Tên sản phẩm, link Affiliate hoặc tải ảnh..."
                  className="w-full pl-12 pr-32 py-5 bg-white border-2 border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all text-lg"
                />
                <div className="absolute right-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-gray-400 hover:text-sky-500 transition-colors rounded-lg hover:bg-sky-50"
                    title="Tải ảnh sản phẩm"
                  >
                    <Upload size={20} />
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full py-4 bg-sky-500 hover:bg-sky-600 text-white font-black rounded-2xl transition-all disabled:opacity-50 shadow-xl shadow-sky-500/20 flex items-center justify-center gap-2 text-lg uppercase tracking-wider"
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : <Sparkles size={24} />}
                <span>{loading ? 'Đang quét thông tin...' : 'Phân tích & Tạo kịch bản'}</span>
              </button>
            </form>
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 animate-in shake duration-300">
                <AlertCircle size={20} />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
          </div>
        )}

        {loading && !analysis && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center text-orange-500 mb-8 relative">
              <Search size={40} className="animate-pulse" />
              <div className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-center space-y-3">
              <p className="text-gray-900 font-black text-2xl uppercase tracking-tight">Đang quét dữ liệu sản phẩm...</p>
              <p className="text-gray-500 max-w-md mx-auto font-medium">
                Hệ thống đang tìm kiếm USP, đối tượng khách hàng và các trụ cột nội dung trên internet.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Product Info & Suggestions */}
        {analysis && !detailedScript && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {analysis.notFound ? (
              <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/50 overflow-hidden">
                <div className="bg-red-500 p-8 text-white flex items-center gap-4">
                  <button 
                    onClick={() => setAnalysis(null)}
                    className="p-2 hover:bg-white/20 rounded-xl transition-all mr-2"
                    title="Quay lại"
                  >
                    <ChevronRight className="rotate-180" size={24} />
                  </button>
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                    <AlertCircle size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">Không tìm thấy thông tin</h3>
                    <p className="opacity-80 font-medium">Chúng tôi không tìm thấy dữ liệu về sản phẩm này trên internet. Vui lòng bổ sung thông tin bên dưới.</p>
                  </div>
                </div>
                
                <form onSubmit={handleManualSubmit} className="p-8 sm:p-12 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 block">Tên sản phẩm *</label>
                      <input 
                        type="text" 
                        value={manualInfo.name}
                        onChange={(e) => setManualInfo({...manualInfo, name: e.target.value})}
                        className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-sky-500 outline-none transition-all font-bold"
                        placeholder="Ví dụ: Máy lọc không khí Xiaomi 4 Lite"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 block">Loại sản phẩm</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          type="button"
                          onClick={() => setManualInfo({...manualInfo, type: 'physical'})}
                          className={cn("py-4 rounded-2xl font-black text-sm transition-all", manualInfo.type === 'physical' ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200")}
                        >
                          Vật lý
                        </button>
                        <button 
                          type="button"
                          onClick={() => setManualInfo({...manualInfo, type: 'digital'})}
                          className={cn("py-4 rounded-2xl font-black text-sm transition-all", manualInfo.type === 'digital' ? "bg-sky-500 text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200")}
                        >
                          Sản phẩm số
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 block">Đối tượng khách hàng *</label>
                      <input 
                        type="text" 
                        value={manualInfo.targetAudience}
                        onChange={(e) => setManualInfo({...manualInfo, targetAudience: e.target.value})}
                        className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-sky-500 outline-none transition-all font-bold"
                        placeholder="Ví dụ: Người sống ở chung cư, quan tâm sức khỏe"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 block">USP (Điểm bán hàng độc nhất) *</label>
                      <input 
                        type="text" 
                        value={manualInfo.usp}
                        onChange={(e) => setManualInfo({...manualInfo, usp: e.target.value})}
                        className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-sky-500 outline-none transition-all font-bold"
                        placeholder="Ví dụ: Lọc bụi mịn PM2.5, điều khiển qua app, giá rẻ"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 block">Các trụ cột nội dung (Cách nhau bằng dấu phẩy)</label>
                    <textarea 
                      value={manualPillarsText}
                      onChange={(e) => setManualPillarsText(e.target.value)}
                      className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-sky-500 outline-none transition-all font-bold min-h-[100px]"
                      placeholder="Ví dụ: Thiết kế tối giản, Khả năng lọc mạnh mẽ, Tiết kiệm điện, Dễ dàng vệ sinh"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-5 bg-sky-500 hover:bg-sky-600 text-white font-black rounded-2xl transition-all shadow-xl shadow-sky-500/20 flex items-center justify-center gap-3 text-lg uppercase tracking-widest"
                  >
                    {loading ? <Loader2 className="animate-spin" size={24} /> : <Sparkles size={24} />}
                    <span>Tiếp tục tạo kịch bản</span>
                  </button>
                </form>
              </section>
            ) : (
              <>
                {analysis.notFound && (
                  <div className="bg-red-50 border-2 border-red-100 p-10 rounded-[2.5rem] text-center space-y-4 animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle size={40} />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900">Không quét được thông tin sản phẩm</h3>
                    <p className="text-gray-500 font-medium max-w-md mx-auto">
                      AI không tìm thấy thông tin chính xác về sản phẩm này trên internet. Vui lòng kiểm tra lại ảnh hoặc nhập thông tin thủ công.
                    </p>
                    <button 
                      onClick={() => setAnalysis(null)}
                      className="px-8 py-3 bg-gray-900 text-white font-bold rounded-2xl hover:bg-red-600 transition-all"
                    >
                      Thử lại
                    </button>
                  </div>
                )}

                {analysis.isAmbiguous && analysis.possibleModels && (
                  <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/50 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500">
                    <div className="bg-amber-500 p-8 text-white flex items-center gap-4">
                      <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                        <Search size={28} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black uppercase tracking-tight">Xác nhận mẫu mã sản phẩm</h3>
                        <p className="opacity-80 font-medium">AI tìm thấy nhiều mẫu mã tương tự. Vui lòng chọn đúng model của bạn:</p>
                      </div>
                    </div>
                    <div className="p-8 sm:p-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {analysis.possibleModels.map((model, i) => (
                        <button
                          key={i}
                          onClick={() => handleConfirmModel(model.name)}
                          className="text-left p-6 bg-gray-50 border-2 border-gray-100 rounded-3xl hover:border-amber-500 hover:bg-amber-50 transition-all group"
                        >
                          <h4 className="text-xl font-black text-gray-900 mb-2 group-hover:text-amber-600">{model.name}</h4>
                          <p className="text-gray-500 text-sm leading-relaxed">{model.description}</p>
                        </button>
                      ))}
                      <button
                        onClick={() => setAnalysis({ ...analysis, notFound: true, isAmbiguous: false })}
                        className="text-left p-6 bg-red-50 border-2 border-red-100 rounded-3xl hover:border-red-500 hover:bg-red-100 transition-all group flex flex-col justify-center items-center text-center"
                      >
                        <AlertCircle className="text-red-500 mb-2" size={32} />
                        <h4 className="text-xl font-black text-red-900">Không có kết quả nào chính xác</h4>
                        <p className="text-red-600/70 text-sm font-bold">Quay lại hoặc nhập thủ công</p>
                      </button>
                    </div>
                  </section>
                )}

                {analysis.productInfo && !analysis.isAmbiguous && (
                  <>
                    {/* Product Info Card */}
                    <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/50 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500">
                      <div className="bg-sky-500 p-8 text-white flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => setAnalysis(null)}
                            className="p-2 hover:bg-white/20 rounded-xl transition-all"
                            title="Quay lại"
                          >
                            <ChevronRight className="rotate-180" size={24} />
                          </button>
                          <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                            <Target size={28} />
                          </div>
                          <div>
                            <h3 className="text-2xl font-black uppercase tracking-tight">THÔNG TIN SẢN PHẨM</h3>
                            <p className="opacity-80 font-medium">Dữ liệu đã được tổng hợp từ internet</p>
                          </div>
                        </div>
                        <div className="px-6 py-3 bg-white text-sky-600 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-sky-900/10">
                          {analysis.productInfo.type === 'physical' ? 'SẢN PHẨM VẬT LÝ' : 'SẢN PHẨM SỐ'}
                        </div>
                      </div>
                      
                      <div className="p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-2 gap-16">
                        <div className="space-y-10">
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3 block">TÊN SẢN PHẨM</label>
                            <p className="text-4xl font-black text-gray-900 leading-tight">{analysis.productInfo?.name}</p>
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3 block">ĐỐI TƯỢNG KHÁCH HÀNG</label>
                            <p className="text-gray-600 font-medium text-lg leading-relaxed">{analysis.productInfo.targetAudience}</p>
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3 block">USP (ĐIỂM BÁN HÀNG ĐỘC NHẤT)</label>
                            <div className="p-6 bg-orange-50 rounded-[2rem] border border-orange-100 text-orange-900 font-bold italic text-lg leading-relaxed">
                              "{analysis.productInfo.usp}"
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-10">
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6 block">TRỤ CỘT NỘI DUNG CHÍNH</label>
                            <div className="grid gap-4">
                              {analysis.productInfo.mainPillars.map((pillar, i) => (
                                <div key={i} className="flex items-start gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-sky-200 transition-all hover:shadow-md hover:shadow-sky-500/5">
                                  <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-sm font-black flex-shrink-0 mt-0.5 shadow-sm">
                                    {i + 1}
                                  </div>
                                  <p className="text-gray-700 font-bold text-lg leading-snug">{pillar}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Script Suggestions */}
                    {analysis.scriptSuggestions && (
                      <section className="space-y-8 mt-16">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="text-center sm:text-left">
                            <h3 className="text-3xl font-black text-gray-900 mb-2">Chọn Ý Tưởng Kịch Bản</h3>
                            <p className="text-gray-500 font-medium">Chúng tôi gợi ý 5 hướng tiếp cận viral nhất cho sản phẩm này</p>
                          </div>
                          <button 
                            onClick={handleRefreshSuggestions}
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all disabled:opacity-50"
                          >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} className="text-orange-500" />}
                            <span>Đổi ý tưởng khác</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {analysis.scriptSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.id}
                              onClick={() => handleSelectSuggestion(suggestion)}
                              className={cn(
                                "text-left p-8 rounded-[2rem] border-2 transition-all group relative overflow-hidden",
                                selectedSuggestion?.id === suggestion.id 
                                  ? "border-orange-500 bg-orange-50 shadow-xl shadow-orange-500/10" 
                                  : "border-gray-100 bg-white hover:border-sky-300 hover:shadow-xl hover:shadow-sky-500/5"
                              )}
                            >
                              <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-colors",
                                selectedSuggestion?.id === suggestion.id ? "bg-orange-500 text-white" : "bg-sky-100 text-sky-600 group-hover:bg-sky-500 group-hover:text-white"
                              )}>
                                <Sparkles size={24} />
                              </div>
                              <h4 className="text-xl font-black text-gray-900 mb-3 leading-tight">{suggestion.title}</h4>
                              <p className="text-orange-600 font-black text-xs uppercase tracking-widest mb-4">Hook: {suggestion.hook}</p>
                              <p className="text-gray-500 text-sm leading-relaxed line-clamp-3">{suggestion.description}</p>
                              
                              {selectedSuggestion?.id === suggestion.id && (
                                <div className="absolute top-4 right-4 text-orange-500">
                                  <Check size={24} strokeWidth={3} />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}

                {/* Step 2: Configuration */}
                {selectedSuggestion && (
              <section id="step-2" className="max-w-3xl mx-auto bg-gray-900 rounded-[2.5rem] p-8 sm:p-12 text-white space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-500 relative">
                <button 
                  onClick={() => setSelectedSuggestion(null)}
                  className="absolute top-8 left-8 p-2 hover:bg-white/10 rounded-xl transition-all text-gray-400"
                  title="Quay lại"
                >
                  <ChevronRight className="rotate-180" size={24} />
                </button>
                <div className="text-center">
                  <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Cấu hình kịch bản chi tiết</h3>
                  <p className="text-gray-400 font-medium">Tùy chỉnh thời lượng và nền tảng AI</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <Clock size={14} /> Thời lượng video (giây)
                      </label>
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          {[15, 30, 60].map((d) => (
                            <button
                              key={d}
                              onClick={() => setDuration(d)}
                              className={cn(
                                "py-3 rounded-xl font-black text-sm transition-all",
                                duration === d ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                              )}
                            >
                              {d}s
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            type="button"
                            onClick={() => setDuration(Math.max(0, duration - 5))}
                            className="p-3 bg-gray-800 border border-gray-700 rounded-xl text-white hover:bg-gray-700 transition-all font-bold"
                          >
                            -5s
                          </button>
                          <div className="relative flex-1">
                            <input 
                              type="number"
                              value={duration === 0 ? '' : duration}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                  setDuration(0);
                                } else {
                                  setDuration(parseInt(val) || 0);
                                }
                              }}
                              placeholder="Nhập số giây..."
                              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-bold focus:border-orange-500 outline-none transition-all"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">giây</span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setDuration(duration + 5)}
                            className="p-3 bg-gray-800 border border-gray-700 rounded-xl text-white hover:bg-gray-700 transition-all font-bold"
                          >
                            +5s
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <Film size={14} /> Nền tảng AI Video
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'veo', name: 'Veo 3 (8s/c)' },
                          { id: 'sora', name: 'Sora 2 (10-15s)' },
                          { id: 'grok', name: 'Grok (6s/c)' }
                        ].map((tool) => (
                          <button
                            key={tool.id}
                            onClick={() => setTargetTool(tool.id as any)}
                            className={cn(
                              "py-3 rounded-xl font-black text-[10px] transition-all",
                              targetTool === tool.id ? "bg-sky-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                            )}
                          >
                            {tool.name}
                          </button>
                        ))}
                      </div>
                      {targetTool === 'sora' && (
                        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl animate-in fade-in slide-in-from-top-1 duration-300">
                          <p className="text-[10px] text-orange-400 font-bold flex items-start gap-2 leading-relaxed">
                            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                            <span>
                              CẢNH BÁO: Sora 2 không phù hợp cho sản phẩm vật lý cần độ chính xác tuyệt đối về hình dạng/kích thước. 
                              Sora tốt nhất cho con người, cảm xúc và chuyển động. 
                              Khuyên dùng <strong>Veo 3</strong> hoặc <strong>Grok</strong> cho sản phẩm vật lý.
                            </span>
                          </p>
                        </div>
                      )}
                      {targetTool === 'sora' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                            <div className="flex items-center gap-2">
                              <UserCheck size={16} className="text-orange-500" />
                              <span className="text-xs font-bold text-orange-400">Sử dụng Cameo (Chính chủ)</span>
                            </div>
                            <button 
                              onClick={() => setUseCameo(!useCameo)}
                              className={cn(
                                "w-10 h-5 rounded-full transition-all relative",
                                useCameo ? "bg-orange-500" : "bg-gray-700"
                              )}
                            >
                              <div className={cn(
                                "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                                useCameo ? "right-1" : "left-1"
                              )} />
                            </button>
                          </div>
                          {useCameo && (
                            <div className="animate-in slide-in-from-top-2 duration-300">
                              <input 
                                type="text"
                                value={cameoUsername}
                                onChange={(e) => setCameoUsername(e.target.value)}
                                placeholder="Nhập username cameo (ví dụ: son_ai)..."
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-bold focus:border-orange-500 outline-none transition-all text-sm"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                      <Sparkles size={14} /> Phong cách video
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {videoStyles.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => setSelectedStyle(style.name)}
                          className={cn(
                            "p-3 rounded-xl text-left transition-all border-2 relative",
                            selectedStyle === style.name 
                              ? "bg-sky-500/10 border-sky-500 text-white" 
                              : "bg-gray-800 border-transparent text-gray-400 hover:bg-gray-700"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {style.icon}
                            <span className="text-[10px] font-black uppercase">{style.name}</span>
                          </div>
                          <p className="text-[9px] opacity-60 leading-tight">{style.description}</p>
                          
                          {selectedSuggestion?.recommendedStyle === style.name && (
                            <div className="absolute -top-2 -right-1 px-2 py-0.5 bg-sky-500 text-[8px] font-black rounded-full text-white uppercase tracking-tighter shadow-lg">
                              Gợi ý
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGenerateDetailedScript}
                  disabled={loading}
                  className="w-full py-5 bg-white text-gray-900 font-black rounded-2xl hover:bg-orange-500 hover:text-white transition-all shadow-xl shadow-white/5 flex items-center justify-center gap-3 text-lg uppercase tracking-widest"
                >
                  {loading ? <Loader2 className="animate-spin" size={24} /> : <Clapperboard size={24} />}
                  <span>{loading ? 'Đang tạo kịch bản chi tiết...' : 'Tạo kịch bản phân cảnh'}</span>
                </button>
              </section>
                )}
              </>
            )}
          </div>
        )}

        {/* Final Result: Detailed Script */}
        {detailedScript && (
          <div id="detailed-result" className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 mt-12">
            <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/50 overflow-hidden">
              <div className="bg-orange-500 p-8 text-white relative">
                <button 
                  onClick={() => setDetailedScript(null)}
                  className="absolute top-8 left-8 p-2 hover:bg-white/20 rounded-xl transition-all"
                  title="Quay lại"
                >
                  <ChevronRight className="rotate-180" size={24} />
                </button>
                <div className="flex items-center gap-4 mb-4 pl-12">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                    <Clapperboard size={28} />
                  </div>
                  <h3 className="text-3xl font-black uppercase tracking-tight">{detailedScript.title}</h3>
                </div>
                <div className="flex gap-4">
                  <span className="px-3 py-1 bg-white/20 rounded-lg text-xs font-bold uppercase tracking-widest">Thời lượng: {duration}s</span>
                  <span className="px-3 py-1 bg-white/20 rounded-lg text-xs font-bold uppercase tracking-widest">Nền tảng: {targetTool.toUpperCase()}</span>
                </div>
              </div>

              <div className="p-8 sm:p-12 space-y-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                  <div className="lg:col-span-2 space-y-10">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 block">Kịch bản tổng thể (Overall Script)</h4>
                      <div className="p-8 bg-gray-50 rounded-[2rem] border border-gray-100 text-gray-800 leading-relaxed text-lg font-medium italic">
                        "{detailedScript.overallScript}"
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 block">Tài sản hình ảnh cố định</h4>
                      <div className="space-y-4">
                        {detailedScript.visualAssets.map((asset, i) => (
                          <div key={i} className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm group hover:border-sky-200 transition-all">
                            <div className="flex items-center gap-3 mb-3">
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center text-white",
                                asset.type === 'character' ? "bg-sky-500" : "bg-orange-500"
                              )}>
                                {asset.type === 'character' ? <UserCheck size={16} /> : <Anchor size={16} />}
                              </div>
                              <div>
                                <h5 className="font-black text-sm text-gray-900">{asset.name}</h5>
                                <p className="text-[10px] text-gray-400 uppercase font-bold">{asset.type === 'character' ? 'Nhân vật' : 'Sản phẩm'}</p>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mb-4 leading-relaxed">{asset.description}</p>
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 relative group/asset mb-4">
                              <p className="text-[9px] text-gray-400 font-mono line-clamp-2">{asset.imagePrompt}</p>
                              <button 
                                onClick={() => copyToClipboard(asset.imagePrompt, `asset-${i}`)}
                                className="absolute top-2 right-2 p-1.5 bg-white rounded-lg shadow-sm opacity-0 group-hover/asset:opacity-100 transition-all text-gray-400 hover:text-sky-500"
                              >
                                {copiedIndex === `asset-${i}` ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleGenerateAssetImage(i, asset.imagePrompt, asset.type)}
                                disabled={imageLoading[`asset-${i}`]}
                                className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                {imageLoading[`asset-${i}`] ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                <span>Tạo ảnh nhân vật</span>
                              </button>
                            </div>
                            {assetImages[i] && (
                              <div className="mt-4 rounded-xl overflow-hidden border border-gray-100 aspect-[9/16] bg-gray-50">
                                <img src={assetImages[i]} alt={asset.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block">Chi tiết từng phân cảnh</h4>
                  
                  {targetTool === 'sora' && detailedScript.sora15sScenes && (
                    <div className="flex gap-4 mb-8">
                      <div className="p-4 bg-sky-50 border border-sky-100 rounded-2xl flex-1">
                        <p className="text-sky-600 font-black text-sm uppercase mb-1">Bản 1: 10s/cảnh</p>
                        <p className="text-gray-500 text-xs font-medium">Tối ưu cho sự linh hoạt và nhịp độ nhanh.</p>
                      </div>
                      <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex-1">
                        <p className="text-orange-600 font-black text-sm uppercase mb-1">Bản 2: 15s/cảnh</p>
                        <p className="text-gray-500 text-xs font-medium">Tối ưu cho các cảnh quay điện ảnh, chi tiết.</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-12">
                    {/* Version 1 (Default or 10s for Sora) */}
                    <div className="space-y-4">
                      {targetTool === 'sora' && <h5 className="text-lg font-black text-sky-600 uppercase tracking-tight">Phiên bản 10s/cảnh</h5>}
                      {detailedScript.scenes.map((scene, idx) => (
                        <div key={idx} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden group hover:border-orange-200 transition-all">
                          <div className="p-6 sm:p-8">
                            <div className="flex flex-col sm:flex-row gap-8">
                              <div className="sm:w-24 flex-shrink-0">
                                <div className="text-4xl font-black text-gray-100 mb-2 group-hover:text-orange-100 transition-colors">{(idx + 1).toString().padStart(2, '0')}</div>
                                <div className="text-xs font-black text-sky-600 bg-sky-50 px-3 py-1.5 rounded-xl inline-block uppercase tracking-widest">
                                  {scene.timestamp}
                                </div>
                              </div>
                              <div className="flex-1 space-y-6">
                                <div>
                                  <h5 className="font-black text-xl mb-3 text-gray-900">{scene.description}</h5>
                                  <p className="text-gray-500 font-medium leading-relaxed">{scene.visualDetail}</p>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-4">
                                      <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 group/prompt relative">
                                        <div className="flex items-center justify-between mb-3">
                                          <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            <ImageIcon size={14} />
                                            <span>Image Prompt</span>
                                          </div>
                                          <button 
                                            onClick={() => copyToClipboard(scene.imagePrompt, `img-${idx}`)}
                                            className="p-2 hover:bg-white rounded-xl transition-all text-gray-400 hover:text-orange-500"
                                          >
                                            {copiedIndex === `img-${idx}` ? <Check size={16} /> : <Copy size={16} />}
                                          </button>
                                        </div>
                                        <p className="text-xs text-gray-600 font-mono leading-relaxed mb-4">
                                          {scene.imagePrompt}
                                        </p>
                                        <button 
                                          onClick={() => handleGenerateSceneImage(idx, scene, '10s')}
                                          disabled={imageLoading[`scene-10s-${idx}`]}
                                          className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                          {imageLoading[`scene-10s-${idx}`] ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                          <span>Tạo ảnh phân cảnh</span>
                                        </button>
                                      </div>
                                      {sceneImages[`scene-10s-${idx}`] && (
                                        <div className="rounded-2xl overflow-hidden border border-gray-100 aspect-[9/16] bg-gray-50">
                                          <img src={sceneImages[`scene-10s-${idx}`]} alt={`Scene ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        </div>
                                      )}
                                    </div>

                                  <div className="p-5 bg-sky-50/50 rounded-2xl border border-sky-100 group/prompt relative">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2 text-[10px] font-black text-sky-600 uppercase tracking-widest">
                                        <Film size={14} />
                                        <span>Video Prompt & VO</span>
                                      </div>
                                      <button 
                                        onClick={() => copyToClipboard(scene.fullVideoPrompt, `vid-${idx}`)}
                                        className="p-2 hover:bg-white rounded-xl transition-all text-sky-400 hover:text-sky-600"
                                      >
                                        {copiedIndex === `vid-${idx}` ? <Check size={16} /> : <Copy size={16} />}
                                      </button>
                                    </div>
                                    <p className="text-xs text-sky-900 font-mono leading-relaxed">
                                      {scene.fullVideoPrompt}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Version 2 (15s for Sora) */}
                    {targetTool === 'sora' && detailedScript.sora15sScenes && (
                      <div className="space-y-4 pt-12 border-t border-gray-100">
                        <h5 className="text-lg font-black text-orange-600 uppercase tracking-tight">Phiên bản 15s/cảnh</h5>
                        {detailedScript.sora15sScenes.map((scene, idx) => (
                          <div key={idx} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden group hover:border-orange-200 transition-all">
                            <div className="p-6 sm:p-8">
                              <div className="flex flex-col sm:flex-row gap-8">
                                <div className="sm:w-24 flex-shrink-0">
                                  <div className="text-4xl font-black text-gray-100 mb-2 group-hover:text-orange-100 transition-colors">{(idx + 1).toString().padStart(2, '0')}</div>
                                  <div className="text-xs font-black text-orange-600 bg-orange-50 px-3 py-1.5 rounded-xl inline-block uppercase tracking-widest">
                                    {scene.timestamp}
                                  </div>
                                </div>
                                <div className="flex-1 space-y-6">
                                  <div>
                                    <h5 className="font-black text-xl mb-3 text-gray-900">{scene.description}</h5>
                                    <p className="text-gray-500 font-medium leading-relaxed">{scene.visualDetail}</p>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-4">
                                        <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 group/prompt relative">
                                          <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                              <ImageIcon size={14} />
                                              <span>Image Prompt</span>
                                            </div>
                                            <button 
                                              onClick={() => copyToClipboard(scene.imagePrompt, `img-15s-${idx}`)}
                                              className="p-2 hover:bg-white rounded-xl transition-all text-gray-400 hover:text-orange-500"
                                            >
                                              {copiedIndex === `img-15s-${idx}` ? <Check size={16} /> : <Copy size={16} />}
                                            </button>
                                          </div>
                                          <p className="text-xs text-gray-600 font-mono leading-relaxed mb-4">
                                            {scene.imagePrompt}
                                          </p>
                                          <button 
                                            onClick={() => handleGenerateSceneImage(idx, scene, '15s')}
                                            disabled={imageLoading[`scene-15s-${idx}`]}
                                            className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                          >
                                            {imageLoading[`scene-15s-${idx}`] ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            <span>Tạo ảnh phân cảnh</span>
                                          </button>
                                        </div>
                                        {sceneImages[`scene-15s-${idx}`] && (
                                          <div className="rounded-2xl overflow-hidden border border-gray-100 aspect-[9/16] bg-gray-50">
                                            <img src={sceneImages[`scene-15s-${idx}`]} alt={`Scene ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                          </div>
                                        )}
                                      </div>

                                    <div className="p-5 bg-orange-50/50 rounded-2xl border border-orange-100 group/prompt relative">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-orange-600 uppercase tracking-widest">
                                          <Film size={14} />
                                          <span>Video Prompt & VO</span>
                                        </div>
                                        <button 
                                          onClick={() => copyToClipboard(scene.fullVideoPrompt, `vid-15s-${idx}`)}
                                          className="p-2 hover:bg-white rounded-xl transition-all text-orange-400 hover:text-orange-600"
                                        >
                                          {copiedIndex === `vid-15s-${idx}` ? <Check size={16} /> : <Copy size={16} />}
                                        </button>
                                      </div>
                                      <p className="text-xs text-orange-900 font-mono leading-relaxed">
                                        {scene.fullVideoPrompt}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <div className="flex justify-center gap-4">
              <button 
                onClick={reset}
                className="px-10 py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-orange-500 transition-all uppercase tracking-widest shadow-xl shadow-gray-900/10"
              >
                Tạo kịch bản mới
              </button>
              <button 
                onClick={() => window.print()}
                className="px-10 py-4 bg-white border-2 border-gray-100 text-gray-900 font-black rounded-2xl hover:border-sky-500 transition-all uppercase tracking-widest"
              >
                Xuất PDF
              </button>
            </div>
          </div>
        )}

        {/* Features Info */}
        {!analysis && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
            {[
              { icon: <Target className="text-orange-500" />, title: "Sản phẩm Vật lý", desc: "Tối ưu kịch bản review, đập hộp và trải nghiệm thực tế." },
              { icon: <Sparkles className="text-sky-500" />, title: "Sản phẩm Số", desc: "Kịch bản bán khóa học, phần mềm và dịch vụ online chuyên nghiệp." },
              { icon: <UserCheck className="text-orange-500" />, title: "Chuẩn Affiliate", desc: "Tích hợp các kỹ thuật tâm lý bán hàng và CTA mạnh mẽ." }
            ].map((item, i) => (
              <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all group">
                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">{item.icon}</div>
                <h4 className="text-xl font-black mb-3 text-gray-900">{item.title}</h4>
                <p className="text-gray-500 font-medium leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        )}
          </>
        )}
      </main>

      <footer className="mt-32 border-t border-gray-100 py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 text-center space-y-6">
          <div className="space-y-3">
            <p className="text-gray-900 font-black text-lg">Video Affiliate Viral</p>
            <p className="text-gray-900 font-bold">Made by Nguyễn Văn Sơn</p>
            <p className="text-gray-600 text-sm">Liên hệ công việc Hotline/Zalo: <span className="font-bold">0989.881.732</span></p>
            <p className="text-gray-600 text-sm">
              Cộng đồng tự học AI hàng ngày: 
              <a href="https://zalo.me/g/zqgzkf498" target="_blank" rel="noopener noreferrer" className="ml-1 text-orange-600 hover:underline font-medium inline-flex items-center gap-1">
                https://zalo.me/g/zqgzkf498
                <ExternalLink size={12} />
              </a>
            </p>
          </div>
          <p className="text-gray-400 text-[10px] uppercase tracking-[0.3em] pt-8">© 2026 Video Affiliate Viral • Powered by Gemini 3 Flash</p>
        </div>
      </footer>
    </div>
  );
}

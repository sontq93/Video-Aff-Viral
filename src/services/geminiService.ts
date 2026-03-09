import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface Scene {
  timestamp: string;
  description: string;
  visualDetail: string;
  imagePrompt: string;
  fullVideoPrompt: string;
}

export interface ScriptSuggestion {
  id: string;
  title: string;
  hook: string;
  description: string;
  recommendedStyle: string;
}

export interface ProductInfo {
  type: 'physical' | 'digital';
  name: string;
  category: string;
  targetAudience: string;
  usp: string;
  mainPillars: string[];
}

export interface VideoAnalysis {
  productInfo?: ProductInfo;
  scriptSuggestions?: ScriptSuggestion[];
  notFound?: boolean;
  isAmbiguous?: boolean;
  possibleModels?: { name: string; description: string }[];
}

export interface VisualAsset {
  name: string;
  type: 'character' | 'product';
  description: string;
  imagePrompt: string;
}

export interface DetailedScript {
  title: string;
  overallScript: string;
  suggestedDuration: number;
  recommendedStyle: string;
  visualAssets: VisualAsset[];
  scenes: Scene[];
  sora15sScenes?: Scene[]; // For Sora 2, we provide a 15s version as well
}

export async function analyzeProduct(
  input: { image?: string; name?: string; url?: string; mimeType?: string }
): Promise<VideoAnalysis> {
  const model = "gemini-3-flash-preview";
  
  const parts: any[] = [];
  
  if (input.image) {
    parts.push({
      inlineData: {
        data: input.image,
        mimeType: input.mimeType || "image/png"
      }
    });
    parts.push({
      text: "Đây là hình ảnh sản phẩm. Hãy phân tích sản phẩm này."
    });
  } else if (input.url) {
    parts.push({
      text: `Đây là link sản phẩm: ${input.url}. Hãy phân tích sản phẩm này.`
    });
  } else if (input.name) {
    parts.push({
      text: `Đây là tên sản phẩm: ${input.name}. Hãy phân tích sản phẩm này.`
    });
  }

  const coreInstructions = `
    Bạn là chuyên gia của hệ thống "Video Affiliate Viral". 
    Nhiệm vụ của bạn:
    1. Sử dụng Google Search để tìm kiếm thông tin chi tiết về sản phẩm này.
    
    QUY TẮC NHẬN DIỆN SẢN PHẨM (CỰC KỲ QUAN TRỌNG):
    - Nếu là hình ảnh, hãy phân tích cực kỳ chi tiết các đặc điểm nhận dạng (logo, model number, kiểu dáng nút bấm, màu sắc đặc trưng).
    - KHÔNG ĐƯỢC trả về kết quả kiểu "Model A hoặc Model B". Bạn phải xác định CHÍNH XÁC 1 model duy nhất.
    - Nếu sau khi tìm kiếm và phân tích, bạn vẫn thấy có nhiều model quá giống nhau và không thể khẳng định chắc chắn 100% chỉ qua ảnh, hãy đặt "isAmbiguous" là true và liệt kê các model khả thi vào mảng "possibleModels" (tối đa 5 lựa chọn). Mỗi lựa chọn gồm tên model và mô tả ngắn gọn điểm khác biệt.
    - Chỉ khi bạn chắc chắn 100% hoặc người dùng đã cung cấp tên model cụ thể, bạn mới tiến hành bước 2, 3, 4.

    2. Phân loại sản phẩm: 'physical' (vật lý) hoặc 'digital' (số - khóa học, phần mềm, v.v.).
    3. Trích xuất thông tin: Tên chính xác, Thể loại, Đối tượng khách hàng, USP (Unique Selling Point), và các trụ cột chính (Main Pillars).
    4. Gợi ý ít nhất 5 ý tưởng kịch bản video viral (Script Suggestions) để làm Affiliate. Mỗi ý tưởng cần có tiêu đề hấp dẫn, Hook mạnh, mô tả ngắn gọn và gợi ý phong cách video phù hợp nhất (recommendedStyle) từ danh sách: "Siêu thực", "Hoạt hình 3D", "Siêu thực mix 3D", "Anime/Ghibli", "Cyberpunk", "Claymation".
    
    QUAN TRỌNG: 
    - Tuyệt đối không bịa đặt (hallucinate) thông tin.
    - Nếu không tìm thấy bất kỳ thông tin gì tin cậy, hãy đặt trường "notFound" thành true.
    
    Trả về kết quả bằng tiếng Việt dưới dạng JSON.`;

  parts.push({ text: coreInstructions });

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            notFound: { type: Type.BOOLEAN },
            isAmbiguous: { type: Type.BOOLEAN },
            possibleModels: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ["name", "description"]
              }
            },
            productInfo: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["physical", "digital"] },
                name: { type: Type.STRING },
                category: { type: Type.STRING },
                targetAudience: { type: Type.STRING },
                usp: { type: Type.STRING },
                mainPillars: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              }
            },
            scriptSuggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  hook: { type: Type.STRING },
                  description: { type: Type.STRING },
                  recommendedStyle: { type: Type.STRING }
                },
                required: ["id", "title", "hook", "description", "recommendedStyle"]
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text.trim()) as VideoAnalysis;
  } catch (error: any) {
    console.error("Product Analysis Error:", error);
    throw new Error(`Lỗi phân tích sản phẩm: ${error.message}`);
  }
}

export async function generateSuggestionsFromManualInfo(
  productInfo: ProductInfo
): Promise<VideoAnalysis> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Dựa trên thông tin sản phẩm do người dùng cung cấp:
    Tên: ${productInfo.name}
    Loại: ${productInfo.type === 'physical' ? 'Vật lý' : 'Số'}
    Đối tượng: ${productInfo.targetAudience}
    USP: ${productInfo.usp}
    Trụ cột: ${productInfo.mainPillars.join(', ')}

    Nhiệm vụ:
    Gợi ý ít nhất 5 ý tưởng kịch bản video viral (Script Suggestions) để làm Affiliate. Mỗi ý tưởng cần có tiêu đề hấp dẫn, Hook mạnh, mô tả ngắn gọn và gợi ý phong cách video phù hợp nhất (recommendedStyle) từ danh sách: "Siêu thực", "Hoạt hình 3D", "Siêu thực mix 3D", "Anime/Ghibli", "Cyberpunk", "Claymation".
    
    Trả về kết quả bằng tiếng Việt dưới dạng JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scriptSuggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  hook: { type: Type.STRING },
                  description: { type: Type.STRING },
                  recommendedStyle: { type: Type.STRING }
                },
                required: ["id", "title", "hook", "description", "recommendedStyle"]
              }
            }
          },
          required: ["scriptSuggestions"]
        }
      }
    });

    if (!response.text) throw new Error("AI không phản hồi");
    const result = JSON.parse(response.text.trim());
    return {
      productInfo,
      scriptSuggestions: result.scriptSuggestions,
      notFound: false
    };
  } catch (error: any) {
    console.error("Manual Suggestions Error:", error);
    throw new Error(`Lỗi tạo gợi ý: ${error.message}`);
  }
}

export async function generateDetailedScript(
  productInfo: ProductInfo,
  selectedSuggestion: ScriptSuggestion,
  duration: number,
  targetTool: 'veo' | 'sora' | 'grok',
  style: string,
  useCameo: boolean,
  cameoUsername?: string
): Promise<DetailedScript> {
  const model = "gemini-3-flash-preview";
  
  const toolSpecs = {
    veo: "Veo 3 (BẮT BUỘC mỗi cảnh phải là 8s)",
    sora: "Sora 2 (Tạo 2 bản: Bản 1 mỗi cảnh 10s, Bản 2 mỗi cảnh 15s)",
    grok: "Grok (BẮT BUỘC mỗi cảnh phải là 6s)"
  };

  const prompt = `
    Dựa trên thông tin sản phẩm: ${JSON.stringify(productInfo)}
    Và ý tưởng kịch bản đã chọn: ${JSON.stringify(selectedSuggestion)}
    Thời lượng video tổng cộng mong muốn: ${duration} giây.
    Công cụ AI tạo video: ${toolSpecs[targetTool]}.
    Phong cách video yêu cầu: ${style}.
    Sử dụng tính năng Cameo (Sora 2): ${useCameo ? `CÓ (Sử dụng username: @${cameoUsername || 'usernamecameo'} trong prompt nếu có người)` : "KHÔNG"}.

    Nhiệm vụ:
    1. Phân tích và xác định các "Tài sản hình ảnh cố định" (Visual Assets):
       - Nhân vật cố định: Ai là người dẫn dắt? Ngoại hình, trang phục nhất quán.
       - Sản phẩm cố định: Cách sản phẩm xuất hiện nhất quán.
       - Tạo prompt hình ảnh (imagePrompt) để người dùng có thể tạo ra các asset này trước.
    
    2. Viết một kịch bản tổng thể (overallScript) hoàn chỉnh, chuyên nghiệp. PHẢI bao gồm lời thoại (Voiceover) chi tiết.

    3. Chia kịch bản thành các phân cảnh chi tiết tuân thủ CHẶT CHẼ quy tắc thời lượng và PHONG CÁCH ${style.toUpperCase()}:
       - Nếu phong cách là "Hoạt hình 3D": Ưu tiên nhân cách hóa sản phẩm (có tay chân, biết nói).
       - Nếu phong cách là "Siêu thực mix 3D": Nhân vật là 3D, sản phẩm và bối cảnh là tả thực.
       - Nếu là Veo 3: Mỗi cảnh PHẢI là 8s.
       - Nếu là Grok: Mỗi cảnh PHẢI là 6s.
       - Nếu là Sora 2: Tạo kịch bản cho 2 phiên bản (10s và 15s).
       - QUAN TRỌNG: Nếu sử dụng Cameo và là Sora 2, bất kỳ cảnh nào có người PHẢI bao gồm tag @${cameoUsername || 'usernamecameo'} trong prompt.
       - QUY TẮC PROMPT CAMEO: Tuyệt đối KHÔNG mô tả độ tuổi, ngoại hình (để tránh biến dạng khuôn mặt). CHỈ mô tả cảm xúc, trang phục, phụ kiện, hành động.

    4. QUY TẮC PHÂN CẢNH: Thiết kế theo hướng "mở rộng" (extension). Kết thúc cảnh trước là điểm bắt đầu logic của cảnh sau.
    
    5. Mỗi phân cảnh phải có:
       - timestamp: Thời gian bắt đầu.
       - description: Mô tả nội dung cảnh (Bao gồm lời thoại/VO cụ thể).
       - visualDetail: Chi tiết hình ảnh tuân thủ phong cách ${style}.
       - imagePrompt: Prompt tiếng Anh cho Midjourney/Stable Diffusion.
       - fullVideoPrompt: Prompt tiếng Anh hoàn chỉnh (Camera, Visual, Style, Music, SFX). PHẢI bao gồm lời thoại (Dialogue/Voiceover) trong prompt video.
    
    Trả về kết quả JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            overallScript: { type: Type.STRING },
            suggestedDuration: { type: Type.NUMBER },
            recommendedStyle: { type: Type.STRING },
            visualAssets: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["character", "product"] },
                  description: { type: Type.STRING },
                  imagePrompt: { type: Type.STRING }
                },
                required: ["name", "type", "description", "imagePrompt"]
              }
            },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.STRING },
                  description: { type: Type.STRING },
                  visualDetail: { type: Type.STRING },
                  imagePrompt: { type: Type.STRING },
                  fullVideoPrompt: { type: Type.STRING }
                },
                required: ["timestamp", "description", "visualDetail", "imagePrompt", "fullVideoPrompt"]
              }
            },
            sora15sScenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.STRING },
                  description: { type: Type.STRING },
                  visualDetail: { type: Type.STRING },
                  imagePrompt: { type: Type.STRING },
                  fullVideoPrompt: { type: Type.STRING }
                },
                required: ["timestamp", "description", "visualDetail", "imagePrompt", "fullVideoPrompt"]
              }
            }
          },
          required: ["title", "overallScript", "suggestedDuration", "visualAssets", "scenes"]
        }
      }
    });

    if (!response.text) throw new Error("AI không phản hồi");
    return JSON.parse(response.text.trim()) as DetailedScript;
  } catch (error: any) {
    console.error("Detailed Script Error:", error);
    throw new Error(`Lỗi tạo kịch bản chi tiết: ${error.message}`);
  }
}

export async function generateImage(prompt: string, referenceImage?: string): Promise<string> {
  const model = "gemini-2.5-flash-image";
  
  const contents: any = {
    parts: [{ text: prompt }]
  };

  if (referenceImage) {
    contents.parts.unshift({
      inlineData: {
        data: referenceImage,
        mimeType: "image/png"
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: {
        imageConfig: {
          aspectRatio: "9:16"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Không nhận được hình ảnh từ AI");
  } catch (error: any) {
    console.error("Image Generation Error:", error);
    throw new Error(`Lỗi tạo hình ảnh: ${error.message}`);
  }
}

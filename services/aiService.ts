
import { GoogleGenAI, Type } from "@google/genai";
import { SoraScript, AIEngine } from "../types";

const SYSTEM_PROMPT = (count: number, duration: string, prompt: string) => `請扮演全球頂尖的 AI 導演，根據以下構思編寫 ${count} 個針對 Sora 2 高速影片生成引擎優化的專業劇本： "${prompt}"。
影片預計時長：${duration}。

每個劇本必須嚴格包含以下內容，並以純繁體中文輸出：
1. title: 震撼的電影片名。
2. concept: 核心創意描述。
3. visualPrompt: 【最重要】Sora 2 專用英文視覺提示詞。請詳細描述光影、鏡頭角度、物理模擬（流體、煙霧、爆破）、材質細節（4K/8K 質感）。
4. videoDescription: 適合 YouTube 或 IG 的吸引人介紹文字。
5. videoTags: 5-10 個熱門標籤。
6. cameraMovement: 詳細運鏡指令。
7. sceneDetails: 包含 setting (環境), lighting (光影), atmosphere (氛圍) 的對象。`;

const JSON_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      title: { type: Type.STRING },
      concept: { type: Type.STRING },
      visualPrompt: { type: Type.STRING },
      videoDescription: { type: Type.STRING },
      videoTags: { type: Type.ARRAY, items: { type: Type.STRING } },
      sceneDetails: {
        type: Type.OBJECT,
        properties: {
          setting: { type: Type.STRING },
          lighting: { type: Type.STRING },
          atmosphere: { type: Type.STRING },
        },
        required: ["setting", "lighting", "atmosphere"],
      },
      cameraMovement: { type: Type.STRING },
      durationEstimate: { type: Type.STRING },
      notes: { type: Type.STRING },
    },
    required: ["title", "concept", "visualPrompt", "videoDescription", "videoTags", "sceneDetails", "cameraMovement", "durationEstimate"],
  },
};

const cleanJson = (text: string): string => {
  return text.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
};

// 輔助函式：使用指定的 Key 嘗試生成
const tryGenerateWithGemini = async (apiKey: string, prompt: string, count: number, duration: string) => {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: SYSTEM_PROMPT(count, duration, prompt),
      config: {
        responseMimeType: "application/json",
        responseSchema: JSON_SCHEMA,
      },
    });
    return response;
};

export const refineVisualPrompt = async (concept: string, geminiKeys?: string[]): Promise<string> => {
    const keysToTry = (geminiKeys && geminiKeys.length > 0) ? geminiKeys : [process.env.API_KEY || ''];
    const prompt = `You are a Sora 2 Prompt Engineer. Convert the following Chinese video concept into a high-fidelity, photorealistic English visual prompt for Sora 2. Focus on lighting, texture, camera movement, and physics. Output ONLY the English prompt text, no markdown.

Concept: "${concept}"`;

    for (const apiKey of keysToTry) {
        if (!apiKey) continue;
        try {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: prompt,
            });
            return response.text || "";
        } catch (e) {
            console.warn("Prompt refinement failed with key, trying next...", e);
        }
    }
    throw new Error("無法更新 Prompt：所有 API Key 皆失效。");
};

export const generateSoraScripts = async (
  engine: AIEngine,
  prompt: string,
  count: number,
  duration: string,
  openAiKey?: string,
  geminiKeys?: string[]
): Promise<SoraScript[]> => {
  if (engine === 'gemini') {
    // 優先使用傳入的 Keys，如果沒有則嘗試環境變數 (fallback)
    const keysToTry = (geminiKeys && geminiKeys.length > 0) ? geminiKeys : [process.env.API_KEY || ''];
    
    let lastError = null;

    // 自動輪替機制
    for (const apiKey of keysToTry) {
        if (!apiKey) continue;
        try {
            console.log(`嘗試使用 Gemini Key: ${apiKey.substring(0, 5)}...`);
            const response = await tryGenerateWithGemini(apiKey, prompt, count, duration);
            
            const cleanedText = cleanJson(response.text || "");
            const data = JSON.parse(cleanedText);
            return data.map((s: any, i: number) => ({ ...s, id: s.id || `gm-${Date.now()}-${i}`, status: 'idle' }));
        } catch (e: any) {
            console.warn(`Gemini Key ${apiKey.substring(0, 5)}... 失敗:`, e);
            lastError = e;
            // 繼續迴圈嘗試下一個 Key
        }
    }
    
    // 如果全部失敗
    console.error("所有 Gemini Keys 皆嘗試失敗");
    throw new Error(lastError?.message || "所有 Gemini API Key 皆無法使用或額度已滿。");

  } else {
    if (!openAiKey) throw new Error("尚未設定 OpenAI API Key");
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "你是一個專業的電影腳本 AI。請務必確保回傳 JSON 中每個視覺提示詞 (visualPrompt) 都充滿細節。輸出格式必須符合要求。" },
          { role: "user", content: SYSTEM_PROMPT(count, duration, prompt) }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `OpenAI 請求失敗`);
    }

    const result = await response.json();
    let content;
    try {
      const rawContent = result.choices[0].message.content;
      content = JSON.parse(cleanJson(rawContent));
    } catch (e) {
      throw new Error("AI 回傳格式錯誤 (JSON Parse Error)");
    }

    const data = Array.isArray(content) ? content : (content.scripts || content.data || Object.values(content)[0]);
    if (!Array.isArray(data)) throw new Error("回傳格式非列表");
    
    return data.map((s: any, idx: number) => ({
      ...s,
      id: s.id || `oa-${Date.now()}-${idx}`,
      visualPrompt: s.visualPrompt || s.soraPrompt || s.prompt || "",
      status: 'idle'
    }));
  }
};

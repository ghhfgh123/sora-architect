
export type AIEngine = 'gemini' | 'openai';

export interface SoraScript {
  id: string;
  title: string;
  concept: string;
  visualPrompt: string;
  videoDescription: string;
  videoTags: string[];
  sceneDetails: {
    setting: string;
    lighting: string;
    atmosphere: string;
  };
  cameraMovement: string;
  durationEstimate: string;
  notes: string;
  // UI 狀態
  status?: 'idle' | 'processing' | 'completed' | 'error' | 'monitoring';
  videoUrl?: string;
  progressLog?: string;
  startTime?: number; // 用於計算經過時間
  
  // YouTube 發布相關
  uploadStatus?: 'idle' | 'uploading' | 'success' | 'failed';
  youtubeId?: string;
  publishTime?: string; // ISO String
}

export interface ApiKeys {
  soraCurls: string[];        // 改為陣列：多組 Sora cURL
  activeSoraCurlIndex: number; // 目前選用的 Sora cURL 索引
  
  youtubeKeys: string[];      // 改為陣列：多組 YouTube Access Token
  geminiKeys: string[];       // 改為陣列：多組 Gemini API Key
  
  openAiKey: string;          // 維持單一 (或是您想改成多組也可以，目前先維持)
  useSimulation?: boolean; 
}

export type AppTab = 'generator' | 'results' | 'publisher';

export enum GenerationStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

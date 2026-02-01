
import { GoogleGenAI, Modality } from "@google/genai";
import { GroundingSource, SourceScope, VoiceGender, LegalMethod } from "../types";

// Using Gemini 3 Pro for superior reasoning and tool calling reliability
const TEXT_MODEL = 'gemini-3-pro-preview';
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

export const generateAIResponse = async (
  prompt: string,
  base64Images: string[] = [],
  legalMethod: LegalMethod = 'NONE',
  scope: SourceScope = 'GLOBAL'
): Promise<{ text: string; sources: GroundingSource[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const parts: any[] = [{ text: prompt }];
  
  // Add multimodal support if images are provided
  base64Images.forEach((img) => {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: img.split(',')[1] || img
      }
    });
  });

  const methodInstruction = legalMethod !== 'NONE' 
    ? `Apply the ${legalMethod} methodology to your reasoning.`
    : "Provide a detailed, well-structured response.";

  const systemInstruction = `You are OmniSearch AI, a high-intelligence research assistant.
    CRITICAL: For every query, ALWAYS use the 'googleSearch' tool to verify facts, check recent events, and cite sources.
    JURISDICTION FOCUS: ${scope === 'NIGERIA' ? 'Nigeria (Constitution and Laws)' : 'Global/International'}.
    ${methodInstruction}
    Always provide factual citations and link to sources.`;

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: { parts },
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    });

    const sources: GroundingSource[] = [];
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    
    // Extracting grounding chunks for display
    if (groundingMetadata?.groundingChunks) {
      groundingMetadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({ 
            title: chunk.web.title || "Search Reference", 
            uri: chunk.web.uri 
          });
        }
      });
    }

    return { 
      text: response.text || "I was unable to find specific information for this query.", 
      sources 
    };
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    // Graceful error message
    return { 
      text: `Investigation Error: ${error.message || "The AI encountered a search failure. Please ensure your API key is correctly configured in your environment."}`, 
      sources: [] 
    };
  }
};

export const generateSpeech = async (text: string, voiceGender: VoiceGender): Promise<Uint8Array | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const voiceName = voiceGender === 'FEMALE' ? 'Kore' : 'Fenrir';
  try {
    // Clean markdown and URLs for natural speech
    const cleanText = text
      .replace(/[#*_`~>]/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim()
      .slice(0, 4000);
    
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { 
          voiceConfig: { 
            prebuiltVoiceConfig: { voiceName } 
          } 
        },
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData?.data);
    return audioPart?.inlineData?.data ? decode(audioPart.inlineData.data) : null;
  } catch (error) { 
    console.error("Speech Synthesis Error:", error);
    return null; 
  }
};

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64.replace(/\s/g, ''));
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const frameCount = data.byteLength / 2 / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      const byteOffset = (i * numChannels + channel) * 2;
      const sample = view.getInt16(byteOffset, true);
      channelData[i] = sample / 32768.0;
    }
  }
  return buffer;
}

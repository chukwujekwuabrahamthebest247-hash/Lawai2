import { GroundingSource, SourceScope, VoiceGender, LegalMethod } from "../types";

/**
 * Calls your internal Vercel Proxy to avoid CORS and hide API keys.
 */
export const generateAIResponse = async (
  prompt: string,
  base64Images: string[] = [],
  legalMethod: LegalMethod = 'NONE',
  scope: SourceScope = 'NIGERIA'
): Promise<{ text: string; sources: GroundingSource[] }> => {

  try {
    const response = await fetch("/api/legal-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, scope })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Server Connection Failed");
    }

    return await response.json();

  } catch (error: any) {
    console.error("Frontend Error:", error);
    return { 
      text: `System Error: ${error.message}. Ensure API keys are set in Vercel.`, 
      sources: [] 
    };
  }
};

/**
 * Native Browser Speech - No API Key required
 */
export const generateSpeech = async (text: string, voiceGender: VoiceGender): Promise<Uint8Array | null> => {
  if (!('speechSynthesis' in window)) return null;
  
  window.speechSynthesis.cancel();
  const cleanText = text.replace(/[#*_`~>]/g, '').replace(/\[.*?\]\(.*?\)/g, '').trim();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find(v => v.lang.includes('en') && 
    (voiceGender === 'MALE' ? v.name.toLowerCase().includes('male') : v.name.toLowerCase().includes('female')));
  
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);

  return new Uint8Array(0); // Dummy return for type compatibility
};

// Required for App.tsx build
export async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
  return ctx.createBuffer(1, 1, 44100);
}

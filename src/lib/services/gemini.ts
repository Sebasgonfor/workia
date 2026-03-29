import { GoogleGenerativeAI } from "@google/generative-ai";

export function getGeminiClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("API key de Gemini no configurada");
  return new GoogleGenerativeAI(apiKey);
}

export function getFlashModel() {
  return getGeminiClient().getGenerativeModel({ model: "gemini-2.0-flash" });
}

export function getFlashJsonModel() {
  return getGeminiClient().getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" },
  });
}

import { GoogleGenAI } from "@google/genai";
import { buildStrategicPrompt, generateLocalStrategicReport, StrategicAnalysisPayload } from "../src/lib/strategicReportGenerator";

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const payload: StrategicAnalysisPayload = req.body || {};

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    // Generate high-fidelity deterministic analytical report if API key is not yet set in Vercel
    const fallbackReport = generateLocalStrategicReport(payload);
    return res.status(200).json({
      report: fallbackReport,
      source: "analytical_engine",
      notice: "Generated via Strategic Analysis Engine. Add GEMINI_API_KEY to your Vercel Environment Variables to activate live Gemini AI reporting."
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build-vercel"
        }
      }
    });

    const prompt = buildStrategicPrompt(payload);

    // Use gemini-2.5-flash for speed and reliability, with fallback to local engine
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return res.status(200).json({
      report: response.text,
      source: "gemini-2.5-flash"
    });
  } catch (error: any) {
    console.warn("Gemini generation failed on Vercel function, falling back to analytical engine:", error?.message);
    const fallbackReport = generateLocalStrategicReport(payload);
    return res.status(200).json({
      report: fallbackReport,
      source: "analytical_engine_fallback",
      error: error?.message
    });
  }
}

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured." });
  }

  try {
    const { messages } = req.body || {};

    if (!messages?.[0]?.content || !Array.isArray(messages[0].content)) {
      return res.status(400).json({ error: "Invalid request body." });
    }

    const userContent = messages[0].content;

    // Convert your existing frontend payload into Gemini parts
    const parts = userContent.map((item) => {
      if (item.type === "text") {
        return { text: item.text };
      }

      if (item.type === "image") {
        return {
          inlineData: {
            mimeType: item.source.media_type,
            data: item.source.data, // raw base64 only
          },
        };
      }

      return null;
    }).filter(Boolean);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      config: {
        temperature: 0.1,
      },
    });

    const text = response.text || "{}";

    return res.status(200).json({
      content: [{ type: "text", text }],
    });
  } catch (err) {
    console.error("Gemini proxy error:", err);
    return res.status(500).json({
      error: err.message || "Gemini request failed",
    });
  }
}

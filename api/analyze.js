export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ROBOFLOW_API_KEY;
  const project = process.env.ROBOFLOW_PROJECT_ID;   // e.g. "signature-area-detection"
  const version = process.env.ROBOFLOW_VERSION;      // e.g. "3"

  if (!apiKey || !project || !version) {
    return res.status(500).json({
      error: "Roboflow env vars not configured. Required: ROBOFLOW_API_KEY, ROBOFLOW_PROJECT_ID, ROBOFLOW_VERSION"
    });
  }

  try {
    const { messages } = req.body || {};

    if (!messages?.length || !Array.isArray(messages[0]?.content)) {
      return res.status(400).json({ error: "Invalid request body. Expected messages[0].content array." });
    }

    // Extract images from your existing frontend payload
    const content = messages[0].content;
    const images = content.filter((item) => item?.type === "image");

    if (!images.length) {
      return res.status(400).json({ error: "No images found in request." });
    }

    // Roboflow object detection endpoint
    // Docs: POST https://detect.roboflow.com/:projectId/:versionNumber?api_key=...
    const baseUrl = `https://detect.roboflow.com/${encodeURIComponent(project)}/${encodeURIComponent(version)}?api_key=${encodeURIComponent(apiKey)}&format=json&confidence=40&overlap=30`;

    const locations = [];

    for (let pageIndex = 0; pageIndex < images.length; pageIndex++) {
      const item = images[pageIndex];

      const mediaType = item?.source?.media_type;
      const base64Data = item?.source?.data;

      if (!mediaType || !base64Data) continue;

      // Roboflow expects raw base64 string in the POST body for legacy object detection
      const rfRes = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: base64Data
      });

      const rfData = await rfRes.json();

      if (!rfRes.ok) {
        return res.status(rfRes.status).json({
          error: rfData?.error || rfData || "Roboflow inference failed"
        });
      }

      const imgW = rfData?.image?.width;
      const imgH = rfData?.image?.height;
      const predictions = Array.isArray(rfData?.predictions) ? rfData.predictions : [];

      for (const pred of predictions) {
        // Optional: keep only the class you trained for
        if (pred.class !== "signature_area" && pred.class !== "signature") continue;

        // Roboflow returns center-based boxes:
        // x,y = center; width,height = box size
        const x1 = pred.x - pred.width / 2;
        const y1 = pred.y - pred.height / 2;

        locations.push({
          page_index: pageIndex,
          description: `${pred.class} detected on page ${pageIndex + 1} (${Math.round((pred.confidence || 0) * 100)}% confidence)`,
          x_percent: imgW ? x1 / imgW : 0,
          y_percent: imgH ? y1 / imgH : 0,
          width_percent: imgW ? pred.width / imgW : 0,
          height_percent: imgH ? pred.height / imgH : 0
        });
      }
    }

    const result = {
      found: locations.length > 0,
      locations,
      reasoning: locations.length
        ? `Roboflow detected ${locations.length} signature area(s) across ${images.length} page(s).`
        : "Roboflow did not detect any signature areas."
    };

    // Return the same shape your frontend already parses:
    return res.status(200).json({
      content: [
        {
          type: "text",
          text: JSON.stringify(result)
        }
      ]
    });
  } catch (err) {
    console.error("Roboflow proxy error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

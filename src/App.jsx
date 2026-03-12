import { useState, useRef, useCallback, useEffect } from "react";

function useScript(src) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (document.querySelector(`script[src="${src}"]`)) {
      setLoaded(true);
      return;
    }

    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => setLoaded(true);
    document.head.appendChild(s);
  }, [src]);

  return loaded;
}

const fmt = (b) =>
  b < 1048576
    ? (b / 1024).toFixed(1) + " KB"
    : (b / 1048576).toFixed(1) + " MB";

const uid = () => `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const G = {
  bg: "#0b0c10",
  surface: "#13151a",
  surface2: "#1c1f28",
  border: "rgba(255,255,255,0.07)",
  border2: "rgba(255,255,255,0.13)",
  accent: "#7c6af7",
  accent2: "#a78bfa",
  gold: "#f0c060",
  green: "#34d399",
  red: "#f87171",
  text: "#e8e6f0",
  muted: "#6b7080",
  muted2: "#9096a8",
};

const AI_PROMPT = `You are analyzing document page images to find ALL locations where a signature should be placed.

GOAL:
Determine the signature box by COMPUTING it from the full page measurements and the positions of:
1. a label/closing text
2. the printed name below it

VALID LABELS / CLOSINGS:
- Regards,
- Sincerely,
- Best regards,
- Respectfully,
- Very truly yours,
- Yours truly,
- Approved By:
- Prepared By:
- Noted By:
- Authorized By:
- Submitted By:
- Certified By:
- For Approval:

STRICT COMPUTATION RULES:
1. First, treat the FULL PAGE IMAGE as the measurement reference.
   - Determine the full page width and full page height from the image itself.
2. Identify the label/closing text and the printed name below it on the same signing block.
3. Measure the BLANK SIGNING REGION between:
   - the lower edge of the label/closing text
   - and the upper region of the printed name
4. Compute the signature box from that measured region.
5. The signature box MUST be horizontally centered on the printed name.
6. The width of the signature box should be based on the name width:
   - generally close to the name width
   - may be slightly wider than the name
   - but the center of the box must align with the center of the printed name
7. The height of the signature box should come from the measured blank area between label and name.
8. If the blank area is small, still compute the box from that same region and allow the lower part of the box to slightly overlap the printed name.
9. Do NOT invent a random page position. Use only the measured label-name block.
10. If multiple valid signing blocks exist, return all of them.

OUTPUT FORMAT:
- Return percentages relative to the FULL PAGE IMAGE.
- x_percent, y_percent, width_percent, height_percent must all be based on the full image width/height.
- y_percent is TOP-BASED from the top edge of the page image.
- The returned rectangle must represent the actual signature area computed from the full page measurements.

Return ONLY valid JSON:
{"found":true,"locations":[{"page_index":0,"description":"Computed signature area between APPROVED BY and printed name","x_percent":0.10,"y_percent":0.18,"width_percent":0.34,"height_percent":0.09}],"reasoning":"Measured full page, identified label-name pair, computed blank signing area, centered box on printed name."}

If nothing is found:
{"found":false,"locations":[],"reasoning":"No valid label-name pair found."}`;

function parseAIResponse(raw) {
  if (!raw) {
    return { found: false, locations: [], reasoning: "Empty response." };
  }

  const cleaned = raw.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch (_) {}
  }

  return {
    found: false,
    locations: [],
    reasoning: "Could not parse AI response.",
  };
}

function normalizeText(s = "") {
  return s.replace(/\s+/g, " ").trim();
}

function getTextItemBox(item) {
  const tx = item.transform || [];
  const x = tx[4] || 0;
  const y = tx[5] || 0;
  const width = item.width || 0;
  const height = Math.abs(tx[3] || item.height || 12) || 12;
  return { x, y, width, height };
}

function isClosingText(s) {
  const t = normalizeText(s).toLowerCase();
  return [
    "sincerely,",
    "regards,",
    "best regards,",
    "respectfully,",
    "very truly yours,",
    "yours truly,",
    "approved by:",
    "approved by",
    "noted by:",
    "noted by",
    "prepared by:",
    "prepared by",
    "authorized by:",
    "authorized by",
    "submitted by:",
    "submitted by",
    "certified by:",
    "certified by",
    "for approval:",
    "for approval",
  ].includes(t);
}

function looksLikeNameLine(s) {
  const t = normalizeText(s);
  if (!t) return false;
  if (t.length < 5 || t.length > 70) return false;
  if (/[0-9]/.test(t)) return false;
  if (/[,:;]/.test(t)) return false;

  const words = t.split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 6) return false;

  const upperish = words.filter(
    (w) => /^[A-Z][A-Za-z.'-]*$/.test(w) || /^[A-Z]+$/.test(w)
  ).length;

  return upperish >= Math.max(2, words.length - 1);
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function normalizeLocation(loc, pageInfos) {
  const pi = pageInfos[loc.page_index] || pageInfos[0];
  if (!pi) return null;

  const x = clamp01(loc.x_percent ?? 0);
  const y = clamp01(loc.y_percent ?? 0);
  const w = clamp01(loc.width_percent ?? 0);
  const h = clamp01(loc.height_percent ?? 0);

  if (w <= 0 || h <= 0) return null;

  return {
    ...loc,
    x_percent: x,
    y_percent: y,
    width_percent: w,
    height_percent: h,
    pageInfo: pi,
  };
}

function computeMeasuredFallbackFromText(doc) {
  if (!doc.pageInfos?.length) return null;

  const pages = [...doc.pageInfos].sort((a, b) => b.pageNum - a.pageNum);

  for (const pi of pages) {
    const items = (pi.textItems || [])
      .map((it) => ({
        ...it,
        str: normalizeText(it.str || ""),
        box: getTextItemBox(it),
      }))
      .filter((it) => it.str);

    if (!items.length) continue;

    const labels = items.filter((it) => isClosingText(it.str));
    if (!labels.length) continue;

    for (const label of labels) {
      const lb = label.box;
      const labelCenterX = lb.x + lb.width / 2;

      const nameCandidates = items
        .filter((it) => {
          if (it === label) return false;
          if (!looksLikeNameLine(it.str)) return false;

          const b = it.box;
          const belowLabel = b.y < lb.y - 4;
          const withinVerticalRange = b.y > lb.y - 230;

          const nameCenterX = b.x + b.width / 2;
          const alignedEnough = Math.abs(nameCenterX - labelCenterX) < 180;

          return belowLabel && withinVerticalRange && alignedEnough;
        })
        .sort((a, b) => Math.abs(lb.y - a.box.y) - Math.abs(lb.y - b.box.y));

      const name = nameCandidates[0];
      if (!name) continue;

      const nb = name.box;

      const labelBottomTopBased = pi.height - lb.y;
      const nameTopTopBased = pi.height - (nb.y + nb.height);

      const blankTop = Math.max(labelBottomTopBased + 4, 0);
      const blankBottom = Math.min(nameTopTopBased + nb.height * 0.45, pi.height);

      let boxTop = blankTop;
      let boxBottom = blankBottom;

      let boxHeight = boxBottom - boxTop;
      if (boxHeight < 24) {
        boxHeight = 38;
        boxBottom = Math.min(nameTopTopBased + nb.height * 0.55, pi.height);
        boxTop = Math.max(boxBottom - boxHeight, blankTop);
      }

      boxHeight = boxBottom - boxTop;
      if (boxHeight < 18) continue;

      const nameCenterX = nb.x + nb.width / 2;
      const boxWidth = Math.max(nb.width * 1.08, 130);
      let boxLeft = nameCenterX - boxWidth / 2;

      if (boxLeft < 0) boxLeft = 0;
      if (boxLeft + boxWidth > pi.width) boxLeft = Math.max(pi.width - boxWidth, 0);

      const result = {
        found: true,
        locations: [
          {
            page_index: pi.pageNum - 1,
            description: `Computed signature area between "${label.str}" and "${name.str}"`,
            x_percent: clamp01(boxLeft / pi.width),
            y_percent: clamp01(boxTop / pi.height),
            width_percent: clamp01(boxWidth / pi.width),
            height_percent: clamp01(boxHeight / pi.height),
            pageInfo: pi,
          },
        ],
        reasoning: `Measured full page, identified label-name pair, computed blank signing area, centered box on printed name "${name.str}".`,
      };

      return result;
    }
  }

  return null;
}

export default function SignDesk() {
  const pdfJsLoaded = useScript(
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
  );
  const pdfLibLoaded = useScript(
    "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"
  );

  const [sig, setSig] = useState(null);
  const [docs, setDocs] = useState([]);
  const [toast, setToast] = useState(null);
  const toastRef = useRef(null);

  useEffect(() => {
    if (pdfJsLoaded && window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
  }, [pdfJsLoaded]);

  const showToast = useCallback((msg, type = "info") => {
    setToast({ msg, type });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const onSigUpload = (e) => {
    const f = e.target.files[0];
    if (!f) return;

    const r = new FileReader();
    r.onload = (ev) => {
      setSig({ dataUrl: ev.target.result, name: f.name });
      showToast("Signature loaded!", "success");
    };
    r.readAsDataURL(f);
    e.target.value = "";
  };

  const onDocsUpload = (e) => {
    const files = Array.from(e.target.files).filter(
      (f) => f.type === "application/pdf"
    );

    if (!files.length) {
      showToast("Please upload PDF files.", "error");
      return;
    }

    const newDocs = files.map((f) => ({
      id: uid(),
      file: f,
      name: f.name,
      size: f.size,
      status: "pending",
      aiResult: null,
      pageInfos: null,
      signedBlob: null,
      open: false,
      previewRendered: false,
    }));

    setDocs((prev) => [...newDocs.reverse(), ...prev]);
    showToast(
      `${files.length} document${files.length > 1 ? "s" : ""} added.`,
      "success"
    );
    e.target.value = "";
  };

  const updateDoc = useCallback((id, patch) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  const renderAndAnalyze = useCallback(
    async (doc) => {
      if (doc.previewRendered) return;

      if (!window.pdfjsLib) {
        showToast("PDF renderer not ready, try again.", "error");
        return;
      }

      updateDoc(doc.id, { previewRendered: true, status: "analyzing" });

      try {
        const bytes = await doc.file.arrayBuffer();
        const pdfJs = await window.pdfjsLib
          .getDocument({ data: new Uint8Array(bytes) })
          .promise;

        const pageInfos = [];

        for (let p = 1; p <= Math.min(pdfJs.numPages, 8); p++) {
          const page = await pdfJs.getPage(p);
          const vp = page.getViewport({ scale: 1.5 });

          const canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;

          await page.render({
            canvasContext: canvas.getContext("2d"),
            viewport: vp,
          }).promise;

          let textItems = [];
          try {
            const textContent = await page.getTextContent();
            textItems = (textContent.items || []).map((it) => ({
              str: it.str,
              width: it.width,
              height: it.height,
              transform: it.transform,
            }));
          } catch (_) {}

          pageInfos.push({
            pageNum: p,
            canvas,
            width: vp.width,
            height: vp.height,
            textItems,
          });
        }

        updateDoc(doc.id, { pageInfos, status: "pending" });

        const imageContents = pageInfos.map((pi) => ({
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: pi.canvas.toDataURL("image/jpeg", 0.92).split(",")[1],
          },
        }));

        const pageMeasurementNote = pageInfos
          .map(
            (p, i) =>
              `image index ${i} = page ${p.pageNum}, image width ${Math.round(
                p.width
              )}, image height ${Math.round(p.height)}`
          )
          .join("; ");

        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4000,
            messages: [
              {
                role: "user",
                content: [
                  ...imageContents,
                  {
                    type: "text",
                    text:
                      `This document has ${pageInfos.length} page(s).\n` +
                      `Use each full page image as the measurement reference.\n` +
                      `Image-page measurements: ${pageMeasurementNote}.\n\n` +
                      `Compute the signature area from the full page measurements, blank space between label and name, and horizontal center of the printed name.\n\n` +
                      `${AI_PROMPT}`,
                  },
                ],
              },
            ],
          }),
        });

        const rawBody = await res.text();

        let data;
        try {
          data = JSON.parse(rawBody);
        } catch (_) {
          throw new Error(`Server returned non-JSON: ${rawBody.slice(0, 200)}`);
        }

        if (data.error) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : data.error.message || JSON.stringify(data.error)
          );
        }

        const raw = data.content?.find((c) => c.type === "text")?.text || "{}";
        let aiResult = parseAIResponse(raw);

        if (!aiResult?.found || !aiResult.locations?.length) {
          const fallbackResult = computeMeasuredFallbackFromText({ pageInfos });
          if (fallbackResult) aiResult = fallbackResult;
        }

        if (aiResult?.found && aiResult.locations?.length) {
          aiResult.locations = aiResult.locations
            .map((loc) => normalizeLocation(loc, pageInfos))
            .filter(Boolean);
        }

        if (!aiResult?.locations?.length) {
          aiResult = {
            found: false,
            locations: [],
            reasoning: aiResult?.reasoning || "No valid signature location found.",
          };
        }

        updateDoc(doc.id, { aiResult });
      } catch (err) {
        console.error("AI/render error:", err);

        const fallbackResult = computeMeasuredFallbackFromText({
          pageInfos: doc.pageInfos || [],
        });

        if (fallbackResult) {
          updateDoc(doc.id, {
            aiResult: fallbackResult,
            status: "pending",
          });
          showToast("AI analysis failed, using measured fallback.", "info");
          return;
        }

        updateDoc(doc.id, {
          aiResult: {
            found: false,
            locations: [],
            reasoning: `Error: ${err.message}`,
          },
          status: "pending",
        });

        showToast(`AI analysis failed: ${err.message}`, "error");
      }
    },
    [updateDoc, showToast]
  );

  const toggleCard = useCallback(
    (doc) => {
      setDocs((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, open: !d.open } : d))
      );

      if (!doc.open && !doc.previewRendered && doc.status !== "signed") {
        renderAndAnalyze(doc);
      }
    },
    [renderAndAnalyze]
  );

  const handleSign = useCallback(
    async (doc) => {
      if (!sig) {
        showToast("Upload your signature first!", "error");
        return;
      }

      if (!window.PDFLib) {
        showToast("PDF library not ready.", "error");
        return;
      }

      updateDoc(doc.id, { status: "signing" });

      try {
        const pdfBytes = await doc.file.arrayBuffer();
        const pdfDoc = await window.PDFLib.PDFDocument.load(pdfBytes);

        const imgBytes = await fetch(sig.dataUrl).then((r) => r.arrayBuffer());
        const mime =
          (sig.dataUrl.match(/data:(image\/\w+)/) || [])[1] || "image/png";

        const embImg =
          mime.includes("jpeg") || mime.includes("jpg")
            ? await pdfDoc.embedJpg(imgBytes)
            : await pdfDoc.embedPng(imgBytes);

        const pdfPages = pdfDoc.getPages();
        const placements = [];
        const now = new Date().toLocaleString();

        let finalResult = doc.aiResult;

        if (!finalResult?.found || !finalResult.locations?.length) {
          const fallbackResult = computeMeasuredFallbackFromText(doc);
          if (fallbackResult) finalResult = fallbackResult;
        }

        if (finalResult?.found && finalResult.locations?.length) {
          for (const loc of finalResult.locations) {
            const pi = loc.pageInfo || doc.pageInfos?.[loc.page_index];
            if (!pi) continue;

            const targetPage = pdfPages[pi.pageNum - 1];
            if (!targetPage) continue;

            const { width, height } = targetPage.getSize();

            const boxX = loc.x_percent * width;
            const boxYTop = loc.y_percent * height;
            const boxW = loc.width_percent * width;
            const boxH = loc.height_percent * height;
            const boxY = height - boxYTop - boxH;

            placements.push({
              page: targetPage,
              x: boxX,
              y: Math.max(boxY, 0),
              w: boxW,
              h: boxH,
            });
          }
        }

        if (placements.length === 0) {
          throw new Error("No valid detected signature box found.");
        }

        for (const pl of placements) {
          const dims = embImg.scaleToFit(pl.w, pl.h);
          const drawX = pl.x + (pl.w - dims.width) / 2;
          const drawY = pl.y + (pl.h - dims.height) / 2;

          pl.page.drawImage(embImg, {
            x: drawX,
            y: drawY,
            width: dims.width,
            height: dims.height,
            opacity: 0.93,
          });
        }

        pdfPages[pdfPages.length - 1].drawText(`Digitally signed: ${now}`, {
          x: 36,
          y: 18,
          size: 7,
          color: window.PDFLib.rgb(0.5, 0.5, 0.58),
        });

        const signedBytes = await pdfDoc.save();
        const signedBlob = new Blob([signedBytes], { type: "application/pdf" });

        updateDoc(doc.id, {
          status: "signed",
          signedBlob,
          pageInfos: null,
          previewRendered: false,
        });

        showToast(`"${doc.name}" signed successfully!`, "success");
      } catch (err) {
        console.error(err);
        updateDoc(doc.id, { status: "pending" });
        showToast("Signing failed: " + err.message, "error");
      }
    },
    [sig, updateDoc, showToast]
  );

  const handleReject = useCallback(
    (doc) => {
      updateDoc(doc.id, { status: "rejected" });
      showToast(`"${doc.name}" rejected.`, "error");
    },
    [updateDoc, showToast]
  );

  const summary = {
    total: docs.length,
    signed: docs.filter((d) => d.status === "signed").length,
    rej: docs.filter((d) => d.status === "rejected").length,
    pend: docs.filter((d) => ["pending", "analyzing"].includes(d.status)).length,
  };

  const toastColors = {
    info: G.accent2,
    success: G.green,
    error: G.red,
  };

  const toastIcons = {
    info: "◆",
    success: "✓",
    error: "✕",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { min-height: 100vh; background: ${G.bg}; }
        body { font-family: 'Outfit', sans-serif; color: ${G.text}; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${G.border2}; border-radius: 10px; }
        @keyframes pulse {
          0%,100% { opacity:1; transform:scale(1) }
          50% { opacity:.4; transform:scale(.75) }
        }
        @keyframes spin {
          to { transform:rotate(360deg) }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: G.bg,
          color: G.text,
          fontFamily: "'Outfit',sans-serif",
          backgroundImage: `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,106,247,0.13) 0%, transparent 70%),
          radial-gradient(ellipse 40% 30% at 80% 100%, rgba(167,139,250,0.06) 0%, transparent 60%)`,
        }}
      >
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 2rem",
            background: "rgba(11,12,16,0.85)",
            backdropFilter: "blur(18px)",
            borderBottom: `1px solid ${G.border}`,
          }}
        >
          <div
            style={{
              fontFamily: "'Cormorant Garamond',serif",
              fontSize: "1.6rem",
              fontWeight: 700,
            }}
          >
            Sign<span style={{ color: G.accent2 }}>Desk</span>{" "}
            <span
              style={{
                fontSize: ".6em",
                color: G.muted,
                fontFamily: "'Outfit',sans-serif",
                fontWeight: 300,
              }}
            >
              AI
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: ".45rem",
              background: "rgba(124,106,247,0.15)",
              border: "1px solid rgba(124,106,247,0.3)",
              borderRadius: "100px",
              padding: ".28rem .85rem",
              fontSize: ".72rem",
              fontWeight: 600,
              color: G.accent2,
              letterSpacing: ".06em",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                background: G.accent2,
                borderRadius: "50%",
                animation: "pulse 2s infinite",
                display: "inline-block",
              }}
            />
            AI Measurement · Auto-Compute
          </div>
        </header>

        <main
          style={{
            maxWidth: 1060,
            margin: "0 auto",
            padding: "2.2rem 1.5rem 5rem",
          }}
        >
          <div style={{ marginBottom: "2rem" }}>
            <h1
              style={{
                fontFamily: "'Cormorant Garamond',serif",
                fontSize: "clamp(1.7rem,4vw,2.6rem)",
                fontWeight: 700,
                lineHeight: 1.1,
                marginBottom: ".5rem",
              }}
            >
              Sign documents
              <br />
              <span
                style={{
                  background: `linear-gradient(135deg,${G.accent2},${G.gold})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                by measured placement.
              </span>
            </h1>

            <p
              style={{
                color: G.muted2,
                fontSize: ".92rem",
                maxWidth: 560,
                lineHeight: 1.65,
              }}
            >
              AI measures the full page, computes the blank signing region between
              the label and printed name, and centers the signature box on the
              name width.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1.1rem",
              marginBottom: "2rem",
            }}
          >
            <Panel label="Step 1" title="Your Signature">
              <DropZone
                icon="✍️"
                text={
                  <>
                    Upload your <strong>signature image</strong>
                    <br />
                    PNG with transparent background works best
                  </>
                }
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={onSigUpload}
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0,
                    cursor: "pointer",
                    width: "100%",
                    height: "100%",
                  }}
                />
              </DropZone>

              {sig && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: ".75rem",
                    marginTop: ".9rem",
                    padding: ".7rem",
                    background: G.surface2,
                    border: `1px solid ${G.border2}`,
                    borderRadius: 9,
                  }}
                >
                  <img
                    src={sig.dataUrl}
                    alt="sig"
                    style={{
                      maxHeight: 48,
                      maxWidth: 150,
                      objectFit: "contain",
                      background: "rgba(255,255,255,.05)",
                      borderRadius: 5,
                      padding: 3,
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: ".83rem",
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {sig.name}
                    </div>
                    <div style={{ fontSize: ".71rem", color: G.green }}>
                      ✓ Ready to use
                    </div>
                  </div>

                  <button
                    onClick={() => setSig(null)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: G.muted,
                      fontSize: ".95rem",
                      padding: 3,
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </Panel>

            <Panel label="Step 2" title="Upload Documents">
              <DropZone
                icon="📄"
                text={
                  <>
                    Upload <strong>PDF files</strong> here
                    <br />
                    AI will compute the signature region automatically
                  </>
                }
              >
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={onDocsUpload}
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0,
                    cursor: "pointer",
                    width: "100%",
                    height: "100%",
                  }}
                />
              </DropZone>
            </Panel>
          </div>

          {docs.length > 0 && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "1.1rem",
                }}
              >
                <h2
                  style={{
                    fontFamily: "'Cormorant Garamond',serif",
                    fontSize: "1.35rem",
                  }}
                >
                  Documents to Review
                </h2>

                <span
                  style={{
                    fontSize: ".7rem",
                    fontWeight: 600,
                    background: "rgba(124,106,247,.2)",
                    color: G.accent2,
                    border: "1px solid rgba(124,106,247,.3)",
                    padding: ".22rem .75rem",
                    borderRadius: "100px",
                  }}
                >
                  {docs.length} file{docs.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: ".9rem" }}>
                {docs.map((doc) => (
                  <DocCard
                    key={doc.id}
                    doc={doc}
                    onToggle={() => toggleCard(doc)}
                    onSign={() => handleSign(doc)}
                    onReject={() => handleReject(doc)}
                  />
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "2.2rem",
                  flexWrap: "wrap",
                  background: G.surface,
                  border: `1px solid ${G.border}`,
                  borderRadius: 14,
                  padding: "1.3rem 1.8rem",
                  marginTop: "1.8rem",
                }}
              >
                {[
                  { num: summary.total, lbl: "Total", color: G.text },
                  { num: summary.signed, lbl: "Signed", color: G.green },
                  { num: summary.rej, lbl: "Rejected", color: G.red },
                  { num: summary.pend, lbl: "Pending", color: G.gold },
                ].map((s) => (
                  <div key={s.lbl} style={{ textAlign: "center" }}>
                    <span
                      style={{
                        fontFamily: "'Cormorant Garamond',serif",
                        fontSize: "2rem",
                        fontWeight: 700,
                        display: "block",
                        lineHeight: 1,
                        marginBottom: ".15rem",
                        color: s.color,
                      }}
                    >
                      {s.num}
                    </span>
                    <span
                      style={{
                        fontSize: ".69rem",
                        color: G.muted,
                        textTransform: "uppercase",
                        letterSpacing: ".1em",
                      }}
                    >
                      {s.lbl}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "1.6rem",
            right: "1.6rem",
            zIndex: 999,
            background: G.surface2,
            border: `1px solid ${toastColors[toast.type]}55`,
            color: G.text,
            padding: ".75rem 1.2rem",
            borderRadius: 11,
            fontSize: ".84rem",
            fontWeight: 500,
            boxShadow: "0 10px 40px rgba(0,0,0,.5)",
            display: "flex",
            alignItems: "center",
            gap: ".55rem",
            maxWidth: 340,
          }}
        >
          <span style={{ color: toastColors[toast.type], fontWeight: 700 }}>
            {toastIcons[toast.type]}
          </span>
          {toast.msg}
        </div>
      )}
    </>
  );
}

function Panel({ label, title, children }) {
  return (
    <div
      style={{
        background: G.surface,
        border: `1px solid ${G.border}`,
        borderRadius: 16,
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          fontSize: ".67rem",
          fontWeight: 700,
          letterSpacing: ".16em",
          textTransform: "uppercase",
          color: G.accent2,
          marginBottom: ".4rem",
        }}
      >
        {label}
      </div>

      <h2
        style={{
          fontFamily: "'Cormorant Garamond',serif",
          fontSize: "1.15rem",
          fontWeight: 600,
          marginBottom: ".9rem",
        }}
      >
        {title}
      </h2>

      {children}
    </div>
  );
}

function DropZone({ icon, text, children }) {
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
      }}
      style={{
        border: `1.5px dashed rgba(124,106,247,${over ? ".7" : ".35"})`,
        borderRadius: 11,
        padding: "1.6rem 1rem",
        textAlign: "center",
        cursor: "pointer",
        position: "relative",
        background: over ? "rgba(124,106,247,.07)" : "transparent",
        transition: "all .2s",
      }}
    >
      {children}
      <span style={{ fontSize: "1.9rem", display: "block", marginBottom: ".4rem" }}>
        {icon}
      </span>
      <p style={{ fontSize: ".8rem", color: G.muted, lineHeight: 1.55 }}>{text}</p>
    </div>
  );
}

function DocCard({ doc, onToggle, onSign, onReject }) {
  const canvasRef = useRef(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    if (!doc.open || !doc.pageInfos || !canvasRef.current) return;
    if (renderedRef.current) return;

    renderedRef.current = true;
    const wrap = canvasRef.current;
    wrap.innerHTML = "";

    doc.pageInfos.forEach((pi) => {
      const cont = document.createElement("div");
      cont.style.cssText = `position:relative;display:inline-block;width:${pi.width}px;`;

      const cv2 = document.createElement("canvas");
      cv2.width = pi.width;
      cv2.height = pi.height;
      cv2.style.cssText = "border-radius:3px;max-width:100%;display:block;";
      cv2.getContext("2d").drawImage(pi.canvas, 0, 0);
      cont.appendChild(cv2);

      if (doc.aiResult?.found && doc.aiResult.locations?.length) {
        doc.aiResult.locations
          .filter((loc) => loc.pageInfo?.pageNum === pi.pageNum)
          .forEach((loc) => {
            const ov = document.createElement("div");
            ov.style.cssText = `position:absolute;border:2px solid ${G.green};border-radius:4px;
              pointer-events:none;box-shadow:0 0 14px rgba(52,211,153,.45);
              left:${loc.x_percent * pi.width}px;top:${loc.y_percent * pi.height}px;
              width:${loc.width_percent * pi.width}px;height:${Math.max(
                loc.height_percent * pi.height,
                18
              )}px;`;

            const lbl = document.createElement("div");
            lbl.style.cssText = `position:absolute;top:-19px;left:0;font-size:9px;
              background:${G.green};color:#000;padding:1px 5px;border-radius:3px;
              font-weight:700;white-space:nowrap;font-family:'Outfit',sans-serif;`;

            lbl.textContent = "✦ AI: Computed sign area";
            ov.appendChild(lbl);
            cont.appendChild(ov);
          });
      }

      wrap.appendChild(cont);
    });
  }, [doc.open, doc.pageInfos, doc.aiResult]);

  useEffect(() => {
    if (!doc.open) renderedRef.current = false;
  }, [doc.open]);

  const statusInfo =
    {
      pending: {
        label: "Pending",
        bg: "rgba(107,112,128,.2)",
        color: G.muted2,
      },
      analyzing: {
        label: "Analyzing…",
        bg: "rgba(240,192,96,.15)",
        color: G.gold,
      },
      signing: {
        label: "Signing…",
        bg: "rgba(240,192,96,.15)",
        color: G.gold,
      },
      signed: {
        label: "Signed",
        bg: "rgba(52,211,153,.15)",
        color: G.green,
      },
      rejected: {
        label: "Rejected",
        bg: "rgba(248,113,113,.15)",
        color: G.red,
      },
    }[doc.status] || {
      label: "Pending",
      bg: "rgba(107,112,128,.2)",
      color: G.muted2,
    };

  const isPending = doc.status === "pending";

  return (
    <div
      style={{
        background: G.surface,
        border: `1px solid ${
          doc.status === "signed"
            ? G.green
            : doc.status === "rejected"
            ? G.red
            : G.border
        }`,
        borderLeft:
          doc.status === "signed"
            ? `3px solid ${G.green}`
            : doc.status === "rejected"
            ? `3px solid ${G.red}`
            : "",
        borderRadius: 14,
        overflow: "hidden",
        opacity: doc.status === "rejected" ? 0.6 : 1,
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          padding: ".9rem 1.1rem",
          gap: ".85rem",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            background: G.surface2,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.1rem",
            flexShrink: 0,
          }}
        >
          📄
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: ".9rem",
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {doc.name}
          </div>
          <div style={{ fontSize: ".73rem", color: G.muted }}>{fmt(doc.size)}</div>
        </div>

        <span
          style={{
            fontSize: ".67rem",
            fontWeight: 700,
            letterSpacing: ".09em",
            textTransform: "uppercase",
            padding: ".2rem .65rem",
            borderRadius: "100px",
            flexShrink: 0,
            background: statusInfo.bg,
            color: statusInfo.color,
          }}
        >
          {statusInfo.label}
        </span>

        <span
          style={{
            color: G.muted,
            fontSize: ".8rem",
            marginLeft: ".35rem",
            transition: "transform .25s",
            display: "inline-block",
            transform: doc.open ? "rotate(180deg)" : "",
          }}
        >
          ▾
        </span>
      </div>

      {doc.open && (
        <div
          style={{
            padding: "0 1.1rem 1.1rem",
            borderTop: `1px solid ${G.border}`,
          }}
        >
          <div
            style={{
              margin: "1rem 0",
              padding: ".8rem 1rem",
              background: "rgba(124,106,247,.09)",
              border: "1px solid rgba(124,106,247,.22)",
              borderRadius: 9,
              fontSize: ".81rem",
              lineHeight: 1.55,
              color: G.muted2,
            }}
          >
            {!doc.aiResult && doc.status === "analyzing" && (
              <>
                <strong style={{ color: G.accent2 }}>🤖 AI Analysis</strong> — Measuring full page and computing signature area…
              </>
            )}

            {!doc.aiResult && doc.status !== "analyzing" && (
              <>
                <strong style={{ color: G.accent2 }}>🤖 AI Analysis</strong> — Opening document…
              </>
            )}

            {doc.aiResult?.found && (
              <>
                <strong style={{ color: G.accent2 }}>
                  🤖 AI found {doc.aiResult.locations.length} computed signature location
                  {doc.aiResult.locations.length > 1 ? "s" : ""}
                </strong>

                {doc.aiResult.locations.map((l, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: ".45rem",
                      marginTop: ".4rem",
                    }}
                  >
                    <span
                      style={{
                        color: G.accent,
                        fontSize: ".5rem",
                        marginTop: ".25rem",
                      }}
                    >
                      ◆
                    </span>
                    {l.description}
                  </div>
                ))}

                <div
                  style={{
                    fontSize: ".76rem",
                    color: G.muted,
                    marginTop: ".35rem",
                  }}
                >
                  {doc.aiResult.reasoning}
                </div>
              </>
            )}

            {doc.aiResult && !doc.aiResult.found && (
              <>
                <strong style={{ color: G.accent2 }}>🤖 AI Analysis</strong> — No explicit computed field found.
                {doc.aiResult.reasoning && (
                  <div
                    style={{
                      fontSize: ".76rem",
                      color: G.muted,
                      marginTop: ".3rem",
                    }}
                  >
                    {doc.aiResult.reasoning}
                  </div>
                )}
              </>
            )}
          </div>

          <div
            style={{
              background: "#111320",
              borderRadius: 9,
              overflow: "hidden",
              marginBottom: ".9rem",
              maxHeight: 440,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: 7,
            }}
          >
            {doc.status === "analyzing" && !doc.pageInfos && (
              <div
                style={{
                  padding: "2.5rem",
                  textAlign: "center",
                  color: G.muted,
                  fontSize: ".83rem",
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    width: 22,
                    height: 22,
                    border: `2px solid ${G.border2}`,
                    borderTopColor: G.accent,
                    borderRadius: "50%",
                    animation: "spin .75s linear infinite",
                    marginBottom: ".6rem",
                  }}
                />
                <br />
                Rendering &amp; measuring…
              </div>
            )}

            {doc.status === "signed" && (
              <div
                style={{
                  padding: "2rem",
                  textAlign: "center",
                  color: G.green,
                  fontSize: ".9rem",
                }}
              >
                ✓ Document signed. Download below.
              </div>
            )}

            <div
              ref={canvasRef}
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            />
          </div>

          <div style={{ display: "flex", gap: ".65rem", flexWrap: "wrap" }}>
            <button
              onClick={onSign}
              disabled={!isPending}
              style={{
                flex: 1,
                minWidth: 110,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: ".4rem",
                padding: ".7rem .9rem",
                borderRadius: 9,
                fontFamily: "'Outfit',sans-serif",
                fontSize: ".86rem",
                fontWeight: 600,
                cursor: isPending ? "pointer" : "not-allowed",
                border: "none",
                opacity: isPending ? 1 : 0.35,
                background: "linear-gradient(135deg,#5b4fcf,#7c6af7)",
                color: "#fff",
                boxShadow: "0 4px 18px rgba(124,106,247,.35)",
              }}
            >
              {doc.status === "signing" ? "…Signing" : "✦ Sign Document"}
            </button>

            <button
              onClick={onReject}
              disabled={!isPending}
              style={{
                flex: 1,
                minWidth: 110,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: ".4rem",
                padding: ".7rem .9rem",
                borderRadius: 9,
                fontFamily: "'Outfit',sans-serif",
                fontSize: ".86rem",
                fontWeight: 600,
                cursor: isPending ? "pointer" : "not-allowed",
                border: `1px solid rgba(248,113,113,.3)`,
                background: G.surface2,
                color: G.red,
                opacity: isPending ? 1 : 0.35,
              }}
            >
              {doc.status === "rejected" ? "✕ Rejected" : "✕ Reject"}
            </button>

            {doc.signedBlob && (
              <a
                href={URL.createObjectURL(doc.signedBlob)}
                download={doc.name.replace(".pdf", "") + "_signed.pdf"}
                style={{
                  flex: 1,
                  minWidth: 110,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: ".4rem",
                  padding: ".7rem .9rem",
                  borderRadius: 9,
                  fontFamily: "'Outfit',sans-serif",
                  fontSize: ".86rem",
                  fontWeight: 600,
                  background: "linear-gradient(135deg,#1a7a55,#34d399)",
                  color: "#fff",
                  textDecoration: "none",
                  boxShadow: "0 4px 18px rgba(52,211,153,.25)",
                }}
              >
                ⬇ Download Signed
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

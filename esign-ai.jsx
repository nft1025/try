import { useState, useRef, useCallback, useEffect } from "react";

// Load external scripts dynamically
function useScript(src) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (document.querySelector(`script[src="${src}"]`)) { setLoaded(true); return; }
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = () => setLoaded(true);
    document.head.appendChild(s);
  }, [src]);
  return loaded;
}

const fmt = (b) => b < 1048576 ? (b/1024).toFixed(1)+" KB" : (b/1048576).toFixed(1)+" MB";
const uid = () => `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// ── Styles ────────────────────────────────────────────────────────────────────
const G = {
  bg: "#0b0c10", surface: "#13151a", surface2: "#1c1f28",
  border: "rgba(255,255,255,0.07)", border2: "rgba(255,255,255,0.13)",
  accent: "#7c6af7", accent2: "#a78bfa", gold: "#f0c060",
  green: "#34d399", red: "#f87171", text: "#e8e6f0",
  muted: "#6b7080", muted2: "#9096a8",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Outfit:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${G.bg}; }
  .sd-root {
    font-family: 'Outfit', sans-serif;
    background: ${G.bg};
    color: ${G.text};
    min-height: 100vh;
    background-image:
      radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,106,247,0.13) 0%, transparent 70%),
      radial-gradient(ellipse 40% 30% at 80% 100%, rgba(167,139,250,0.06) 0%, transparent 60%);
  }
  .sd-header {
    position: sticky; top: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 2rem;
    background: rgba(11,12,16,0.85);
    backdrop-filter: blur(18px);
    border-bottom: 1px solid ${G.border};
  }
  .sd-logo { font-family: 'Cormorant Garamond',serif; font-size: 1.6rem; font-weight:700; }
  .sd-logo em { color: ${G.accent2}; font-style: normal; }
  .sd-badge {
    display:flex; align-items:center; gap:.45rem;
    background: rgba(124,106,247,0.15); border: 1px solid rgba(124,106,247,0.3);
    border-radius:100px; padding:.28rem .85rem;
    font-size:.72rem; font-weight:600; color:${G.accent2}; letter-spacing:.06em;
  }
  .sd-dot { width:6px;height:6px;background:${G.accent2};border-radius:50%;animation:pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
  .sd-main { max-width:1060px; margin:0 auto; padding:2.2rem 1.5rem 5rem; }
  .sd-hero { margin-bottom:2rem; }
  .sd-hero h1 { font-family:'Cormorant Garamond',serif; font-size:clamp(1.7rem,4vw,2.6rem); font-weight:700; line-height:1.1; margin-bottom:.5rem; }
  .sd-hero h1 span { background:linear-gradient(135deg,${G.accent2},${G.gold}); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .sd-hero p { color:${G.muted2}; font-size:.92rem; max-width:540px; line-height:1.65; }
  .sd-grid { display:grid; grid-template-columns:1fr 1fr; gap:1.1rem; margin-bottom:2rem; }
  @media(max-width:640px){ .sd-grid{ grid-template-columns:1fr; } }
  .sd-panel { background:${G.surface}; border:1px solid ${G.border}; border-radius:16px; padding:1.5rem; transition:border-color .2s; }
  .sd-panel:hover { border-color:${G.border2}; }
  .sd-plabel { font-size:.67rem; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:${G.accent2}; margin-bottom:.4rem; }
  .sd-panel h2 { font-family:'Cormorant Garamond',serif; font-size:1.15rem; font-weight:600; margin-bottom:.9rem; }
  .sd-drop {
    border:1.5px dashed rgba(124,106,247,.35); border-radius:11px;
    padding:1.6rem 1rem; text-align:center; cursor:pointer; position:relative;
    transition:background .2s,border-color .2s;
  }
  .sd-drop:hover,.sd-drop.over { background:rgba(124,106,247,.07); border-color:${G.accent}; }
  .sd-drop input { position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%; }
  .sd-drop-icon { font-size:1.9rem; display:block; margin-bottom:.4rem; }
  .sd-drop p { font-size:.8rem; color:${G.muted}; line-height:1.55; }
  .sd-drop strong { color:${G.muted2}; }
  .sd-sig-prev {
    display:flex; align-items:center; gap:.75rem; margin-top:.9rem;
    padding:.7rem; background:${G.surface2}; border:1px solid ${G.border2}; border-radius:9px;
  }
  .sd-sig-prev img { max-height:48px; max-width:150px; object-fit:contain; background:rgba(255,255,255,.05); border-radius:5px; padding:3px; }
  .sd-sig-info { flex:1; min-width:0; }
  .sd-sig-info strong { display:block; font-size:.83rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sd-sig-info span { font-size:.71rem; color:${G.green}; }
  .sd-rm { background:none;border:none;cursor:pointer;color:${G.muted};font-size:.95rem;padding:3px;border-radius:5px;transition:color .15s; }
  .sd-rm:hover { color:${G.red}; }
  .sd-secbar { display:flex;align-items:center;justify-content:space-between;margin-bottom:1.1rem; }
  .sd-secbar h2 { font-family:'Cormorant Garamond',serif;font-size:1.35rem; }
  .sd-pill { font-size:.7rem;font-weight:600;background:rgba(124,106,247,.2);color:${G.accent2};border:1px solid rgba(124,106,247,.3);padding:.22rem .75rem;border-radius:100px; }
  .sd-doclist { display:flex;flex-direction:column;gap:.9rem; }
  .sd-card { background:${G.surface};border:1px solid ${G.border};border-radius:14px;overflow:hidden;transition:border-color .2s; }
  .sd-card:hover { border-color:${G.border2}; }
  .sd-card.signed   { border-left:3px solid ${G.green}; }
  .sd-card.rejected { border-left:3px solid ${G.red}; opacity:.6; }
  .sd-cardhead { display:flex;align-items:center;padding:.9rem 1.1rem;gap:.85rem;cursor:pointer;user-select:none; }
  .sd-thumb { width:36px;height:36px;background:${G.surface2};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0; }
  .sd-dinfo { flex:1;min-width:0; }
  .sd-dinfo strong { display:block;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
  .sd-dinfo span { font-size:.73rem;color:${G.muted}; }
  .sd-sbadge { font-size:.67rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;padding:.2rem .65rem;border-radius:100px;flex-shrink:0; }
  .sb-pending  { background:rgba(107,112,128,.2);color:${G.muted2}; }
  .sb-signed   { background:rgba(52,211,153,.15);color:${G.green}; }
  .sb-rejected { background:rgba(248,113,113,.15);color:${G.red}; }
  .sb-analyzing{ background:rgba(240,192,96,.15);color:${G.gold}; }
  .sd-chev { color:${G.muted};font-size:.8rem;margin-left:.35rem;transition:transform .25s;display:inline-block; }
  .sd-chev.open { transform:rotate(180deg); }
  .sd-cardbody { padding:0 1.1rem 1.1rem; border-top:1px solid ${G.border}; }
  .sd-aistrip {
    margin:1rem 0; padding:.8rem 1rem;
    background:rgba(124,106,247,.09); border:1px solid rgba(124,106,247,.22);
    border-radius:9px; font-size:.81rem; line-height:1.55; color:${G.muted2};
  }
  .sd-aistrip strong { color:${G.accent2}; }
  .sd-aifind { display:flex;align-items:flex-start;gap:.45rem;margin-top:.4rem; }
  .sd-aifind::before { content:'◆';color:${G.accent};font-size:.5rem;margin-top:.25rem;flex-shrink:0; }
  .sd-canvaswrap {
    background:#111320; border-radius:9px; overflow:hidden;
    margin-bottom:.9rem; max-height:440px; overflow-y:auto;
    display:flex; flex-direction:column; align-items:center; gap:4px; padding:7px;
  }
  .sd-pagecon { position:relative; display:inline-block; }
  .sd-pagecon canvas { border-radius:3px; max-width:100%; display:block; }
  .sd-overlay {
    position:absolute; border:2px solid ${G.green}; border-radius:4px;
    pointer-events:none; box-shadow:0 0 14px rgba(52,211,153,.45);
  }
  .sd-overlabel {
    position:absolute; top:-19px; left:0;
    font-size:9px; background:${G.green}; color:#000;
    padding:1px 5px; border-radius:3px; font-weight:700; white-space:nowrap;
    font-family:'Outfit',sans-serif;
  }
  .sd-loading { padding:2.5rem; text-align:center; color:${G.muted}; font-size:.83rem; }
  .sd-spin { display:inline-block;width:22px;height:22px;border:2px solid ${G.border2};border-top-color:${G.accent};border-radius:50%;animation:spin .75s linear infinite;margin-bottom:.6rem; }
  @keyframes spin { to{transform:rotate(360deg)} }
  .sd-actions { display:flex;gap:.65rem;flex-wrap:wrap; }
  .sd-btn {
    flex:1; min-width:110px;
    display:flex;align-items:center;justify-content:center;gap:.4rem;
    padding:.7rem .9rem; border-radius:9px;
    font-family:'Outfit',sans-serif; font-size:.86rem; font-weight:600;
    cursor:pointer; border:none; transition:transform .15s,box-shadow .15s,opacity .2s;
  }
  .sd-btn:active { transform:scale(.97); }
  .sd-btn:disabled { opacity:.35; cursor:not-allowed; }
  .sd-btn-sign { background:linear-gradient(135deg,#5b4fcf,#7c6af7);color:#fff;box-shadow:0 4px 18px rgba(124,106,247,.35); }
  .sd-btn-sign:hover:not(:disabled) { box-shadow:0 6px 24px rgba(124,106,247,.55);transform:translateY(-1px); }
  .sd-btn-rej { background:${G.surface2};color:${G.red};border:1px solid rgba(248,113,113,.3); }
  .sd-btn-rej:hover:not(:disabled) { background:rgba(248,113,113,.1); }
  .sd-btn-dl { background:linear-gradient(135deg,#1a7a55,#34d399);color:#fff;box-shadow:0 4px 18px rgba(52,211,153,.25);text-decoration:none; }
  .sd-btn-dl:hover { box-shadow:0 6px 24px rgba(52,211,153,.4);transform:translateY(-1px); }
  .sd-summary { display:flex;align-items:center;gap:2.2rem;flex-wrap:wrap;background:${G.surface};border:1px solid ${G.border};border-radius:14px;padding:1.3rem 1.8rem;margin-top:1.8rem; }
  .sd-stat-num { font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:700;display:block;line-height:1;margin-bottom:.15rem; }
  .sd-stat-lbl { font-size:.69rem;color:${G.muted};text-transform:uppercase;letter-spacing:.1em; }
  .sd-toast {
    position:fixed;bottom:1.6rem;right:1.6rem;z-index:999;
    background:${G.surface2};border:1px solid ${G.border2};color:${G.text};
    padding:.75rem 1.2rem;border-radius:11px;font-size:.84rem;font-weight:500;
    box-shadow:0 10px 40px rgba(0,0,0,.5);
    display:flex;align-items:center;gap:.55rem;
    transition:transform .3s cubic-bezier(.22,.68,0,1.2),opacity .3s;
    max-width:300px;
  }
  .sd-toast.hide { transform:translateY(120%);opacity:0; pointer-events:none; }
`;

// ── AI Prompt ─────────────────────────────────────────────────────────────────
const AI_PROMPT = `You are analyzing document page images to find where a signature should be placed.

Look carefully for:
- Signature lines (horizontal lines labeled "Signature:", "Signed by:", "Authorized:", "Employee Signature", "Sign here")
- Blank signature fields in forms
- "X" marks or dotted/dashed lines indicating where to sign
- Areas near "Date:", "Name:", "Title:" fields at the bottom of a page
- Signature blocks / boxes at the end of agreements

Return ONLY a valid JSON object (no markdown fences, no explanation):
{
  "found": true,
  "locations": [
    {
      "page_index": 0,
      "description": "Short description e.g. Employee Signature line, bottom-left",
      "x_percent": 0.08,
      "y_percent": 0.84,
      "width_percent": 0.35,
      "height_percent": 0.04
    }
  ],
  "reasoning": "One sentence summary of what you found"
}

page_index = 0-based index of which image in the array contains this location.
x_percent / y_percent = top-left corner of the signature box as a fraction of the page (0=left/top, 1=right/bottom).
width_percent / height_percent = size of the signature area as fraction of page dimensions.

If you find NO signature location at all:
{ "found": false, "locations": [], "reasoning": "Why none was found" }

CRITICAL: Return ONLY the JSON — no other text.`;

// ── Main Component ────────────────────────────────────────────────────────────
export default function SignDesk() {
  const pdfJsLoaded  = useScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
  const pdfLibLoaded = useScript("https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js");

  const [sig, setSig]   = useState(null); // { dataUrl, name }
  const [docs, setDocs] = useState([]);   // array of doc objects
  const [toast, setToast] = useState(null);
  const toastRef = useRef(null);

  // Set PDF.js worker once loaded
  useEffect(() => {
    if (pdfJsLoaded && window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
  }, [pdfJsLoaded]);

  // Toast helper
  const showToast = useCallback((msg, type="info") => {
    setToast({ msg, type });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // ── Signature upload ──
  const onSigUpload = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { setSig({ dataUrl: ev.target.result, name: f.name }); showToast("Signature loaded!", "success"); };
    r.readAsDataURL(f);
  };

  // ── Doc upload ──
  const onDocsUpload = (e) => {
    const files = Array.from(e.target.files).filter(f => f.type === "application/pdf");
    if (!files.length) { showToast("Please upload PDF files.", "error"); return; }
    const newDocs = files.map(f => ({
      id: uid(), file: f, name: f.name, size: f.size,
      status: "pending",      // pending | analyzing | signed | rejected
      aiResult: null,         // { found, locations, reasoning }
      pageInfos: null,        // rendered page data
      signedBlob: null,
      open: false,
      previewRendered: false,
    }));
    setDocs(prev => [...newDocs.reverse(), ...prev]);
    showToast(`${files.length} document${files.length > 1 ? "s" : ""} added.`, "success");
    e.target.value = "";
  };

  // ── Toggle card open ──
  const toggleCard = useCallback((id) => {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, open: !d.open } : d));
  }, []);

  // ── Update a single doc ──
  const updateDoc = useCallback((id, patch) => {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  }, []);

  // ── Render PDF pages to canvases, run AI ──
  const renderAndAnalyze = useCallback(async (doc) => {
    if (doc.previewRendered) return;
    if (!window.pdfjsLib) { showToast("PDF renderer not ready, try again.", "error"); return; }

    updateDoc(doc.id, { previewRendered: true, status: "analyzing" });

    try {
      const bytes = await doc.file.arrayBuffer();
      const pdfJs = await window.pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
      const numPages = pdfJs.numPages;
      const pageInfos = [];

      for (let p = 1; p <= Math.min(numPages, 8); p++) {
        const page = await pdfJs.getPage(p);
        const vp = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width; canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
        pageInfos.push({ pageNum: p, canvas, width: vp.width, height: vp.height });
      }

      updateDoc(doc.id, { pageInfos, status: "pending" });

      // Run AI on last up to 3 pages (most likely to have signature)
      const toAnalyze = pageInfos.slice(-3).reverse();
      const imageContents = toAnalyze.map(pi => ({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: pi.canvas.toDataURL("image/jpeg", 0.88).split(",")[1],
        },
      }));

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              ...imageContents,
              {
                type: "text",
                text: `These are images of pages ${toAnalyze.map(p => p.pageNum).join(", ")} of a document (image index 0 = page ${toAnalyze[0].pageNum}).\n\n${AI_PROMPT}`,
              },
            ],
          }],
        }),
      });

      const data = await res.json();

      if (data.error) throw new Error(data.error.message || "API error");

      const raw = data.content?.find(c => c.type === "text")?.text || "{}";
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const aiResult = JSON.parse(cleaned);

      // Attach page references so we can draw overlays
      if (aiResult.found && aiResult.locations?.length) {
        aiResult.locations = aiResult.locations.map(loc => ({
          ...loc,
          pageInfo: toAnalyze[loc.page_index] || toAnalyze[0],
        }));
      }

      updateDoc(doc.id, { aiResult });

    } catch (err) {
      console.error("AI/render error:", err);
      updateDoc(doc.id, { aiResult: { found: false, locations: [], reasoning: `Error: ${err.message}` }, status: "pending" });
      showToast("AI analysis failed — will use default placement.", "error");
    }
  }, [updateDoc, showToast]);

  // ── Sign document ──
  const handleSign = useCallback(async (doc) => {
    if (!sig) { showToast("Upload your signature first!", "error"); return; }
    if (!window.PDFLib) { showToast("PDF library not ready.", "error"); return; }
    updateDoc(doc.id, { status: "signing" });

    try {
      const pdfBytes = await doc.file.arrayBuffer();
      const pdfDoc   = await window.PDFLib.PDFDocument.load(pdfBytes);

      const imgBytes = await fetch(sig.dataUrl).then(r => r.arrayBuffer());
      const mime = (sig.dataUrl.match(/data:(image\/\w+)/) || [])[1] || "image/png";
      const embImg = mime.includes("jpeg") || mime.includes("jpg")
        ? await pdfDoc.embedJpg(imgBytes)
        : await pdfDoc.embedPng(imgBytes);

      const pdfPages = pdfDoc.getPages();
      let placement = null;

      // Use AI result if available
      if (doc.aiResult?.found && doc.aiResult.locations?.length) {
        const loc = doc.aiResult.locations[0];
        const pi = loc.pageInfo;
        if (pi) {
          const targetPage = pdfPages[pi.pageNum - 1];
          const { width, height } = targetPage.getSize();
          const sigW = loc.width_percent * width;
          const sigH = Math.max(loc.height_percent * height, 36);
          const sigX = loc.x_percent * width;
          // canvas Y is top-down; PDF Y is bottom-up
          const sigY = height - (loc.y_percent * height) - sigH;
          placement = { page: targetPage, x: sigX, y: sigY, w: sigW, h: sigH };
        }
      }

      // Fallback
      if (!placement) {
        const last = pdfPages[pdfPages.length - 1];
        const { width, height } = last.getSize();
        const dims = embImg.scaleToFit(180, 55);
        placement = { page: last, x: width - dims.width - 44, y: 32, w: dims.width, h: dims.height };
      }

      const dims = embImg.scaleToFit(placement.w, Math.max(placement.h, 36));
      placement.page.drawImage(embImg, {
        x: placement.x + (placement.w - dims.width) / 2,
        y: placement.y + (placement.h - dims.height) / 2,
        width: dims.width, height: dims.height, opacity: 0.93,
      });
      placement.page.drawText(`Signed: ${new Date().toLocaleString()}`, {
        x: placement.x,
        y: Math.max(placement.y - 11, 6),
        size: 7, color: window.PDFLib.rgb(0.5, 0.5, 0.58),
      });

      const signedBytes = await pdfDoc.save();
      const signedBlob = new Blob([signedBytes], { type: "application/pdf" });
      updateDoc(doc.id, { status: "signed", signedBlob, pageInfos: null, previewRendered: false });
      showToast(`"${doc.name}" signed!`, "success");

    } catch (err) {
      console.error(err);
      updateDoc(doc.id, { status: "pending" });
      showToast("Signing failed: " + err.message, "error");
    }
  }, [sig, updateDoc, showToast]);

  const handleReject = useCallback((doc) => {
    updateDoc(doc.id, { status: "rejected" });
    showToast(`"${doc.name}" rejected.`, "error");
  }, [updateDoc, showToast]);

  const summary = {
    total: docs.length,
    signed: docs.filter(d => d.status === "signed").length,
    rej: docs.filter(d => d.status === "rejected").length,
    pend: docs.filter(d => d.status === "pending" || d.status === "analyzing").length,
  };

  const toastColors = { info: G.accent2, success: G.green, error: G.red, warn: G.gold };
  const toastIcons  = { info: "◆", success: "✓", error: "✕", warn: "⚠" };

  return (
    <>
      <style>{css}</style>
      <div className="sd-root">
        {/* Header */}
        <header className="sd-header">
          <div className="sd-logo">Sign<em>Desk</em> <span style={{fontSize:".6em",color:G.muted,fontFamily:"'Outfit',sans-serif",fontWeight:300}}>AI</span></div>
          <div className="sd-badge"><span className="sd-dot"/>&nbsp;Claude Vision · Auto-Detect</div>
        </header>

        <main className="sd-main">
          {/* Hero */}
          <div className="sd-hero">
            <h1>Sign documents<br/><span>intelligently.</span></h1>
            <p>Upload your signature once. Claude AI visually scans each document to pinpoint the exact signature field — no placeholders needed.</p>
          </div>

          {/* Setup grid */}
          <div className="sd-grid">
            {/* Signature panel */}
            <div className="sd-panel">
              <div className="sd-plabel">Step 1</div>
              <h2>Your Signature</h2>
              <div className="sd-drop" onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add("over")}} onDragLeave={e=>e.currentTarget.classList.remove("over")} onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove("over");}}>
                <input type="file" accept="image/*" onChange={onSigUpload}/>
                <span className="sd-drop-icon">✍️</span>
                <p><strong>Click or drag</strong> your signature image<br/>PNG with transparent background works best</p>
              </div>
              {sig && (
                <div className="sd-sig-prev">
                  <img src={sig.dataUrl} alt="sig"/>
                  <div className="sd-sig-info">
                    <strong>{sig.name}</strong>
                    <span>✓ Ready to use</span>
                  </div>
                  <button className="sd-rm" onClick={()=>setSig(null)}>✕</button>
                </div>
              )}
            </div>

            {/* Documents panel */}
            <div className="sd-panel">
              <div className="sd-plabel">Step 2</div>
              <h2>Upload Documents</h2>
              <div className="sd-drop" onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add("over")}} onDragLeave={e=>e.currentTarget.classList.remove("over")} onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove("over");}}>
                <input type="file" accept=".pdf" multiple onChange={onDocsUpload}/>
                <span className="sd-drop-icon">📄</span>
                <p><strong>Click or drag</strong> PDF files here<br/>AI will locate the signature fields automatically</p>
              </div>
            </div>
          </div>

          {/* Doc list */}
          {docs.length > 0 && (
            <>
              <div className="sd-secbar">
                <h2>Documents to Review</h2>
                <span className="sd-pill">{docs.length} file{docs.length!==1?"s":""}</span>
              </div>
              <div className="sd-doclist">
                {docs.map(doc => (
                  <DocCard
                    key={doc.id}
                    doc={doc}
                    sig={sig}
                    onToggle={() => {
                      toggleCard(doc.id);
                      if (!doc.open && !doc.previewRendered && doc.status !== "signed") {
                        renderAndAnalyze(doc);
                      }
                    }}
                    onSign={() => handleSign(doc)}
                    onReject={() => handleReject(doc)}
                  />
                ))}
              </div>

              {/* Summary */}
              <div className="sd-summary">
                <div><span className="sd-stat-num" style={{color:G.text}}>{summary.total}</span><span className="sd-stat-lbl">Total</span></div>
                <div><span className="sd-stat-num" style={{color:G.green}}>{summary.signed}</span><span className="sd-stat-lbl">Signed</span></div>
                <div><span className="sd-stat-num" style={{color:G.red}}>{summary.rej}</span><span className="sd-stat-lbl">Rejected</span></div>
                <div><span className="sd-stat-num" style={{color:G.gold}}>{summary.pend}</span><span className="sd-stat-lbl">Pending</span></div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className="sd-toast" style={{borderColor: toastColors[toast.type]+"55"}}>
          <span style={{color:toastColors[toast.type], fontWeight:700}}>{toastIcons[toast.type]}</span>
          {toast.msg}
        </div>
      )}
    </>
  );
}

// ── DocCard ───────────────────────────────────────────────────────────────────
function DocCard({ doc, sig, onToggle, onSign, onReject }) {
  const canvasRef = useRef(null);
  const renderedRef = useRef(false);

  // Draw canvases + overlays when pageInfos arrive
  useEffect(() => {
    if (!doc.open || !doc.pageInfos || !canvasRef.current) return;
    if (renderedRef.current) return;
    renderedRef.current = true;

    const wrap = canvasRef.current;
    wrap.innerHTML = "";

    doc.pageInfos.forEach(pi => {
      const cont = document.createElement("div");
      cont.className = "sd-pagecon";
      cont.style.width = pi.width + "px";
      // Clone canvas (original is held in memory)
      const cv2 = document.createElement("canvas");
      cv2.width = pi.width; cv2.height = pi.height;
      cv2.style.width = "100%";
      cv2.getContext("2d").drawImage(pi.canvas, 0, 0);
      cont.appendChild(cv2);
      wrap.appendChild(cont);
    });

    // Draw AI overlays
    if (doc.aiResult?.found && doc.aiResult.locations?.length) {
      doc.aiResult.locations.forEach(loc => {
        const pi = loc.pageInfo;
        if (!pi) return;
        // Find the container for this page
        const containers = wrap.querySelectorAll(".sd-pagecon");
        const idx = doc.pageInfos.findIndex(p => p.pageNum === pi.pageNum);
        const cont = containers[idx];
        if (!cont) return;
        const ov = document.createElement("div");
        ov.className = "sd-overlay";
        const lbl = document.createElement("div");
        lbl.className = "sd-overlabel";
        lbl.textContent = "✦ AI: Sign here";
        ov.appendChild(lbl);
        ov.style.left   = (loc.x_percent * pi.width) + "px";
        ov.style.top    = (loc.y_percent * pi.height) + "px";
        ov.style.width  = (loc.width_percent * pi.width) + "px";
        ov.style.height = Math.max(loc.height_percent * pi.height, 18) + "px";
        cont.appendChild(ov);
      });
    }
  }, [doc.open, doc.pageInfos, doc.aiResult]);

  // Reset canvas when card is re-opened after signing
  useEffect(() => {
    if (!doc.open) renderedRef.current = false;
  }, [doc.open]);

  const statusClass = {
    pending: "sb-pending", analyzing: "sb-analyzing",
    signing: "sb-analyzing", signed: "sb-signed", rejected: "sb-rejected",
  }[doc.status] || "sb-pending";

  const statusLabel = {
    pending:"Pending", analyzing:"Analyzing…", signing:"Signing…",
    signed:"Signed", rejected:"Rejected",
  }[doc.status] || "Pending";

  const isPending = doc.status === "pending";
  const isBusy    = doc.status === "analyzing" || doc.status === "signing";

  return (
    <div className={`sd-card ${doc.status === "signed" ? "signed" : ""} ${doc.status === "rejected" ? "rejected" : ""}`}>
      <div className="sd-cardhead" onClick={onToggle}>
        <div className="sd-thumb">📄</div>
        <div className="sd-dinfo">
          <strong title={doc.name}>{doc.name}</strong>
          <span>{fmt(doc.size)}</span>
        </div>
        <span className={`sd-sbadge ${statusClass}`}>{statusLabel}</span>
        <span className={`sd-chev ${doc.open ? "open" : ""}`}>▾</span>
      </div>

      {doc.open && (
        <div className="sd-cardbody">
          {/* AI strip */}
          <div className="sd-aistrip">
            {!doc.aiResult && doc.status === "analyzing" && (
              <><strong>🤖 AI Analysis</strong> — Scanning pages for signature fields…</>
            )}
            {!doc.aiResult && doc.status !== "analyzing" && (
              <><strong>🤖 AI Analysis</strong> — Open document to begin analysis.</>
            )}
            {doc.aiResult && doc.aiResult.found && (
              <>
                <strong>🤖 AI found {doc.aiResult.locations.length} signature location{doc.aiResult.locations.length > 1 ? "s" : ""}</strong>
                {doc.aiResult.locations.map((l, i) => (
                  <div key={i} className="sd-aifind">{l.description}</div>
                ))}
                <div className="sd-aifind" style={{marginTop:".35rem",fontSize:".76rem",color:G.muted}}>{doc.aiResult.reasoning}</div>
              </>
            )}
            {doc.aiResult && !doc.aiResult.found && (
              <>
                <strong>🤖 AI Analysis</strong> — No explicit field found.{" "}
                <span style={{color:G.gold}}>Signature will be placed at default bottom-right position.</span>
                {doc.aiResult.reasoning && <div className="sd-aifind" style={{fontSize:".76rem",color:G.muted}}>{doc.aiResult.reasoning}</div>}
              </>
            )}
          </div>

          {/* Canvas preview */}
          <div className="sd-canvaswrap">
            {doc.status === "analyzing" && !doc.pageInfos && (
              <div className="sd-loading"><div className="sd-spin"/><br/>Rendering &amp; analyzing…</div>
            )}
            {doc.status === "signed" && (
              <div className="sd-loading" style={{color:G.green}}>✓ Document signed. Download below.</div>
            )}
            <div ref={canvasRef} style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:"4px"}}/>
          </div>

          {/* Actions */}
          <div className="sd-actions">
            <button
              className="sd-btn sd-btn-sign"
              disabled={!isPending || isBusy}
              onClick={onSign}
            >
              {doc.status === "signing" ? "…Signing" : "✦ Sign Document"}
            </button>
            <button
              className="sd-btn sd-btn-rej"
              disabled={!isPending || isBusy}
              onClick={onReject}
            >
              {doc.status === "rejected" ? "✕ Rejected" : "✕ Reject"}
            </button>
            {doc.signedBlob && (
              <a
                className="sd-btn sd-btn-dl"
                href={URL.createObjectURL(doc.signedBlob)}
                download={doc.name.replace(".pdf","") + "_signed.pdf"}
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

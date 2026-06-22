const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");

// Icon helper
const {
  FaHeartbeat, FaUserMd, FaMobileAlt, FaShieldAlt, FaChartLine,
  FaMapMarkedAlt, FaPills, FaQrcode, FaBrain, FaHome, FaExclamationTriangle,
  FaCheckCircle, FaDatabase, FaWifi, FaLock, FaUsers, FaRocket,
  FaStethoscope, FaFileMedical, FaBell, FaTablets, FaHospital,
  FaSyringe, FaClipboardList, FaNetworkWired, FaCode, FaChartBar,
  FaFlask, FaCalendarAlt, FaArrowRight, FaLightbulb
} = require("react-icons/fa");
const { MdHealthAndSafety, MdOutlineSensors } = require("react-icons/md");

async function iconPng(IconComp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComp, { color, size: String(size) })
  );
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

// ─── COLOR PALETTE ───────────────────────────────────────────────
const C = {
  navy:    "0D1B2A",
  teal:    "0D9488",
  tealLt:  "14B8A6",
  mint:    "CCFBF1",
  amber:   "F59E0B",
  red:     "EF4444",
  white:   "FFFFFF",
  offWhite:"F8FAFC",
  slate:   "64748B",
  slateD:  "334155",
  lightBg: "F0FDFA",
  cardBg:  "FFFFFF",
  mintBg:  "F0FDFA",
  navyMid: "1E3A5F",
  gold:    "F59E0B",
};

const makeShadow = () => ({ type: "outer", color: "000000", blur: 8, offset: 2, angle: 45, opacity: 0.10 });

// ─── SLIDE HELPERS ────────────────────────────────────────────────
function addSlideHeader(slide, tag, title, subtitle, dark = false) {
  const bg = dark ? C.navy : C.offWhite;
  slide.background = { color: bg };

  // Tag pill
  slide.addShape("rect", {
    x: 0.5, y: 0.28, w: 1.9, h: 0.32,
    fill: { color: dark ? C.teal : C.teal },
    line: { color: dark ? C.teal : C.teal },
    rectRadius: 0.08
  });
  slide.addText(tag, {
    x: 0.5, y: 0.28, w: 1.9, h: 0.32,
    fontSize: 9, bold: true, color: C.white,
    align: "center", valign: "middle", margin: 0
  });

  // Title
  slide.addText(title, {
    x: 0.5, y: 0.68, w: 9.0, h: 0.7,
    fontSize: 28, bold: true,
    color: dark ? C.white : C.navy,
    fontFace: "Cambria", margin: 0
  });

  // Subtitle
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5, y: 1.32, w: 9.0, h: 0.35,
      fontSize: 12, color: dark ? "99CCCC" : C.slate,
      fontFace: "Calibri", margin: 0
    });
  }
}

function statBox(slide, x, y, w, h, value, label, color) {
  slide.addShape("roundRect", {
    x, y, w, h,
    fill: { color: color + "18" },
    line: { color: color, width: 1.5 },
    rectRadius: 0.12
  });
  slide.addText(value, {
    x, y: y + 0.08, w, h: h * 0.55,
    fontSize: 30, bold: true, color: color,
    align: "center", fontFace: "Cambria", margin: 0
  });
  slide.addText(label, {
    x, y: y + h * 0.55, w, h: h * 0.4,
    fontSize: 9.5, color: C.slateD,
    align: "center", fontFace: "Calibri", margin: 0
  });
}

function featureCard(slide, x, y, w, h, iconData, title, bullets, accentColor) {
  slide.addShape("roundRect", {
    x, y, w, h,
    fill: { color: C.white },
    line: { color: accentColor, width: 1 },
    rectRadius: 0.12,
    shadow: makeShadow()
  });
  if (iconData) {
    slide.addImage({ data: iconData, x: x + 0.18, y: y + 0.18, w: 0.38, h: 0.38 });
  }
  slide.addText(title, {
    x: x + 0.62, y: y + 0.15, w: w - 0.75, h: 0.42,
    fontSize: 11, bold: true, color: C.navy,
    fontFace: "Cambria", valign: "middle", margin: 0
  });
  slide.addText(bullets.map((b, i) => ({
    text: b,
    options: { bullet: true, breakLine: i < bullets.length - 1, fontSize: 9.5, color: C.slateD, fontFace: "Calibri" }
  })), { x: x + 0.18, y: y + 0.58, w: w - 0.3, h: h - 0.65 });
}

// ═══════════════════════════════════════════════════════════════════
async function buildDeck() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = "VitalBridge – Round 2";

  // ── PRE-RENDER ICONS ──────────────────────────────────────────
  const iHeart   = await iconPng(FaHeartbeat,   "#" + C.teal);
  const iDoc     = await iconPng(FaUserMd,      "#" + C.teal);
  const iMobile  = await iconPng(FaMobileAlt,   "#" + C.teal);
  const iShield  = await iconPng(FaShieldAlt,   "#" + C.teal);
  const iChart   = await iconPng(FaChartLine,   "#" + C.teal);
  const iMap     = await iconPng(FaMapMarkedAlt,"#" + C.teal);
  const iPills   = await iconPng(FaPills,       "#" + C.teal);
  const iQr      = await iconPng(FaQrcode,      "#" + C.teal);
  const iBrain   = await iconPng(FaBrain,       "#" + C.teal);
  const iHome    = await iconPng(FaHome,        "#" + C.teal);
  const iWarn    = await iconPng(FaExclamationTriangle, "#" + C.amber);
  const iCheck   = await iconPng(FaCheckCircle, "#" + C.teal);
  const iBell    = await iconPng(FaBell,        "#" + C.amber);
  const iSyringe = await iconPng(FaSyringe,     "#" + C.teal);
  const iClip    = await iconPng(FaClipboardList,"#" + C.teal);
  const iFlask   = await iconPng(FaFlask,       "#" + C.red);
  const iRocket  = await iconPng(FaRocket,      "#" + C.teal);
  const iUsers   = await iconPng(FaUsers,       "#" + C.teal);
  const iCode    = await iconPng(FaCode,        "#" + C.teal);
  const iChartB  = await iconPng(FaChartBar,    "#" + C.teal);
  const iNet     = await iconPng(FaNetworkWired,"#" + C.teal);
  const iLight   = await iconPng(FaLightbulb,   "#" + C.gold);
  const iSteth   = await iconPng(FaStethoscope, "#" + C.teal);
  const iFile    = await iconPng(FaFileMedical, "#" + C.teal);
  const iDB      = await iconPng(FaDatabase,    "#" + C.teal);
  const iLock    = await iconPng(FaLock,        "#" + C.teal);
  const iHosp    = await iconPng(FaHospital,    "#" + C.teal);
  const iCal     = await iconPng(FaCalendarAlt, "#" + C.teal);
  const iTablets = await iconPng(FaTablets,     "#" + C.teal);

  // ══════════════════════════════════════════════════════════════
  // SLIDE 1 — TITLE
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };

    // Teal accent circle decoration (top-right)
    s.addShape("oval", { x: 7.8, y: -0.8, w: 3.5, h: 3.5, fill: { color: C.teal, transparency: 82 }, line: { color: C.teal, transparency: 82 } });
    s.addShape("oval", { x: 8.5, y: -0.2, w: 2.0, h: 2.0, fill: { color: C.tealLt, transparency: 70 }, line: { color: C.tealLt, transparency: 70 } });

    // Hackathon badge
    s.addShape("roundRect", { x: 0.5, y: 0.35, w: 3.6, h: 0.36, fill: { color: C.teal }, line: { color: C.teal }, rectRadius: 0.1 });
    s.addText("BHARAT ACADEMIX CODEQUEST 2026 — ROUND 2", {
      x: 0.5, y: 0.35, w: 3.6, h: 0.36,
      fontSize: 7.5, bold: true, color: C.white, align: "center", valign: "middle", margin: 0
    });

    s.addText("VitalBridge", {
      x: 0.5, y: 1.0, w: 9.0, h: 1.1,
      fontSize: 52, bold: true, color: C.white, fontFace: "Cambria", margin: 0
    });
    s.addText("AI-Powered Healthcare Continuum Platform for Bharat", {
      x: 0.5, y: 2.05, w: 7.5, h: 0.55,
      fontSize: 18, color: C.mint, fontFace: "Calibri", margin: 0
    });
    s.addText("Extended with Drug Interaction Checking · Predictive Readmission · Household Health Graph · AI Handoff Notes · Vaccination Drive Planner", {
      x: 0.5, y: 2.65, w: 8.5, h: 0.4,
      fontSize: 10.5, color: "7ECECE", fontFace: "Calibri", italic: true, margin: 0
    });

    // Tag pills row
    const tags = ["Healthcare Tech", "AI & ML", "IoT", "Social Impact"];
    tags.forEach((t, i) => {
      s.addShape("roundRect", { x: 0.5 + i * 2.1, y: 3.3, w: 1.95, h: 0.3, fill: { color: C.navyMid }, line: { color: C.teal, width: 1 }, rectRadius: 0.08 });
      s.addText(t, { x: 0.5 + i * 2.1, y: 3.3, w: 1.95, h: 0.3, fontSize: 8.5, color: C.tealLt, align: "center", valign: "middle", margin: 0, fontFace: "Calibri" });
    });

    // Team block
    s.addShape("roundRect", { x: 0.5, y: 3.85, w: 5.5, h: 1.45, fill: { color: C.navyMid }, line: { color: C.teal, width: 1 }, rectRadius: 0.12 });
    s.addText("TEAM CIPHER STRIKE", { x: 0.65, y: 3.93, w: 5.2, h: 0.28, fontSize: 10, bold: true, color: C.tealLt, fontFace: "Calibri", margin: 0 });
    s.addText([
      { text: "David Jayaraj A  |  AI/ML Engineer", options: { breakLine: true } },
      { text: "Jerwin Titus D  |  Full Stack Developer", options: { breakLine: true } },
      { text: "Daphne Christina Nelson  |  IoT & Systems", options: { breakLine: true } },
      { text: "Karunya Institute of Technology and Sciences" }
    ], { x: 0.65, y: 4.23, w: 5.2, h: 1.0, fontSize: 10, color: "AACCCC", fontFace: "Calibri", margin: 0 });

    // Heart icon
    s.addImage({ data: iHeart, x: 8.3, y: 3.9, w: 1.1, h: 1.1 });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 2 — THE PROBLEM
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.offWhite };

    addSlideHeader(s, "THE PROBLEM", "India's Healthcare Crisis Is a Three-Gap Emergency",
      "600 million rural Indians have no reliable access to healthcare. Here is why.");

    // Big stats row
    const stats = [
      { v: "1:1,456", l: "Doctor-to-patient ratio\n(WHO: 1:1,000)", c: C.red },
      { v: "70/30", l: "Urban/rural infra\nsplit (inverted)", c: C.amber },
      { v: "Stage 3–4", l: "When most diseases\ndetected in rural India", c: C.red },
      { v: "<40%", l: "Medication adherence\nin rural areas", c: C.amber }
    ];
    stats.forEach((st, i) => statBox(s, 0.5 + i * 2.35, 1.82, 2.1, 1.15, st.v, st.l, st.c));

    // Three gap cards
    const gaps = [
      { icon: iDoc, title: "Diagnosis Gap", body: "65% of rural patients travel 30+ km for consultation. Early symptoms go undiagnosed until critical Stage 3–4." },
      { icon: iPills, title: "Medication Gap", body: "Chronic disease (diabetes, TB, hypertension) adherence below 40%. Prescriptions lost, doses missed, lives cut short." },
      { icon: iDB, title: "Data Gap", body: "Zero unified health record. Every hospital visit starts from zero — wasting time, money, and clinical context." }
    ];
    gaps.forEach((g, i) => featureCard(s, 0.5 + i * 3.1, 3.2, 2.95, 1.98, g.icon, g.title, [g.body], C.teal));
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 3 — STAKEHOLDERS
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.offWhite };
    addSlideHeader(s, "STAKEHOLDERS", "Who Suffers — and How VitalBridge Serves Them",
      "Four key user groups, each with distinct unmet needs.");

    const groups = [
      { icon: iMobile, title: "Rural Patients", color: C.teal,
        bullets: ["No nearby doctor", "Language barriers", "Lost medical history", "High travel costs"] },
      { icon: iDoc, title: "PHC Doctors & Nurses", color: C.navyMid,
        bullets: ["Paper-based records", "No patient history", "Overloaded with patients", "Manual outbreak tracking"] },
      { icon: iUsers, title: "ASHA Workers", color: C.teal,
        bullets: ["No digital tools", "Manual household tracking", "Late disease alerts", "No medication follow-up"] },
      { icon: iChartB, title: "District Health Officers", color: C.navyMid,
        bullets: ["2-week IDSP lag", "No hyperlocal data", "Manual reports", "Missed outbreak signals"] }
    ];
    groups.forEach((g, i) => {
      const x = 0.5 + i * 2.35;
      s.addShape("roundRect", { x, y: 1.9, w: 2.2, h: 3.3,
        fill: { color: g.color === C.teal ? C.lightBg : C.offWhite },
        line: { color: g.color, width: 1.5 }, rectRadius: 0.14, shadow: makeShadow() });
      s.addImage({ data: g.icon, x: x + 0.82, y: 2.05, w: 0.55, h: 0.55 });
      s.addText(g.title, { x, y: 2.66, w: 2.2, h: 0.4, fontSize: 10.5, bold: true, color: C.navy, align: "center", fontFace: "Cambria", margin: 0 });
      s.addText(g.bullets.map((b, j) => ({
        text: b, options: { bullet: true, breakLine: j < g.bullets.length - 1, fontSize: 9.5, color: C.slateD, fontFace: "Calibri" }
      })), { x: x + 0.18, y: 3.08, w: 1.85, h: 1.95 });
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 4 — GAP ANALYSIS
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    addSlideHeader(s, "GAP ANALYSIS", "No Existing Solution Closes the Full Loop",
      "VitalBridge is the only platform integrating all critical dimensions.", true);

    const rows = [
      ["Capability", "Telemedicine Apps", "Hospital EMR", "Govt ABHA", "VitalBridge"],
      ["No-App Triage (WhatsApp)", "✗", "✗", "✗", "✓"],
      ["5 Indian Languages + Voice", "Partial", "✗", "✗", "✓"],
      ["Patient-Owned Federated Record", "✗", "✗", "Partial", "✓"],
      ["IoT Medication Adherence", "✗", "✗", "✗", "✓"],
      ["Real-Time Outbreak Surveillance", "✗", "✗", "✗", "✓"],
      ["Wearable Vitals Integration", "✗", "✗", "✗", "✓"],
      ["ABDM Compliant + FHIR R4", "✗", "Varies", "✓", "✓"],
      ["Drug Interaction Checker (NEW)", "✗", "Partial", "✗", "✓"],
      ["Predictive Readmission Risk (NEW)", "✗", "✗", "✗", "✓"],
    ];
    const tableData = rows.map((row, ri) => row.map((cell, ci) => {
      const isHeader = ri === 0;
      const isVB = ci === 4;
      const isCheck = cell === "✓";
      const isCross = cell === "✗";
      return {
        text: cell,
        options: {
          fill: { color: isHeader ? C.teal : (ri % 2 === 0 ? "1A2E40" : "152434") },
          color: isHeader ? C.white : isCheck ? "4ADE80" : isCross ? "F87171" : isVB ? C.tealLt : "AACCCC",
          bold: isHeader || isCheck,
          fontSize: isHeader ? 9.5 : 9,
          align: ci === 0 ? "left" : "center",
          fontFace: "Calibri"
        }
      };
    }));
    s.addTable(tableData, {
      x: 0.5, y: 1.82, w: 9.0,
      colW: [3.2, 1.45, 1.45, 1.45, 1.45],
      rowH: 0.33,
      border: { pt: 0.5, color: "2A4060" }
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 5 — OUR SOLUTION
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.offWhite };
    addSlideHeader(s, "OUR SOLUTION", "VitalBridge: A Closed-Loop Healthcare Continuum",
      "From first symptom → diagnosis → treatment → adherence → population health — one integrated platform.");

    const layers = [
      { num: "01", icon: iBrain,   title: "AI Symptom Triage",        sub: "WhatsApp + Voice in 5 languages", color: C.teal },
      { num: "02", icon: iFile,    title: "Federated Health Passport", sub: "Patient-owned encrypted records", color: C.navyMid },
      { num: "03", icon: iMap,     title: "Disease Surveillance",      sub: "72-hr outbreak early warning",    color: C.teal },
      { num: "04", icon: iPills,   title: "IoT Medication Adherence",  sub: "₹300 smart pill dispenser",       color: C.navyMid },
    ];
    layers.forEach((l, i) => {
      const x = 0.5 + i * 2.35;
      s.addShape("roundRect", { x, y: 1.9, w: 2.18, h: 2.4,
        fill: { color: l.color === C.teal ? C.lightBg : C.white },
        line: { color: l.color, width: 1.5 }, rectRadius: 0.14, shadow: makeShadow() });
      s.addShape("oval", { x: x + 0.72, y: 2.02, w: 0.72, h: 0.72,
        fill: { color: l.color }, line: { color: l.color } });
      s.addText(l.num, { x: x + 0.72, y: 2.02, w: 0.72, h: 0.72, fontSize: 14, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
      s.addImage({ data: l.icon, x: x + 1.52, y: 2.1, w: 0.5, h: 0.5 });
      s.addText(l.title, { x: x + 0.1, y: 2.82, w: 2.0, h: 0.44, fontSize: 10.5, bold: true, color: C.navy, align: "center", fontFace: "Cambria", margin: 0 });
      s.addText(l.sub,  { x: x + 0.1, y: 3.26, w: 2.0, h: 0.38, fontSize: 9, color: C.slate, align: "center", fontFace: "Calibri", margin: 0 });
    });

    s.addText("VitalBridge closes the loop India's healthcare system never closed.", {
      x: 0.5, y: 4.62, w: 9.0, h: 0.4, fontSize: 11.5, italic: true, color: C.teal,
      align: "center", fontFace: "Calibri", margin: 0
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 6 — LAYER 1: AI TRIAGE
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.offWhite };
    addSlideHeader(s, "LAYER 1 — AI TRIAGE", "Zero-Friction Symptom Triage for Every Indian",
      "No app download. No literacy required. Works on any basic phone in 5 languages.");

    // Chat mock
    const chatX = 0.5, chatY = 1.85, chatW = 4.0, chatH = 3.3;
    s.addShape("roundRect", { x: chatX, y: chatY, w: chatW, h: chatH, fill: { color: C.navy }, line: { color: C.teal }, rectRadius: 0.14 });
    s.addText("VitalBridge AI", { x: chatX + 0.18, y: chatY + 0.12, w: chatW - 0.3, h: 0.3, fontSize: 10, bold: true, color: C.tealLt, fontFace: "Calibri", margin: 0 });

    const msgs = [
      { text: "Namaste! Kya takleef hai?", ai: true },
      { text: "Bukhaar aur sar dard — 2 din se", ai: false },
      { text: "102°F? Dengue/flu symptoms. Doctor connect kar raha hoon 🏥", ai: true }
    ];
    let my = chatY + 0.52;
    msgs.forEach(m => {
      const bw = 2.8, bx = m.ai ? chatX + 0.15 : chatX + chatW - bw - 0.15;
      s.addShape("roundRect", { x: bx, y: my, w: bw, h: 0.55,
        fill: { color: m.ai ? C.teal : "2A4060" }, line: { color: m.ai ? C.teal : "3A5070" }, rectRadius: 0.1 });
      s.addText(m.text, { x: bx + 0.1, y: my + 0.06, w: bw - 0.2, h: 0.44,
        fontSize: 8.5, color: C.white, fontFace: "Calibri", margin: 0 });
      my += 0.68;
    });

    // Features right side
    const feats = [
      { icon: iBrain,  title: "Grok AI Engine",      body: "Real streaming responses — zero canned replies. Multi-turn clinical context." },
      { icon: iMobile, title: "WhatsApp + Voice IVR", body: "500M+ WhatsApp users. Works on 2G, any basic phone, zero install." },
      { icon: iShield, title: "5 Indian Languages",   body: "Hindi, Tamil, Telugu, Kannada, Bengali — auto-detected per message." },
      { icon: iDoc,    title: "Auto-Escalation",      body: "High-severity → real Doctor Queue entry in DB + WebSocket broadcast." }
    ];
    feats.forEach((f, i) => {
      const fy = 1.85 + i * 0.82;
      s.addShape("roundRect", { x: 4.75, y: fy, w: 4.75, h: 0.72,
        fill: { color: i % 2 === 0 ? C.lightBg : C.white },
        line: { color: C.teal, width: 0.75 }, rectRadius: 0.1, shadow: makeShadow() });
      s.addImage({ data: f.icon, x: 4.9, y: fy + 0.17, w: 0.38, h: 0.38 });
      s.addText(f.title, { x: 5.35, y: fy + 0.1, w: 4.0, h: 0.28, fontSize: 10, bold: true, color: C.navy, fontFace: "Cambria", margin: 0 });
      s.addText(f.body,  { x: 5.35, y: fy + 0.38, w: 4.0, h: 0.28, fontSize: 8.5, color: C.slate, fontFace: "Calibri", margin: 0 });
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 7 — LAYERS 2 & 3
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.offWhite };
    addSlideHeader(s, "LAYERS 2 & 3", "Federated Health Passport & Disease Surveillance",
      "Patient-owned records + real-time outbreak detection 72 hours ahead of IDSP.");

    // Left: Health Passport
    s.addShape("roundRect", { x: 0.5, y: 1.82, w: 4.4, h: 3.5,
      fill: { color: C.lightBg }, line: { color: C.teal, width: 1.5 }, rectRadius: 0.14, shadow: makeShadow() });
    s.addText("🛡  Federated Health Passport", { x: 0.7, y: 1.98, w: 4.0, h: 0.36, fontSize: 11, bold: true, color: C.navy, fontFace: "Cambria", margin: 0 });
    const passportItems = [
      { icon: iLock,  t: "Universal Health ID",     b: "Lifelong encrypted record issued at first interaction" },
      { icon: iShield,t: "Federated Architecture",  b: "Patient data never leaves their device. PySyft privacy-preserving ML" },
      { icon: iChart, t: "Wearable Integration",    b: "boAt / Noise smartbands, glucometer, BP cuffs via BLE" },
      { icon: iFile,  t: "FHIR R4 Standard",        b: "Any doctor, any hospital sees full history instantly" },
    ];
    passportItems.forEach((p, i) => {
      const py = 2.46 + i * 0.73;
      s.addImage({ data: p.icon, x: 0.7, y: py + 0.12, w: 0.32, h: 0.32 });
      s.addText(p.t, { x: 1.1, y: py + 0.08, w: 3.6, h: 0.26, fontSize: 9.5, bold: true, color: C.navy, fontFace: "Cambria", margin: 0 });
      s.addText(p.b, { x: 1.1, y: py + 0.34, w: 3.6, h: 0.26, fontSize: 8.5, color: C.slate, fontFace: "Calibri", margin: 0 });
    });

    // Right: Surveillance
    s.addShape("roundRect", { x: 5.1, y: 1.82, w: 4.4, h: 3.5,
      fill: { color: C.navy + "0F" }, line: { color: C.amber, width: 1.5 }, rectRadius: 0.14, shadow: makeShadow() });
    s.addText("📡  Disease Surveillance", { x: 5.3, y: 1.98, w: 4.0, h: 0.36, fontSize: 11, bold: true, color: C.navy, fontFace: "Cambria", margin: 0 });

    const survStats = [["72 hrs", "vs 2-week IDSP lag"], ["5 km", "Hyperlocal outbreak radius"]];
    survStats.forEach((st, i) => {
      statBox(s, 5.3 + i * 2.05, 2.45, 1.9, 0.95, st[0], st[1], i === 0 ? C.teal : C.amber);
    });

    const survItems = [
      "Anonymized symptom signals aggregated across geography",
      "200+ fever+cough in 5km / 48hrs → outbreak flag",
      "ASHA worker dashboard with district-level heatmaps",
      "Leaflet.heat heatmap — intensity driven by Outbreak Probability Score",
      "Auto-alert banner fires at 70%+ probability score"
    ];
    s.addText(survItems.map((b, i) => ({
      text: b, options: { bullet: true, breakLine: i < survItems.length - 1, fontSize: 9.5, color: C.slateD, fontFace: "Calibri" }
    })), { x: 5.3, y: 3.55, w: 4.1, h: 1.65 });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 8 — LAYER 4: IoT
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.offWhite };
    addSlideHeader(s, "LAYER 4 — IoT ADHERENCE", "Smart Medication Adherence & Remote Monitoring",
      "A prescription only works if the patient actually takes the medicine.");

    const bigStats = [
      { v: "<40%", l: "Current adherence\nin rural India", c: C.red },
      { v: "3×", l: "Target improvement\nwith VitalBridge", c: C.teal },
      { v: "₹300", l: "Smart pill\ndispenser cost", c: C.amber },
      { v: "BLE", l: "Wireless wearable\ndata sync", c: C.teal }
    ];
    bigStats.forEach((st, i) => statBox(s, 0.5 + i * 2.35, 1.85, 2.1, 1.1, st.v, st.l, st.c));

    const iotFeats = [
      { icon: iPills,  title: "Smart Pill Dispenser",  body: "ESP32 BLE+WiFi. Time-locked compartments. State machine: LOCKED→DOSE_WINDOW→DISPENSED/MISSED. Real BLE GATT event schema." },
      { icon: iBell,   title: "WhatsApp Alerts",        body: "Missed dose → AlertRecord in DB → instant WhatsApp to family + nearest ASHA worker. Zero additional cost." },
      { icon: iHeart,  title: "Wearable Sync",          body: "BLE glucometer for diabetics. Automatic BP cuff for hypertension. Readings flow directly into Health Passport." },
    ];
    iotFeats.forEach((f, i) => featureCard(s, 0.5 + i * 3.1, 3.2, 2.95, 1.98, f.icon, f.title, [f.body], i === 1 ? C.amber : C.teal));
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 9 — ARCHITECTURE
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    addSlideHeader(s, "SYSTEM ARCHITECTURE", "End-to-End Architecture Diagram",
      "Microservices · Event-Driven · Federated · ABDM Compliant", true);

    // Layers
    const layers = [
      { label: "Frontend Layer", color: C.teal, boxes: ["WhatsApp · Voice IVR\nReact Native App", "ASHA Worker\nDashboard", "Doctor Portal\nFHIR Viewer"] },
      { label: "Backend / AI Layer", color: C.amber, boxes: ["AI Triage Engine\nGrok API", "FastAPI\nMicroservices", "IoT Gateway\nESP32 BLE"] },
      { label: "Data Layer", color: "5B86E5", boxes: ["PostgreSQL\nTimescaleDB", "ChromaDB\nRedis Cache", "Apache Kafka\nEvent Stream"] },
      { label: "ML / Infra Layer", color: "A78BFA", boxes: ["PySyft\nFederated ML", "Docker + K8s\nAWS India Region", "ABDM / FHIR R4\nCompliance"] }
    ];
    layers.forEach((layer, li) => {
      const ly = 1.82 + li * 0.92;
      s.addText(layer.label, { x: 0.5, y: ly + 0.28, w: 1.6, h: 0.35,
        fontSize: 8, bold: true, color: layer.color, fontFace: "Calibri", align: "right", margin: 0 });
      layer.boxes.forEach((box, bi) => {
        s.addShape("roundRect", { x: 2.3 + bi * 2.5, y: ly, w: 2.28, h: 0.78,
          fill: { color: "1A2E40" }, line: { color: layer.color, width: 1 }, rectRadius: 0.1 });
        s.addText(box, { x: 2.3 + bi * 2.5, y: ly + 0.08, w: 2.28, h: 0.62,
          fontSize: 8.5, color: C.white, align: "center", fontFace: "Calibri", margin: 0 });
      });
    });

    // Security badge
    s.addShape("roundRect", { x: 0.5, y: 5.05, w: 9.0, h: 0.32,
      fill: { color: C.teal, transparency: 75 }, line: { color: C.teal }, rectRadius: 0.08 });
    s.addText("🔒  AES-256 · DPDP Act · HIPAA · RBAC · Zero-Knowledge Proof · JWT Auth · Pydantic v2 Validation", {
      x: 0.5, y: 5.05, w: 9.0, h: 0.32,
      fontSize: 8.5, color: C.white, align: "center", valign: "middle", fontFace: "Calibri", margin: 0
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 10 — TECH STACK
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.offWhite };
    addSlideHeader(s, "TECHNOLOGY STACK", "Enterprise-Grade, Open-Source-First Stack",
      "Built for scale, interoperability, and India's data sovereignty requirements.");

    const cols = [
      { title: "Frontend", icon: iMobile, color: C.teal, items: ["React Native + Expo (Patient + ASHA)", "React 18 + TypeScript + Vite (Doctor Portal)", "WhatsApp Business API (Triage Bot)", "Twilio Voice API (IVR — 5 languages)"] },
      { title: "AI / ML", icon: iBrain, color: C.amber, items: ["Grok API via OpenAI-compatible SDK", "XGBoost + Random Forest (Risk + Readmission)", "langdetect (Hindi/English auto-detect)", "PySyft (Federated Learning — Privacy)"] },
      { title: "Backend & Data", icon: iDB, color: C.teal, items: ["FastAPI (Python 3.11+) Microservices", "PostgreSQL + SQLAlchemy + Alembic", "Apache Kafka Real-Time Event Streaming", "FHIR R4 Health Record Interoperability"] },
      { title: "IoT & Hardware", icon: iPills, color: C.navyMid, items: ["ESP32 BLE+WiFi Smart Dispenser", "BLE Wearable SDK (boAt / Noise)", "₹300 Smart Pill Dispenser Prototype", "Same BLE GATT schema → real hardware ready"] },
      { title: "Infrastructure", icon: iNet, color: C.teal, items: ["AWS / Azure India Region (Data Sovereignty)", "Docker + Kubernetes (Container Orchestration)", "Redis Caching + ChromaDB (Vector Search)", "One-command docker-compose up"] },
      { title: "Security", icon: iLock, color: C.red, items: ["AES-256 (At Rest + Transit)", "HIPAA-Aligned + DPDP Act Compliant", "Zero-Knowledge Proof (Health ID Verify)", "RBAC across all portals + HMAC-SHA256"] }
    ];
    cols.forEach((col, i) => {
      const cx = 0.5 + (i % 3) * 3.15, cy = 1.82 + Math.floor(i / 3) * 1.88;
      s.addShape("roundRect", { x: cx, y: cy, w: 3.0, h: 1.72,
        fill: { color: col.color === C.red ? "FFF5F5" : C.lightBg },
        line: { color: col.color, width: 1 }, rectRadius: 0.12, shadow: makeShadow() });
      s.addImage({ data: col.icon, x: cx + 0.15, y: cy + 0.12, w: 0.32, h: 0.32 });
      s.addText(col.title, { x: cx + 0.52, y: cy + 0.1, w: 2.35, h: 0.36, fontSize: 10.5, bold: true, color: C.navy, fontFace: "Cambria", margin: 0 });
      s.addText(col.items.map((it, j) => ({
        text: it, options: { bullet: true, breakLine: j < col.items.length - 1, fontSize: 8.5, color: C.slateD, fontFace: "Calibri" }
      })), { x: cx + 0.15, y: cy + 0.5, w: 2.72, h: 1.15 });
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 11 — ROADMAP
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    addSlideHeader(s, "PROJECT ROADMAP", "6-Month Execution Plan",
      "Phased delivery with working prototypes at every milestone.", true);

    const phases = [
      { num: "01", month: "Month 1", title: "MVP Foundation", items: ["WhatsApp AI triage bot (Hindi + Tamil)", "Health Passport backend (FastAPI + PostgreSQL)", "FHIR R4 data schema implementation"] },
      { num: "02", month: "Month 2", title: "Expand & Monitor", items: ["Add Telugu, Kannada, Bengali support", "ASHA worker surveillance dashboard", "Kafka real-time event streaming pipeline"] },
      { num: "03", month: "Month 3", title: "IoT Hardware", items: ["Smart pill dispenser prototype (ESP32)", "Wearable integration (boAt / Noise SDK)", "PySyft federated learning privacy layer"] },
      { num: "04", month: "Month 4–5", title: "Pilot Program", items: ["Pilot: 2 PHCs (Tamil Nadu + UP)", "Onboard 500 beta patients", "ASHA worker training program"] },
      { num: "05", month: "Month 6", title: "Scale & Integrate", items: ["ABDM full integration + ABHA linking", "5 districts — 10,000+ active patients", "Series A preparation with impact data"] },
    ];
    phases.forEach((p, i) => {
      const px = 0.5 + i * 1.9;
      s.addShape("roundRect", { x: px, y: 1.82, w: 1.75, h: 3.3,
        fill: { color: i === 4 ? "1A3A2A" : "1A2E40" },
        line: { color: i === 4 ? C.tealLt : C.teal, width: i === 4 ? 2 : 1 },
        rectRadius: 0.12, shadow: makeShadow() });
      s.addShape("oval", { x: px + 0.52, y: 1.97, w: 0.7, h: 0.7,
        fill: { color: i === 4 ? C.tealLt : C.teal }, line: { color: i === 4 ? C.tealLt : C.teal } });
      s.addText(p.num, { x: px + 0.52, y: 1.97, w: 0.7, h: 0.7, fontSize: 14, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
      s.addText(p.month, { x: px + 0.1, y: 2.76, w: 1.55, h: 0.28, fontSize: 8.5, color: C.tealLt, align: "center", fontFace: "Calibri", bold: true, margin: 0 });
      s.addText(p.title, { x: px + 0.1, y: 3.04, w: 1.55, h: 0.36, fontSize: 9.5, bold: true, color: C.white, align: "center", fontFace: "Cambria", margin: 0 });
      s.addText(p.items.map((it, j) => ({
        text: it, options: { bullet: true, breakLine: j < p.items.length - 1, fontSize: 8, color: "AACCCC", fontFace: "Calibri" }
      })), { x: px + 0.12, y: 3.44, w: 1.5, h: 1.55 });
    });

    s.addText("Round 2 Prototype: WhatsApp AI Triage Bot + Health Passport Dashboard + Live Kafka Streaming Pipeline + F7–F11 Extensions", {
      x: 0.5, y: 5.2, w: 9.0, h: 0.28,
      fontSize: 8.5, color: C.teal, align: "center", italic: true, fontFace: "Calibri", margin: 0
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 12 — IMPACT
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.offWhite };
    addSlideHeader(s, "EXPECTED IMPACT", "Impact That Changes Lives at Scale",
      "Quantifiable outcomes across every layer of the platform.");

    const impStats = [
      { v: "10M+",  l: "Rural patients with first-time\nAI triage access in Year 1", c: C.teal },
      { v: "40%",   l: "Reduction in late-stage\ndisease diagnosis", c: C.amber },
      { v: "3×",    l: "Improvement in chronic\npatient medication adherence", c: C.teal },
      { v: "72 hrs",l: "Outbreak warning\nvs 2-week IDSP lag", c: C.red }
    ];
    impStats.forEach((st, i) => statBox(s, 0.5 + i * 2.35, 1.82, 2.1, 1.25, st.v, st.l, st.c));

    // Gov alignment
    s.addText("Strategic Government Alignment", { x: 0.5, y: 3.3, w: 9.0, h: 0.35, fontSize: 12, bold: true, color: C.navy, fontFace: "Cambria", margin: 0 });
    const govItems = [
      { title: "ABDM Compliant", body: "Fully interoperable with Ayushman Bharat Digital Mission — enabling government partnership from Day 1." },
      { title: "NDHA Integration Ready", body: "Built on FHIR R4 standard mandated by National Digital Health Authority for all new platforms." },
      { title: "PM-JAY Compatible", body: "Works within Pradhan Mantri Jan Arogya Yojana — serving 500M+ beneficiaries directly." }
    ];
    govItems.forEach((g, i) => featureCard(s, 0.5 + i * 3.1, 3.75, 2.95, 1.55, iCheck, g.title, [g.body], C.teal));
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 13 — INNOVATION & USP
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    addSlideHeader(s, "INNOVATION & USP", "What Makes VitalBridge Truly Different",
      "7 exclusive capabilities — no other platform delivers all of them together.", true);

    const usps = [
      { badge: "World's first",     icon: iMobile, title: "Zero-App Triage",         body: "Works on any basic phone via WhatsApp or Voice IVR — no smartphone, no download, no literacy required." },
      { badge: "India-exclusive",   icon: iBrain,  title: "5-Language Voice AI",      body: "Hindi, Tamil, Telugu, Kannada, Bengali — 85% of India natively with fine-tuned medical NLU." },
      { badge: "Patent-worthy",     icon: iShield, title: "Federated Health Passport",body: "Patient data never leaves their device. PySyft privacy-preserving ML — privacy AND portability." },
      { badge: "3× adherence",      icon: iPills,  title: "₹300 IoT Pill Dispenser",  body: "ESP32 smart dispenser with time-locked doses, BLE sync, and WhatsApp miss alerts at ultralow cost." },
      { badge: "vs 2-wk IDSP lag",  icon: iMap,    title: "72-Hr Outbreak Detection", body: "Kafka-powered surveillance — 72 hrs ahead of the 2-week IDSP lag. Saves lives before crises spread." },
      { badge: "Day-1 gov ready",   icon: iLock,   title: "Full ABDM Compliance",     body: "FHIR R4 + ABDM + DPDP Act + HIPAA + ZKP. Government-ready from Day 1." },
    ];
    usps.forEach((u, i) => {
      const ux = 0.5 + (i % 3) * 3.17, uy = 1.82 + Math.floor(i / 3) * 1.85;
      s.addShape("roundRect", { x: ux, y: uy, w: 3.0, h: 1.68,
        fill: { color: "1A2E40" }, line: { color: C.teal }, rectRadius: 0.12, shadow: makeShadow() });
      s.addShape("roundRect", { x: ux + 0.12, y: uy + 0.1, w: 1.5, h: 0.24,
        fill: { color: C.teal, transparency: 30 }, line: { color: C.teal }, rectRadius: 0.06 });
      s.addText(u.badge, { x: ux + 0.12, y: uy + 0.1, w: 1.5, h: 0.24, fontSize: 7.5, bold: true, color: C.white, align: "center", valign: "middle", margin: 0, fontFace: "Calibri" });
      s.addImage({ data: u.icon, x: ux + 0.18, y: uy + 0.4, w: 0.36, h: 0.36 });
      s.addText(u.title, { x: ux + 0.62, y: uy + 0.38, w: 2.25, h: 0.38, fontSize: 10, bold: true, color: C.white, fontFace: "Cambria", margin: 0 });
      s.addText(u.body,  { x: ux + 0.18, y: uy + 0.84, w: 2.7, h: 0.78, fontSize: 8.5, color: "AACCCC", fontFace: "Calibri", margin: 0 });
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 14 — BUSINESS MODEL
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.offWhite };
    addSlideHeader(s, "BUSINESS MODEL", "Sustainable Revenue Beyond the Hackathon",
      "Three revenue streams aligned with India's public health infrastructure.");

    const streams = [
      { icon: iHosp, title: "B2G SaaS — Government PHCs", badge: "Primary Revenue", color: C.teal,
        body: "Monthly subscription per Primary Health Centre. Target: 25,000 PHCs × ₹5,000/month = ₹125 Cr ARR potential." },
      { icon: iChartB, title: "Pharma Partnership — Adherence Data", badge: "Secondary Revenue", color: C.amber,
        body: "Anonymized, aggregated medication adherence analytics to pharma companies. Privacy-preserving via federated learning." },
      { icon: iPills, title: "IoT Hardware — Pill Dispenser", badge: "Hardware Revenue", color: C.navyMid,
        body: "₹300 dispenser sold at cost to government/NGOs. Revenue via ₹50/month connectivity + ₹30/month maintenance SLA." },
    ];
    streams.forEach((st, i) => featureCard(s, 0.5 + i * 3.1, 1.9, 2.95, 2.5, st.icon, st.title, [st.badge, st.body], st.color));

    s.addShape("roundRect", { x: 0.5, y: 4.65, w: 9.0, h: 0.55,
      fill: { color: C.teal + "18" }, line: { color: C.teal }, rectRadius: 0.1 });
    s.addText("Year 1 Target: ₹50L ARR via 100 PHC pilots   |   Year 3 Target: ₹125 Cr ARR via national rollout + pharma data", {
      x: 0.5, y: 4.65, w: 9.0, h: 0.55,
      fontSize: 10.5, bold: true, color: C.teal, align: "center", valign: "middle", fontFace: "Calibri", margin: 0
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 15 — RISKS
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    addSlideHeader(s, "RISKS & MITIGATION", "Real-World Challenges — We Have Answers",
      "Proactive risk management across technical, operational, and regulatory dimensions.", true);

    const risks = [
      ["Data Privacy Breach", "High", "AES-256 encryption + DPDP Act + PySyft federated learning — data never leaves patient device"],
      ["Low-Connectivity Rural Areas", "High", "Offline-first triage; WhatsApp on 2G; ESP32 caches locally and syncs when connected"],
      ["Language Model Accuracy", "Medium", "Fine-tuned on Indian medical corpus + human-in-the-loop escalation; doctors verify AI before treatment"],
      ["IoT Hardware Distribution", "Medium", "Partnership with ASHA workers + PHCs; government procurement via NHM"],
      ["Regulatory Approval (CDSCO)", "Medium", "Positioned as decision-support tool — avoids Class B/C medical device classification"],
      ["API / Third-Party Failure", "Low", "Redundant fallback: WhatsApp→SMS→IVR; multiple cloud providers; Redis cache for offline resilience"]
    ];

    const tableData = [
      [
        { text: "Risk", options: { fill: { color: C.teal }, color: C.white, bold: true, fontSize: 10, fontFace: "Calibri" } },
        { text: "Severity", options: { fill: { color: C.teal }, color: C.white, bold: true, fontSize: 10, align: "center", fontFace: "Calibri" } },
        { text: "Mitigation Strategy", options: { fill: { color: C.teal }, color: C.white, bold: true, fontSize: 10, fontFace: "Calibri" } }
      ],
      ...risks.map((r, i) => [
        { text: r[0], options: { fill: { color: i % 2 === 0 ? "1A2E40" : "152434" }, color: C.white, fontSize: 9, fontFace: "Calibri" } },
        { text: r[1], options: { fill: { color: i % 2 === 0 ? "1A2E40" : "152434" }, color: r[1] === "High" ? "F87171" : r[1] === "Medium" ? C.amber : "4ADE80", bold: true, fontSize: 9, align: "center", fontFace: "Calibri" } },
        { text: r[2], options: { fill: { color: i % 2 === 0 ? "1A2E40" : "152434" }, color: "AACCCC", fontSize: 8.5, fontFace: "Calibri" } }
      ])
    ];
    s.addTable(tableData, {
      x: 0.5, y: 1.85, w: 9.0,
      colW: [2.4, 1.2, 5.4],
      rowH: 0.55,
      border: { pt: 0.5, color: "2A4060" }
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 16 — FUTURE SCOPE
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.offWhite };
    addSlideHeader(s, "FUTURE SCOPE", "Beyond the MVP — VitalBridge at National Scale",
      "Phase 2 innovations that will expand reach, accuracy, and impact.");

    const futures = [
      { icon: iBrain,  title: "AI Diagnostic Enhancements",      body: "Phone camera retinal scan for diabetic retinopathy. Skin lesion analysis. On-device Llama for offline diagnosis." },
      { icon: iMobile, title: "National Language Expansion",      body: "Expand from 5 to 22 scheduled Indian languages. Regional dialect adaptation using community-trained voice models." },
      { icon: iMap,    title: "Predictive Population Health",     body: "District-level chronic disease burden prediction. Seasonal outbreak forecasting using 3-year historical data + climate signals." },
      { icon: iUsers,  title: "Community Health Worker AI",       body: "AI co-pilot for ASHA workers — guided household visits, automated report generation, voice-based data entry." },
      { icon: iNet,    title: "Cross-Border Health Intelligence", body: "SAARC-level disease surveillance network for cross-border outbreak early warning (Bangladesh, Nepal, Myanmar)." },
      { icon: iRocket, title: "Series A & National Rollout",      body: "Raise ₹15 Cr Series A backed by impact metrics. Target 5 states, 50,000 patients by Month 18. NHA MoU by Year 2." },
    ];
    futures.forEach((f, i) => {
      const fx = 0.5 + (i % 3) * 3.17, fy = 1.82 + Math.floor(i / 3) * 1.85;
      featureCard(s, fx, fy, 3.0, 1.68, f.icon, f.title, [f.body], C.teal);
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE 17 — ORIGINAL CLOSING (kept as bridge)
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };

    s.addShape("oval", { x: 7.8, y: -0.8, w: 3.5, h: 3.5, fill: { color: C.teal, transparency: 82 }, line: { color: C.teal, transparency: 82 } });

    s.addText("VitalBridge", { x: 0.5, y: 0.5, w: 9.0, h: 1.0, fontSize: 48, bold: true, color: C.white, fontFace: "Cambria", align: "center", margin: 0 });
    s.addText("Original Platform — Production-Grade Foundation", { x: 0.5, y: 1.55, w: 9.0, h: 0.4, fontSize: 14, color: C.tealLt, align: "center", fontFace: "Calibri", margin: 0 });
    s.addText("4 Integrated Layers · 6 Core Features · Zero Mock Data · One-Command Docker Deployment", {
      x: 0.5, y: 2.05, w: 9.0, h: 0.35, fontSize: 11, color: C.mint, align: "center", italic: true, fontFace: "Calibri", margin: 0
    });

    // 4 layer icons
    const layers4 = [[iBrain, "AI Triage"], [iFile, "Health Passport"], [iMap, "Surveillance"], [iPills, "IoT Adherence"]];
    layers4.forEach((l, i) => {
      s.addImage({ data: l[0], x: 1.3 + i * 2.0, y: 2.6, w: 0.6, h: 0.6 });
      s.addText(l[1], { x: 1.0 + i * 2.0, y: 3.25, w: 1.2, h: 0.28, fontSize: 9, color: C.tealLt, align: "center", fontFace: "Calibri", margin: 0 });
    });

    s.addText("→  F7–F11 Extension Set follows →", { x: 0.5, y: 4.0, w: 9.0, h: 0.35, fontSize: 12, color: C.amber, align: "center", fontFace: "Calibri", margin: 0 });

    s.addText("TEAM CIPHER STRIKE\nDavid Jayaraj A · Jerwin Titus D · Daphne Christina Nelson\nKarunya Institute of Technology and Sciences · Bharat Academix CodeQuest 2026", {
      x: 0.5, y: 4.55, w: 9.0, h: 0.85, fontSize: 9.5, color: "7ECECE", align: "center", fontFace: "Calibri", margin: 0
    });
  }

  // ══════════════════════════════════════════════════════════════
  // ── EXTENSION SET DIVIDER ─────────────────────────────────────
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.teal };

    s.addShape("oval", { x: -1, y: -1, w: 5, h: 5, fill: { color: "0D7A70", transparency: 40 }, line: { color: "0D7A70", transparency: 40 } });
    s.addShape("oval", { x: 7, y: 2.5, w: 4, h: 4, fill: { color: "14B8A6", transparency: 60 }, line: { color: "14B8A6", transparency: 60 } });

    s.addText("ROUND 2 EXTENSION SET", { x: 1.0, y: 0.7, w: 8.0, h: 0.45, fontSize: 13, bold: true, color: C.white, align: "center", fontFace: "Calibri", margin: 0 });
    s.addText("Features 7–11", { x: 1.0, y: 1.25, w: 8.0, h: 1.1, fontSize: 52, bold: true, color: C.white, fontFace: "Cambria", align: "center", margin: 0 });
    s.addText("Proactive. Intelligent. Prevention-First.", { x: 1.0, y: 2.42, w: 8.0, h: 0.4, fontSize: 16, color: C.mint, italic: true, fontFace: "Calibri", align: "center", margin: 0 });

    const fList = [
      "F7 — Drug Interaction Checker",
      "F8 — Predictive 14-Day Readmission Risk",
      "F9 — Household Health Graph",
      "F10 — AI Doctor Handoff Notes",
      "F11 — Vaccination Drive Planner"
    ];
    s.addText(fList.map((f, i) => ({
      text: f, options: { bullet: true, breakLine: i < fList.length - 1, fontSize: 11, color: C.white, fontFace: "Calibri", bold: i === 0 }
    })), { x: 2.5, y: 3.1, w: 5.5, h: 2.0 });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE F7 — DRUG INTERACTION CHECKER
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.offWhite };
    addSlideHeader(s, "F7 — NEW FEATURE", "Drug Interaction Checker",
      "Dangerous drug combinations flagged before the prescription is saved — zero external API, fully offline.");

    // Left: how it works
    s.addShape("roundRect", { x: 0.5, y: 1.82, w: 4.5, h: 3.5,
      fill: { color: C.lightBg }, line: { color: C.teal, width: 1.5 }, rectRadius: 0.14, shadow: makeShadow() });
    s.addText("How It Works", { x: 0.7, y: 1.97, w: 4.1, h: 0.36, fontSize: 11, bold: true, color: C.navy, fontFace: "Cambria", margin: 0 });

    const steps = [
      { n: "1", t: "Doctor types new medication", b: "Field captures drug name on tab-out" },
      { n: "2", t: "Silent background check", b: "POST /api/prescriptions/check-interactions fires" },
      { n: "3", t: "Major → Red modal blocks save", b: "\"⚠ Dangerous Interaction — please review\"" },
      { n: "4", t: "Moderate → amber inline warning", b: "Does not block submission" },
      { n: "5", t: "Override logged in DB", b: "InteractionOverride table with doctor ID + reason" },
    ];
    steps.forEach((st, i) => {
      const sy = 2.42 + i * 0.56;
      s.addShape("oval", { x: 0.7, y: sy, w: 0.34, h: 0.34, fill: { color: C.teal }, line: { color: C.teal } });
      s.addText(st.n, { x: 0.7, y: sy, w: 0.34, h: 0.34, fontSize: 9, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
      s.addText(st.t, { x: 1.12, y: sy, w: 3.7, h: 0.2, fontSize: 9.5, bold: true, color: C.navy, fontFace: "Calibri", margin: 0 });
      s.addText(st.b, { x: 1.12, y: sy + 0.2, w: 3.7, h: 0.2, fontSize: 8.5, color: C.slate, fontFace: "Calibri", margin: 0 });
    });

    // Right: tech details
    const techDetails = [
      { icon: iFlask,  title: "~200 Drug Pairs",         body: "Static JSON bundled at backend. Sourced from WHO Essential Medicines + OpenFDA. Fully offline — zero PHI leaves the server." },
      { icon: iDB,     title: "New: InteractionOverride", body: "prescription_id · drug_a · drug_b · severity · override_reason · doctor_id · timestamp" },
      { icon: iCode,   title: "New endpoint",             body: "POST /api/prescriptions/check-interactions → { interactions: [{ drug_a, drug_b, severity, description }] }" },
      { icon: iShield, title: "Innovation signal",        body: "Blocks harmful prescriptions at point-of-care — addresses a leading cause of preventable hospital readmissions." },
    ];
    techDetails.forEach((td, i) => {
      const ty = 1.82 + i * 0.87;
      s.addShape("roundRect", { x: 5.2, y: ty, w: 4.3, h: 0.78,
        fill: { color: i === 0 ? "FFF5F5" : C.white },
        line: { color: i === 0 ? C.red : C.teal, width: 0.75 }, rectRadius: 0.1, shadow: makeShadow() });
      s.addImage({ data: td.icon, x: 5.35, y: ty + 0.2, w: 0.35, h: 0.35 });
      s.addText(td.title, { x: 5.78, y: ty + 0.08, w: 3.6, h: 0.26, fontSize: 9.5, bold: true, color: C.navy, fontFace: "Cambria", margin: 0 });
      s.addText(td.body,  { x: 5.78, y: ty + 0.36, w: 3.6, h: 0.36, fontSize: 8.5, color: C.slate, fontFace: "Calibri", margin: 0 });
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE F8 — PREDICTIVE READMISSION
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    addSlideHeader(s, "F8 — NEW FEATURE", "Predictive 14-Day Readmission Risk",
      "XGBoost model predicts hospital visit likelihood — ASHA workers alerted before a crisis happens.", true);

    // Left: feature boxes
    const f8Left = [
      { icon: iBrain,  title: "XGBoost ML Model",       body: "Trains at app startup on synthetic seed data. 7 features: missed doses, high-severity triages, abnormal vitals, age, chronic conditions, PHC visit recency, risk score band." },
      { icon: iCal,    title: "Nightly APScheduler Job", body: "Predicts for all active patients every night. Saves to ReadmissionPrediction table with feature_snapshot_json for explainability." },
      { icon: iBell,   title: "Proactive ASHA Alert",   body: "Patient > 70% probability → WhatsApp Business API alert: \"High risk of needing attention in 2 weeks. Please schedule a home visit.\"" },
    ];
    f8Left.forEach((f, i) => {
      const fy = 1.82 + i * 1.22;
      s.addShape("roundRect", { x: 0.5, y: fy, w: 5.2, h: 1.1,
        fill: { color: "1A2E40" }, line: { color: C.teal, width: 1 }, rectRadius: 0.12, shadow: makeShadow() });
      s.addImage({ data: f.icon, x: 0.68, y: fy + 0.35, w: 0.38, h: 0.38 });
      s.addText(f.title, { x: 1.18, y: fy + 0.12, w: 4.3, h: 0.32, fontSize: 10, bold: true, color: C.tealLt, fontFace: "Cambria", margin: 0 });
      s.addText(f.body,  { x: 1.18, y: fy + 0.46, w: 4.3, h: 0.56, fontSize: 8.5, color: "AACCCC", fontFace: "Calibri", margin: 0 });
    });

    // Right: risk column display mock
    s.addShape("roundRect", { x: 5.9, y: 1.82, w: 3.6, h: 3.66,
      fill: { color: "152434" }, line: { color: C.teal }, rectRadius: 0.12 });
    s.addText("Doctor Portal — Patient List", { x: 6.0, y: 1.97, w: 3.4, h: 0.3, fontSize: 9, bold: true, color: C.tealLt, fontFace: "Calibri", margin: 0 });
    const patients = [
      { name: "Priya R.", risk: "87%", color: C.red },
      { name: "Rajan K.", risk: "61%", color: C.amber },
      { name: "Meena S.", risk: "22%", color: "4ADE80" },
    ];
    patients.forEach((p, i) => {
      const py = 2.42 + i * 0.85;
      s.addShape("roundRect", { x: 6.05, y: py, w: 3.3, h: 0.68,
        fill: { color: "1E3048" }, line: { color: "2A4060" }, rectRadius: 0.08 });
      s.addText(p.name, { x: 6.18, y: py + 0.2, w: 1.5, h: 0.28, fontSize: 9.5, color: C.white, fontFace: "Calibri", bold: true, margin: 0 });
      s.addShape("roundRect", { x: 7.8, y: py + 0.22, w: 1.1, h: 0.24, fill: { color: p.color + "33" }, line: { color: p.color }, rectRadius: 0.06 });
      s.addText(p.risk, { x: 7.8, y: py + 0.22, w: 1.1, h: 0.24, fontSize: 9, bold: true, color: p.color, align: "center", valign: "middle", fontFace: "Calibri", margin: 0 });
    });
    s.addText("Click → feature breakdown panel: \"Missed 4 doses this week contributes most to this score\"", {
      x: 5.9, y: 5.05, w: 3.6, h: 0.3, fontSize: 7.5, color: "7ECECE", italic: true, fontFace: "Calibri", margin: 0
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE F9 — HOUSEHOLD HEALTH GRAPH
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.offWhite };
    addSlideHeader(s, "F9 — NEW FEATURE", "Household Health Graph",
      "ASHA workers track entire family units — see aggregate risk, prioritize which households to visit first.");

    // Left: architecture
    s.addShape("roundRect", { x: 0.5, y: 1.82, w: 4.4, h: 3.5,
      fill: { color: C.lightBg }, line: { color: C.teal, width: 1.5 }, rectRadius: 0.14, shadow: makeShadow() });
    s.addText("New Data Model", { x: 0.7, y: 1.97, w: 4.0, h: 0.35, fontSize: 11, bold: true, color: C.navy, fontFace: "Cambria", margin: 0 });
    const dbItems = [
      { icon: iDB,    t: "Household table",       b: "id · village · district · address · asha_worker_id · last_asha_visit" },
      { icon: iUsers, t: "HouseholdMember join",  b: "household_id · patient_id · relationship" },
      { icon: iChart, t: "Household risk score",  b: "Computed as MAX individual risk score — if any member is red, household is red" },
      { icon: iClip,  t: "VisitLog record",       b: "ASHA logs each visit — updates last_asha_visit timestamp" },
    ];
    dbItems.forEach((d, i) => {
      const dy = 2.44 + i * 0.73;
      s.addImage({ data: d.icon, x: 0.7, y: dy + 0.12, w: 0.32, h: 0.32 });
      s.addText(d.t, { x: 1.1, y: dy + 0.08, w: 3.6, h: 0.26, fontSize: 9.5, bold: true, color: C.navy, fontFace: "Cambria", margin: 0 });
      s.addText(d.b, { x: 1.1, y: dy + 0.34, w: 3.6, h: 0.26, fontSize: 8.5, color: C.slate, fontFace: "Calibri", margin: 0 });
    });

    // Right: mock card
    s.addShape("roundRect", { x: 5.1, y: 1.82, w: 4.4, h: 3.5,
      fill: { color: C.navy + "0A" }, line: { color: C.teal }, rectRadius: 0.14, shadow: makeShadow() });
    s.addText("ASHA Dashboard — Households Tab", { x: 5.3, y: 1.97, w: 4.0, h: 0.35, fontSize: 10, bold: true, color: C.navy, fontFace: "Cambria", margin: 0 });

    // Mock household cards
    const hcards = [
      { addr: "12 Raja St, Thanjavur", members: 3, dots: [C.red, C.amber, "4ADE80"], risk: "HIGH", days: "8 days ago" },
      { addr: "45 Gandhi Nagar, Trichy", members: 2, dots: [C.amber, "4ADE80"], risk: "MOD", days: "2 days ago" },
    ];
    hcards.forEach((hc, hi) => {
      const hy = 2.44 + hi * 1.35;
      s.addShape("roundRect", { x: 5.25, y: hy, w: 4.1, h: 1.18,
        fill: { color: C.white }, line: { color: hi === 0 ? C.red : C.amber, width: 1 }, rectRadius: 0.1, shadow: makeShadow() });
      s.addText(hc.addr, { x: 5.42, y: hy + 0.1, w: 3.1, h: 0.26, fontSize: 9.5, bold: true, color: C.navy, fontFace: "Calibri", margin: 0 });
      hc.dots.forEach((dc, di) => {
        s.addShape("oval", { x: 5.42 + di * 0.32, y: hy + 0.42, w: 0.22, h: 0.22, fill: { color: dc }, line: { color: dc } });
      });
      s.addShape("roundRect", { x: 8.1, y: hy + 0.35, w: 1.1, h: 0.32,
        fill: { color: hi === 0 ? C.red + "22" : C.amber + "22" }, line: { color: hi === 0 ? C.red : C.amber }, rectRadius: 0.06 });
      s.addText(hc.risk, { x: 8.1, y: hy + 0.35, w: 1.1, h: 0.32, fontSize: 8.5, bold: true, color: hi === 0 ? C.red : C.amber, align: "center", valign: "middle", fontFace: "Calibri", margin: 0 });
      s.addText("Last visit: " + hc.days, { x: 5.42, y: hy + 0.82, w: 3.7, h: 0.24, fontSize: 8, color: C.slate, fontFace: "Calibri", margin: 0 });
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE F10 — AI DOCTOR HANDOFF NOTES
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    addSlideHeader(s, "F10 — NEW FEATURE", "AI Doctor Handoff Notes",
      "Auto-generated clinical summary when a High-severity triage is escalated — doctor has full context in under 10 seconds.", true);

    // Left: flow
    s.addShape("roundRect", { x: 0.5, y: 1.82, w: 4.5, h: 3.5,
      fill: { color: "152434" }, line: { color: C.teal }, rectRadius: 0.14, shadow: makeShadow() });
    s.addText("Auto-Generation Flow", { x: 0.7, y: 1.97, w: 4.1, h: 0.35, fontSize: 11, bold: true, color: C.tealLt, fontFace: "Cambria", margin: 0 });
    const flowSteps = [
      "High-severity triage assessment fires",
      "Second Grok API call — non-blocking background task",
      "Structured JSON stored in HandoffNote table",
      "Doctor opens queue → card already populated",
      "\"Mark as Reviewed\" logs reviewed_by_doctor_id"
    ];
    flowSteps.forEach((fs, i) => {
      const fy = 2.44 + i * 0.57;
      s.addShape("oval", { x: 0.7, y: fy + 0.06, w: 0.26, h: 0.26, fill: { color: C.teal }, line: { color: C.teal } });
      s.addText(String(i + 1), { x: 0.7, y: fy + 0.06, w: 0.26, h: 0.26, fontSize: 7.5, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
      s.addText(fs, { x: 1.06, y: fy + 0.04, w: 3.8, h: 0.28, fontSize: 9.5, color: "AACCCC", fontFace: "Calibri", margin: 0 });
    });

    // Right: JSON output card
    s.addShape("roundRect", { x: 5.2, y: 1.82, w: 4.3, h: 3.5,
      fill: { color: "152434" }, line: { color: C.amber }, rectRadius: 0.14, shadow: makeShadow() });
    s.addText("Grok Output — Structured Handoff Note", { x: 5.4, y: 1.97, w: 3.9, h: 0.35, fontSize: 10, bold: true, color: C.amber, fontFace: "Cambria", margin: 0 });
    const noteFields = [
      { k: "chief_complaint:", v: "Fever 3 days, headache, body ache" },
      { k: "duration:", v: "3 days (onset progressive)" },
      { k: "associated_symptoms:", v: "Chills, myalgia, loss of appetite" },
      { k: "red_flags:", v: "102°F sustained, dengue suspect" },
      { k: "suggested_exam:", v: "Platelet count, NS1 antigen test" },
      { k: "ai_triage_summary:", v: "High severity — immediate consultation advised" },
    ];
    noteFields.forEach((nf, i) => {
      const ny = 2.44 + i * 0.48;
      s.addText(nf.k, { x: 5.38, y: ny, w: 1.6, h: 0.26, fontSize: 8.5, bold: true, color: C.tealLt, fontFace: "Calibri", margin: 0 });
      s.addText(nf.v, { x: 7.0, y: ny, w: 2.35, h: 0.26, fontSize: 8.5, color: "AACCCC", fontFace: "Calibri", margin: 0 });
    });
    s.addShape("roundRect", { x: 5.38, y: 5.1, w: 2.0, h: 0.22,
      fill: { color: C.teal + "33" }, line: { color: C.teal }, rectRadius: 0.04 });
    s.addText("✓  Mark as Reviewed", { x: 5.38, y: 5.1, w: 2.0, h: 0.22, fontSize: 7.5, color: C.tealLt, align: "center", valign: "middle", fontFace: "Calibri", margin: 0 });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE F11 — VACCINATION DRIVE PLANNER
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.offWhite };
    addSlideHeader(s, "F11 — NEW FEATURE", "Vaccination Drive Planner",
      "District health officers replace manual Excel planning with AI-prioritized outreach lists based on risk + demographics.");

    // Left features
    const f11Feats = [
      { icon: iSyringe, title: "Prioritized Patient List",  body: "Target age group, no recorded vaccination, sorted by risk score descending, with household address for geographic clustering." },
      { icon: iMap,     title: "Geographic Clustering",     body: "ASHA workers do area-by-area outreach efficiently — households on the same street batched together." },
      { icon: iClip,    title: "Officer CSV Export",        body: "Full plan exportable. Officer selects subset → \"Assign to ASHA Workers\" → task appears in mobile dashboard." },
      { icon: iCheck,   title: "ASHA Mobile Tasks",         body: "\"Vaccination Tasks\" tab shows assigned patients. \"Mark Vaccinated\" fires POST /api/vaccination/record and adds to FHIR Passport." },
    ];
    f11Feats.forEach((f, i) => {
      const fy = 1.82 + i * 0.93;
      s.addShape("roundRect", { x: 0.5, y: fy, w: 5.1, h: 0.82,
        fill: { color: i % 2 === 0 ? C.lightBg : C.white },
        line: { color: C.teal, width: 0.75 }, rectRadius: 0.1, shadow: makeShadow() });
      s.addImage({ data: f.icon, x: 0.68, y: fy + 0.22, w: 0.36, h: 0.36 });
      s.addText(f.title, { x: 1.15, y: fy + 0.1, w: 4.3, h: 0.28, fontSize: 10, bold: true, color: C.navy, fontFace: "Cambria", margin: 0 });
      s.addText(f.body,  { x: 1.15, y: fy + 0.42, w: 4.3, h: 0.34, fontSize: 8.5, color: C.slate, fontFace: "Calibri", margin: 0 });
    });

    // Right: mock table
    s.addShape("roundRect", { x: 5.8, y: 1.82, w: 3.7, h: 3.72,
      fill: { color: C.lightBg }, line: { color: C.teal }, rectRadius: 0.12, shadow: makeShadow() });
    s.addText("Polio Drive — Chennai District", { x: 5.98, y: 1.95, w: 3.3, h: 0.32, fontSize: 9.5, bold: true, color: C.navy, fontFace: "Cambria", margin: 0 });

    // Table header
    const colW2 = [1.4, 0.45, 0.55, 0.95];
    s.addTable([
      [
        { text: "Patient", options: { fill: { color: C.teal }, color: C.white, bold: true, fontSize: 8, fontFace: "Calibri" } },
        { text: "Age", options: { fill: { color: C.teal }, color: C.white, bold: true, fontSize: 8, align: "center", fontFace: "Calibri" } },
        { text: "Risk", options: { fill: { color: C.teal }, color: C.white, bold: true, fontSize: 8, align: "center", fontFace: "Calibri" } },
        { text: "ASHA Worker", options: { fill: { color: C.teal }, color: C.white, bold: true, fontSize: 8, fontFace: "Calibri" } }
      ],
      ...["Arjun M., 3 months|3M|High|Kavitha R.", "Preethi S., 18mo|18M|Med|Kavitha R.", "Rahul D., 2 yrs|2Y|Low|Seetha P.", "Anjali K., 9mo|9M|High|Seetha P.", "Bala R., 5 yrs|5Y|Low|Kavitha R."].map((r, ri) => {
        const [name, age, risk, asha] = r.split("|");
        const rcolor = risk === "High" ? "F87171" : risk === "Med" ? C.amber : "4ADE80";
        return [
          { text: name, options: { fill: { color: ri % 2 === 0 ? C.white : "F0FDFA" }, color: C.slateD, fontSize: 8, fontFace: "Calibri" } },
          { text: age, options: { fill: { color: ri % 2 === 0 ? C.white : "F0FDFA" }, color: C.slateD, fontSize: 8, align: "center", fontFace: "Calibri" } },
          { text: risk, options: { fill: { color: ri % 2 === 0 ? C.white : "F0FDFA" }, color: rcolor, fontSize: 8, bold: true, align: "center", fontFace: "Calibri" } },
          { text: asha, options: { fill: { color: ri % 2 === 0 ? C.white : "F0FDFA" }, color: C.slateD, fontSize: 7.5, fontFace: "Calibri" } }
        ];
      })
    ], { x: 5.92, y: 2.34, w: 3.45, colW: colW2, rowH: 0.38, border: { pt: 0.5, color: "D1FAF0" } });

    s.addText("47 patients total  |  Export CSV  |  Assign to ASHA Workers", {
      x: 5.9, y: 5.12, w: 3.5, h: 0.26, fontSize: 7.5, color: C.teal, align: "center", fontFace: "Calibri", margin: 0
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE — INTEGRATION CHECKLIST
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    addSlideHeader(s, "DEMO CHECKLIST", "End-to-End Integration Verified",
      "Zero console errors · Zero broken buttons · Zero hanging loaders · Zero mock data outside seed.py", true);

    const checks = [
      { step: "01", label: "Voice Input → Hindi AI Triage", body: "Patient speaks → Devanagari transcript fills input → Grok streams Hindi response token-by-token" },
      { step: "02", label: "High Severity → Doctor Queue", body: "AI assesses High → real DB entry → WebSocket broadcasts to doctor portal without page refresh" },
      { step: "03", label: "Risk Score Gauge Animates", body: "New triage fires risk_score_service.py → Risk Gauge needle animates to Red band on doctor view" },
      { step: "04", label: "PDF + QR Download", body: "ReportLab generates PDF in <2s · Hindi Devanagari renders correctly · QR code is scannable" },
      { step: "05", label: "Prescription QR Verification", body: "Pharmacist opens /verify/{token} → animated green checkmark → HMAC-SHA256 signature validates" },
      { step: "06", label: "Outbreak Heatmap Alert", body: "Chennai district > 70% → auto-alert red banner fires: \"⚠ Elevated outbreak risk — Score: 78%\"" },
      { step: "07", label: "IoT Dispenser State Machine", body: "LOCKED → DOSE_WINDOW_OPEN → MISSED → AlertRecord in DB → family alert panel shows notification" },
      { step: "08", label: "Drug Interaction Block (F7)", body: "Doctor types Metformin for Warfarin patient → red modal blocks save before prescription is written" },
      { step: "09", label: "Readmission Risk Column (F8)", body: "Patient with 4 missed doses + 2 high triages → red 87% bar in doctor's patient list" },
      { step: "10", label: "AI Handoff Note Pre-populated (F10)", body: "Doctor opens escalated queue → handoff card already shows chief complaint + red flags before reading chat" },
    ];
    const mid = Math.ceil(checks.length / 2);
    [checks.slice(0, mid), checks.slice(mid)].forEach((col, ci) => {
      col.forEach((c, i) => {
        const cx = 0.5 + ci * 4.75, cy = 1.82 + i * 0.74;
        s.addShape("roundRect", { x: cx, y: cy, w: 4.55, h: 0.64,
          fill: { color: "1A2E40" }, line: { color: C.teal, width: 0.75 }, rectRadius: 0.08, shadow: makeShadow() });
        s.addShape("roundRect", { x: cx + 0.1, y: cy + 0.17, w: 0.32, h: 0.3,
          fill: { color: C.teal }, line: { color: C.teal }, rectRadius: 0.05 });
        s.addText(c.step, { x: cx + 0.1, y: cy + 0.17, w: 0.32, h: 0.3, fontSize: 7.5, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
        s.addText(c.label, { x: cx + 0.5, y: cy + 0.06, w: 3.95, h: 0.26, fontSize: 9, bold: true, color: C.white, fontFace: "Cambria", margin: 0 });
        s.addText(c.body,  { x: cx + 0.5, y: cy + 0.34, w: 3.95, h: 0.26, fontSize: 7.5, color: "7ECECE", fontFace: "Calibri", margin: 0 });
      });
    });
  }

  // ══════════════════════════════════════════════════════════════
  // SLIDE — FINAL CLOSING
  // ══════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };

    s.addShape("oval", { x: 7.5, y: -1.0, w: 4.0, h: 4.0, fill: { color: C.teal, transparency: 82 }, line: { color: C.teal, transparency: 82 } });
    s.addShape("oval", { x: -1.0, y: 3.0, w: 3.0, h: 3.0, fill: { color: C.tealLt, transparency: 80 }, line: { color: C.tealLt, transparency: 80 } });

    s.addText("VitalBridge", { x: 0.5, y: 0.45, w: 9.0, h: 0.95, fontSize: 48, bold: true, color: C.white, fontFace: "Cambria", align: "center", margin: 0 });
    s.addText("Every Indian deserves the same quality of healthcare that a city hospital provides.", {
      x: 0.8, y: 1.48, w: 8.4, h: 0.55, fontSize: 13.5, color: C.mint, align: "center", italic: true, fontFace: "Calibri", margin: 0
    });

    s.addText("VitalBridge is the bridge to solve Indian problems.", {
      x: 0.5, y: 2.12, w: 9.0, h: 0.38, fontSize: 12, color: C.tealLt, align: "center", fontFace: "Calibri", margin: 0
    });

    // 5 layer icons closing summary
    const closing = [
      [iBrain, "AI Triage"],
      [iFile, "Health Passport"],
      [iMap, "Surveillance"],
      [iPills, "IoT Adherence"],
      [iFlask, "F7–F11\nExtensions"]
    ];
    closing.forEach((c, i) => {
      s.addImage({ data: c[0], x: 0.6 + i * 1.8, y: 2.7, w: 0.55, h: 0.55 });
      s.addText(c[1], { x: 0.35 + i * 1.8, y: 3.32, w: 1.1, h: 0.36, fontSize: 8, color: C.tealLt, align: "center", fontFace: "Calibri", margin: 0 });
    });

    // Stats row
    const cStats = [["10M+", "patients Year 1"], ["72hrs", "outbreak warning"], ["40%", "late diagnosis↓"], ["3×", "adherence↑"]];
    cStats.forEach((cs, i) => {
      s.addShape("roundRect", { x: 0.5 + i * 2.35, y: 3.88, w: 2.15, h: 0.72,
        fill: { color: C.teal + "28" }, line: { color: C.teal }, rectRadius: 0.1 });
      s.addText(cs[0], { x: 0.5 + i * 2.35, y: 3.9, w: 2.15, h: 0.38, fontSize: 18, bold: true, color: C.tealLt, align: "center", fontFace: "Cambria", margin: 0 });
      s.addText(cs[1], { x: 0.5 + i * 2.35, y: 4.28, w: 2.15, h: 0.26, fontSize: 8, color: C.mint, align: "center", fontFace: "Calibri", margin: 0 });
    });

    s.addText("TEAM CIPHER STRIKE", { x: 0.5, y: 4.76, w: 9.0, h: 0.28, fontSize: 10, bold: true, color: C.tealLt, align: "center", fontFace: "Calibri", margin: 0 });
    s.addText("David Jayaraj A · AI/ML Engineer   |   Jerwin Titus D · Full Stack Developer   |   Daphne Christina Nelson · IoT & Systems", {
      x: 0.5, y: 5.06, w: 9.0, h: 0.26, fontSize: 8.5, color: "7ECECE", align: "center", fontFace: "Calibri", margin: 0
    });
    s.addText("Karunya Institute of Technology and Sciences  ·  Bharat Academix CodeQuest 2026", {
      x: 0.5, y: 5.33, w: 9.0, h: 0.24, fontSize: 8, color: C.slate, align: "center", fontFace: "Calibri", margin: 0
    });

    s.addText("Innovate. Build. Impact.", { x: 0.5, y: 5.35, w: 9.0, h: 0.25, fontSize: 0.01, color: C.navy, align: "center", margin: 0 }); // spacer
  }

  await pres.writeFile({ fileName: "VitalBridge_Round2.pptx" });
  console.log("Done");
}

buildDeck().catch(console.error);
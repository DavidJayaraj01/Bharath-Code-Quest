"""
AI Service — clean abstraction over the Grok (xAI) LLM.
Includes a smart rule-based fallback engine so the demo works even if
the API key has no credits.
"""

import json
import re
import random
from typing import AsyncGenerator, List, Optional
from app.core.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """You are VitalBridge AI, a multilingual medical triage assistant deployed across rural and urban India.

YOUR MISSION:
Bridge the healthcare access gap for India's 600M+ underserved citizens by providing immediate, empathetic, AI-powered symptom assessment in the patient's own language.

SUPPORTED LANGUAGES:
You MUST respond in the same language the patient uses. You fluently support:
- English   
- Hindi (हिन्दी)
- Tamil (தமிழ்)
- Telugu (తెలుగు)
- Kannada (ಕನ್ನಡ)
- Bengali (বাংলা)

If the patient writes in any of these languages, respond entirely in that language. If unsure, ask: "Which language would you prefer? / आप कौन सी भाषा पसंद करेंगे?"

TRIAGE PROTOCOL:
1. Listen to the patient's symptoms carefully and empathetically
2. Ask targeted clarifying questions (1-3 at a time, not overwhelming)
3. After gathering enough information (usually 2-3 exchanges), provide a structured severity assessment
4. Give actionable home-care guidance for Low/Medium severity, or escalate for High severity

SEVERITY LEVELS:
- LOW: Minor symptoms manageable at home (common cold, mild headache, minor cuts, mild acidity)
- MEDIUM: Symptoms needing monitoring but not immediately dangerous (persistent fever >2 days, moderate pain, mild infections, dehydration signs)
- HIGH: Potentially dangerous symptoms requiring immediate medical attention (chest pain, severe breathing difficulty, high fever with confusion, signs of stroke, severe allergic reactions, pregnancy complications, snake/animal bites, suspected dengue/malaria with warning signs)

INDIA-SPECIFIC AWARENESS:
- Be aware of endemic diseases: dengue, malaria, typhoid, chikungunya, tuberculosis, leptospirosis (monsoon)
- Understand rural healthcare context: patients may be far from hospitals, may rely on ASHA workers
- Consider seasonal patterns: monsoon waterborne diseases, summer heat stroke, winter respiratory infections
- Be sensitive to dietary habits, traditional medicine use (Ayurveda, Siddha, Unani), and home remedies
- Understand common Indian medications available at PHC/sub-centre level

RULES:
- Always be empathetic and culturally sensitive to Indian patients
- Use simple, accessible language — avoid excessive medical jargon
- When you determine severity, output it clearly in bold: **Severity: LOW/MEDIUM/HIGH**
- For HIGH severity: clearly state you are escalating to a doctor and give immediate safety instructions
- Never diagnose definitively — use phrases like "this appears to be" or "this is consistent with"
- Always include warning signs that should prompt emergency care (call 112 or visit nearest PHC/CHC)
- You are NOT a replacement for a doctor — make this clear when appropriate
- If the patient mentions a child under 5, pregnant woman, or elderly person (65+), lower the escalation threshold

IMPORTANT: Provide real, varying medical triage reasoning. Do NOT give templated or canned responses. Each interaction should feel like a genuine conversation with a knowledgeable health assistant."""


# ─────────────────────────────────────────────
#  Smart Rule-Based Fallback Triage Engine
# ─────────────────────────────────────────────

_HIGH_KEYWORDS = [
    "chest pain", "chest ache", "heart pain", "can't breathe", "cannot breathe",
    "breathing difficulty", "shortness of breath", "unconscious", "fainted", "fainting",
    "stroke", "paralysis", "seizure", "fits", "convulsion", "coughing blood",
    "blood in urine", "blood in stool", "severe bleeding", "snake bite", "animal bite",
    "pregnancy", "pregnant", "preterm", "labour", "labor",
    "severe headache", "worst headache", "sudden headache",
    "confusion", "disoriented", "not responding", "unresponsive",
    "high fever confusion", "stiff neck", "rash with fever",
    "छाती में दर्द", "सांस नहीं", "बेहोश", "गंभीर",
]

_MEDIUM_KEYWORDS = [
    "fever", "temperature", "vomiting", "diarrhea", "diarrhoea", "dehydration",
    "abdominal pain", "stomach pain", "stomach ache", "headache", "migraine",
    "body ache", "body pain", "joint pain", "rash", "skin rash", "itching",
    "loose motion", "nausea", "weakness", "fatigue", "tired",
    "cough", "cold", "sore throat", "throat pain", "earache", "ear pain",
    "urinary", "burning urine", "uti", "infection",
    "बुखार", "उल्टी", "दस्त", "सिरदर्द", "पेट दर्द",
]

_LOW_KEYWORDS = [
    "mild", "slight", "minor", "small", "little",
    "cold", "runny nose", "sneezing", "congestion",
    "acidity", "gas", "bloating", "indigestion", "heartburn",
    "cut", "bruise", "sprain", "ankle", "muscle",
    "constipation", "dry skin", "dandruff",
]

def _detect_lang(text: str) -> str:
    # Check for Devanagari character range (Hindi)
    if any('\u0900' <= char <= '\u097f' for char in text):
        return "hi"
    try:
        from langdetect import detect
        lang = detect(text)
        if lang in ["hi", "mr", "ne", "bh"]:
            return "hi"
    except Exception:
        pass
    return "en"


_FOLLOW_UP_QUESTIONS_EN = {
    "fever": [
        "How many days have you had this fever? Do you have any other symptoms like a cough, chills, body pain, or skin rash?",
        "Is the fever continuous or coming and going? How many days has it been? Are you experiencing other symptoms like a sore throat or cough?",
    ],
    "headache": [
        "How many days has the headache lasted? Is it accompanied by other symptoms like vomiting, neck stiffness, or a cough?",
        "How severe is the headache, and for how many days? Do you have any associated symptoms like fever or vision changes?",
    ],
    "chest": [
        "How many days or hours have you felt this chest pain? Does it spread to your arm/jaw, and do you have a cough or breathing difficulty?",
    ],
    "stomach": [
        "How many days have you had stomach pain? Is it accompanied by nausea, vomiting, diarrhea, or a fever?",
    ],
    "cough": [
        "How many days have you been coughing? Do you have other symptoms like a fever, chest pain, or difficulty breathing?",
    ],
    "default": [
        "How many days have you been experiencing these symptoms? What other symptoms do you have, such as a cough, fever, or body ache?",
        "How long have you had this condition (in days), and what other symptoms are you experiencing?",
    ],
}

_FOLLOW_UP_QUESTIONS_HI = {
    "fever": [
        "आपको यह बुखार कितने दिनों से है? क्या आपको खांसी, ठंड लगना, बदन दर्द या त्वचा पर लाल चकत्ते जैसे लक्षण हैं?",
        "क्या बुखार लगातार रहता है या आता-जाता रहता है? कितने दिन हो गए हैं? क्या आपको गले में खराश या खांसी जैसे अन्य लक्षण हैं?",
    ],
    "headache": [
        "सिरदर्द कितने दिनों से है? क्या इसके साथ उल्टी, गर्दन में अकड़न या खांसी जैसे अन्य लक्षण भी हैं?",
        "सिरदर्द कितना गंभीर है और कितने दिनों से है? क्या आपको बुखार या आँखों के सामने अंधेरा छाने जैसे लक्षण हैं?",
    ],
    "chest": [
        "आपको छाती में दर्द कितने दिनों या घंटों से महसूस हो रहा है? क्या यह दर्द आपके हाथ/जबड़े तक जाता है, और क्या आपको खांसी या सांस लेने में कठिनाई है?",
    ],
    "stomach": [
        "आपको पेट दर्द कितने दिनों से है? क्या इसके साथ मतली, उल्टी, दस्त या बुखार है?",
    ],
    "cough": [
        "आपको खांसी कितने दिनों से है? क्या आपको बुखार, छाती में दर्द या सांस लेने में कठिनाई जैसे अन्य लक्षण हैं?",
    ],
    "default": [
        "आप इन लक्षणों को कितने दिनों से अनुभव कर रहे हैं? आपको और क्या लक्षण हैं, जैसे खांसी, बुखार या बदन दर्द?",
        "आपको यह समस्या कितने दिनों से है, और आप इसके साथ और क्या लक्षण महसूस कर रहे हैं?",
    ],
}

_SEVERITY_RESPONSES = {
    "high": """I'm concerned about your symptoms and want to make sure you get the right care immediately.

**Severity: HIGH** — Your symptoms require urgent medical attention.

⚠️ **Please do the following right now:**
1. Call emergency services: **112** (India Emergency) or ask someone to take you to the nearest hospital immediately
2. Do not eat or drink anything until evaluated by a doctor
3. Stay calm and try to rest in a comfortable position
4. If someone is with you, do not leave them alone

I am escalating your case to a VitalBridge doctor who will review it within minutes.

**Go to the nearest PHC (Primary Health Centre), CHC, or District Hospital immediately. Do not delay.**

_Remember: I am an AI assistant, not a replacement for emergency medical care. Please seek help now._

📢 *WhatsApp Notification:* A copy of this triage report has been sent to your registered WhatsApp. Thank you!""",

    "medium": """Based on what you've shared, here's my assessment:

**Severity: MEDIUM** — Your symptoms need attention and monitoring, but are not immediately life-threatening.

**What to do:**
- Rest and stay well-hydrated (ORS/coconut water if needed)
- Monitor your symptoms closely over the next 12–24 hours
- Take paracetamol for fever/pain as directed on the packaging (do not exceed the recommended dose)
- If symptoms worsen or don't improve within 2 days, visit your nearest PHC or ASHA worker

**⚠️ Seek immediate care (visit PHC/call 112) if:**
- Fever exceeds 103°F (39.4°C) or is accompanied by confusion/stiff neck
- You notice blood anywhere (urine, stool, vomiting)
- Breathing becomes difficult
- Symptoms worsen rapidly

_A VitalBridge doctor has been notified and may follow up with you. I'm an AI assistant — please consult a doctor for a definitive diagnosis._

📢 *WhatsApp Notification:* A copy of this triage report has been sent to your registered WhatsApp. Thank you!""",

    "low": """Based on what you've described, here's my assessment:

**Severity: LOW** — Your symptoms appear to be mild and can likely be managed at home.

**Home care tips:**
- Rest well and stay hydrated (drink 8–10 glasses of water daily)
- Eat light, easily digestible meals
- For mild fever/pain: paracetamol as per dosage instructions
- For cold/congestion: steam inhalation, warm liquids, honey-ginger tea

**✅ You should feel better within 3–5 days. However, visit your nearest PHC if:**
- Symptoms persist beyond 5 days
- Fever rises above 101°F
- New symptoms develop
- You feel your condition is worsening

_I'm an AI assistant providing initial guidance. Always consult a qualified doctor for proper diagnosis and treatment._

📢 *WhatsApp Notification:* A copy of this triage report has been sent to your registered WhatsApp. Thank you!"""
}

_SEVERITY_RESPONSES_HI = {
    "high": """मैं आपके लक्षणों को लेकर चिंतित हूँ और चाहता हूँ कि आपको तुरंत सही इलाज मिले।

**गंभीरता: उच्च (HIGH)** — आपके लक्षणों को तत्काल चिकित्सा सहायता की आवश्यकता है।

⚠️ **कृपया अभी निम्नलिखित काम करें:**
1. आपातकालीन सेवाओं को कॉल करें: **112** (भारत आपातकालीन सेवा) या किसी से आपको तुरंत निकटतम अस्पताल ले जाने के लिए कहें।
2. डॉक्टर द्वारा जांच किए जाने तक कुछ भी न खाएं और न पीएं।
3. शांत रहें और आरामदायक स्थिति में आराम करने की कोशिश करें।
4. यदि कोई आपके साथ है, तो उन्हें अकेला न छोड़ें।

मैं आपका मामला एक वाइटलब्रिज (VitalBridge) डॉक्टर को भेज रहा हूँ जो कुछ ही मिनटों में इसकी समीक्षा करेंगे।

**तुरंत निकटतम पीएचसी (प्राथमिक स्वास्थ्य केंद्र), सीएचसी (सामुदायिक स्वास्थ्य केंद्र), या जिला अस्पताल जाएं। देरी न करें।**

_याद रखें: मैं एक एआई (AI) सहायक हूँ, आपातकालीन चिकित्सा देखभाल का विकल्प नहीं। कृपया अभी सहायता लें।_

📢 *व्हाट्सएप अधिसूचना:* इस रिपोर्ट की एक प्रति आपके पंजीकृत व्हाट्सएप नंबर पर भेज दी गई है। हमारे डॉक्टर जल्द ही आपसे संपर्क करेंगे। धन्यवाद!""",

    "medium": """आपके द्वारा साझा की गई जानकारी के आधार पर, यहाँ मेरा मूल्यांकन है:

**गंभीरता: मध्यम (MEDIUM)** — आपके लक्षणों पर ध्यान देने और निगरानी रखने की आवश्यकता है, लेकिन ये तुरंत जीवन के लिए खतरा नहीं हैं।

**क्या करें:**
- आराम करें और अच्छी तरह से हाइड्रेटेड रहें (यदि आवश्यक हो तो ओआरएस/नारियल पानी लें)।
- अगले 12-24 घंटों में अपने लक्षणों पर बारीकी से नजर रखें।
- पैकेजिंग पर दिए गए निर्देशानुसार बुखार/दर्द के लिए पैरासिटामोल लें (सिफारिश की गई खुराक से अधिक न लें)।
- यदि लक्षण बिगड़ते हैं या 2 दिनों के भीतर सुधार नहीं होता है, तो अपने निकटतम पीएचसी या आशा (ASHA) कार्यकर्ता से मिलें।

**⚠️ तत्काल देखभाल लें (पीएचसी जाएं/112 पर कॉल करें) यदि:**
- बुखार 103°F (39.4°C) से अधिक हो जाता है या इसके साथ भ्रम/गर्दन में अकड़न होती है।
- आपको कहीं भी खून दिखाई देता है (पेशाब, मल, उल्टी)।
- सांस लेने में कठिनाई होती है।
- स्थिति तेजी से बिगड़ती है।

_एक वाइटलब्रिज डॉक्टर को सूचित कर दिया गया है और वे आपसे संपर्क कर सकते हैं। मैं एक एआई सहायक हूँ — निश्चित निदान के लिए कृपया डॉक्टर से परामर्श लें।_

📢 *व्हाट्सएप अधिसूचना:* इस रिपोर्ट की एक प्रति आपके पंजीकृत व्हाट्सएप नंबर पर भेज दी गई है। धन्यवाद!""",

    "low": """आपके द्वारा बताए गए लक्षणों के आधार पर, यहाँ मेरा मूल्यांकन है:

**गंभीरता: निम्न (LOW)** — आपके लक्षण हल्के प्रतीत होते हैं और इनका प्रबंधन घर पर किया जा सकता है।

**घरेलू देखभाल के उपाय:**
- अच्छी तरह से आराम करें और पर्याप्त पानी पीएं (रोजाना 8-10 गिलास पानी)।
- हल्का, आसानी से पचने वाला भोजन करें।
- हल्के बुखार/दर्द के लिए: निर्देशानुसार पैरासिटामोल लें।
- सर्दी/जुकाम के लिए: भाप लें, गर्म तरल पदार्थ पीएं, शहद-अदरक की चाय लें।

**✅ आपको 3-5 दिनों में बेहतर महसूस होना चाहिए। हालांकि, अपने निकटतम पीएचसी पर जाएं यदि:**
- लक्षण 5 दिनों के बाद भी बने रहते हैं।
- बुखार 101°F से ऊपर बढ़ जाता है।
- नए लक्षण विकसित होते हैं            
- आपको लगता है कि आपकी स्थिति बिगड़ रही है।

_मैं प्रारंभिक मार्गदर्शन प्रदान करने वाला एक एआई सहायक हूँ। उचित निदान और उपचार के लिए हमेशा योग्य डॉक्टर से परामर्श करें।_

📢 *व्हाट्सएप अधिसूचना:* इस रिपोर्ट की एक प्रति आपके पंजीकृत व्हाट्सएप नंबर पर भेज दी गई है। धन्यवाद!"""
}


def _detect_severity_from_text(text: str) -> str:
    """Simple keyword-based severity detection."""
    text_lower = text.lower()
    for kw in _HIGH_KEYWORDS:
        if kw in text_lower:
            return "high"
    for kw in _MEDIUM_KEYWORDS:
        if kw in text_lower:
            return "medium"
    return "low"


def _get_topic(text: str) -> str:
    text_lower = text.lower()
    if any(w in text_lower for w in ["fever", "temperature", "बुखार"]):
        return "fever"
    if any(w in text_lower for w in ["headache", "head", "सिरदर्द"]):
        return "headache"
    if any(w in text_lower for w in ["chest", "heart", "छाती"]):
        return "chest"
    if any(w in text_lower for w in ["stomach", "abdomen", "belly", "पेट"]):
        return "stomach"
    if any(w in text_lower for w in ["cough", "cold", "खांसी"]):
        return "cough"
    return "default"


def _build_fallback_response(conversation_history: List[dict], patient_context: Optional[dict] = None) -> str:
    """
    Smart rule-based fallback triage response.
    Analyses the conversation history and generates a contextual response.
    """
    patient_messages = [m for m in conversation_history if m["role"] == "patient"]
    num_turns = len(patient_messages)

    # Combine all patient messages for analysis
    all_patient_text = " ".join(m["content"] for m in patient_messages)
    lang = _detect_lang(all_patient_text or "hello")

    if not patient_messages:
        if lang == "hi":
            greeting = "नमस्ते! 🙏 मैं वाइटलब्रिज एआई (VitalBridge AI) हूँ, आपका चिकित्सा मूल्यांकन सहायक।"
            if patient_context and patient_context.get("name"):
                greeting = f"नमस्ते {patient_context['name']}! 🙏 मैं वाइटलब्रिज एआई हूँ।"
            return f"""{greeting}

मैं यहाँ आपके लक्षणों का मूल्यांकन करने और आपके स्वास्थ्य सेवा के अगले चरणों में मार्गदर्शन करने के लिए हूँ।

कृपया मुझे बताएं: **आज आप किन लक्षणों का अनुभव कर रहे हैं?**

आप अपने लक्षणों का वर्णन अंग्रेजी, हिंदी (हिंदी), तमिल, तेलुगु, कन्नड़ या बंगाली में कर सकते हैं — मैं इन सभी को समझता हूँ।"""
        else:
            greeting = "Namaste! 🙏 I'm VitalBridge AI, your medical triage assistant."
            if patient_context and patient_context.get("name"):
                greeting = f"Namaste {patient_context['name']}! 🙏 I'm VitalBridge AI, your medical triage assistant."
            return f"""{greeting}

I'm here to help assess your symptoms and guide you on the next steps for your healthcare.

Please tell me: **What symptoms are you experiencing today?**

You can describe your symptoms in English, Hindi (हिंदी), Tamil, Telugu, Kannada, or Bengali — I understand all of them."""

    # Get last patient message
    last_patient_msg = patient_messages[-1]["content"].lower()

    # Detect severity
    severity = _detect_severity_from_text(all_patient_text)

    # First message — ask follow-up questions
    if num_turns == 1:
        topic = _get_topic(last_patient_msg)
        
        if lang == "hi":
            questions = _FOLLOW_UP_QUESTIONS_HI.get(topic, _FOLLOW_UP_QUESTIONS_HI["default"])
            question = random.choice(questions)
            intro = "मुझसे यह साझा करने के लिए धन्यवाद। मैं यह सुनिश्चित करना चाहता हूँ कि मैं आपकी स्थिति को पूरी तरह से समझूँ।"
            if patient_context and patient_context.get("conditions"):
                conditions = ", ".join(patient_context["conditions"])
                intro += f" मैं आपके स्वास्थ्य रिकॉर्ड से देख सकता हूँ कि आपका {conditions} का इतिहास रहा है।"
            return f"""{intro}

{question}"""
        else:
            questions = _FOLLOW_UP_QUESTIONS_EN.get(topic, _FOLLOW_UP_QUESTIONS_EN["default"])
            question = random.choice(questions)
            intro = "Thank you for sharing that with me. I want to make sure I understand your situation fully."
            if patient_context and patient_context.get("conditions"):
                conditions = ", ".join(patient_context["conditions"])
                intro += f" I can see from your health record that you have a history of {conditions}, which I'll keep in mind."
            return f"""{intro}

{question}"""

    # Second message — assess and possibly escalate
    if num_turns == 2:
        if severity == "high":
            return _SEVERITY_RESPONSES_HI["high"] if lang == "hi" else _SEVERITY_RESPONSES["high"]

        topic = _get_topic(all_patient_text)
        if lang == "hi":
            return f"""अतिरिक्त जानकारी के लिए धन्यवाद। मेरा मूल्यांकन पूरा करने के लिए मुझे कुछ बातें और पूछने दें:

1. **क्या आप अपनी दैनिक गतिविधियाँ करने में सक्षम हैं**, या लक्षण आपको महत्वपूर्ण रूप से सीमित कर रहे हैं?
2. **क्या आपने इस स्थिति के लिए पहले से ही कोई दवा ली है**?
3. क्या आपको इनमें से कोई लक्षण हैं? सांस लेने में कठिनाई, गंभीर दर्द, 102°F (39°C) से ऊपर तेज बुखार, या कहीं भी खून आना?

_अब तक आपने जो बताया है, उसके आधार पर मैं इसे एक संभावित **{severity.upper()}** गंभीरता का मामला मान रहा हूँ, लेकिन अंतिम मार्गदर्शन देने से पहले मुझे पुष्टि करने दें।_"""
        else:
            return f"""Thank you for that additional information. Let me ask a couple more things to complete my assessment:

1. **Are you able to perform your daily activities**, or are the symptoms significantly limiting you?
2. **Have you taken any medications** for this condition already?
3. Do you have any of these symptoms? Difficulty breathing, severe pain, high fever above 102°F (39°C), or blood anywhere?

_Based on what you've told me so far, I'm considering this a potential **{severity.upper()}** severity case, but let me confirm before giving you final guidance._"""

    # Third+ message — give final assessment
    if severity == "high":
        return _SEVERITY_RESPONSES_HI["high"] if lang == "hi" else _SEVERITY_RESPONSES["high"]
    elif severity == "medium":
        return _SEVERITY_RESPONSES_HI["medium"] if lang == "hi" else _SEVERITY_RESPONSES["medium"]
    else:
        return _SEVERITY_RESPONSES_HI["low"] if lang == "hi" else _SEVERITY_RESPONSES["low"]


# ─────────────────────────────────────────────
#  Grok API Integration (with fallback)
# ─────────────────────────────────────────────

def build_messages(conversation_history: List[dict], patient_context: Optional[dict] = None) -> list:
    """Build the messages array for the LLM call."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Language detection for Grok prompting
    all_text = " ".join(m["content"] for m in conversation_history if m["role"] == "patient")
    detected_lang = _detect_lang(all_text)
    if detected_lang == "hi":
        messages.append({
            "role": "system",
            "content": "CRITICAL: The patient has written in Hindi. You MUST respond completely in Hindi using Devanagari script. Keep your tone empathetic and clear."
        })

    if patient_context:
        context_str = f"""Patient Context (use this to inform your assessment):
- Name: {patient_context.get('name', 'Unknown')}
- Age: {patient_context.get('age', 'Unknown')}
- Gender: {patient_context.get('gender', 'Unknown')}
- Known Allergies: {', '.join(patient_context.get('allergies', [])) or 'None reported'}
- Chronic Conditions: {', '.join(patient_context.get('conditions', [])) or 'None reported'}
- Blood Group: {patient_context.get('blood_group', 'Unknown')}"""
        messages.append({"role": "system", "content": context_str})

    for msg in conversation_history:
        role = "user" if msg["role"] == "patient" else "assistant"
        messages.append({"role": role, "content": msg["content"]})

    return messages


def triage_chat(conversation_history: List[dict], patient_context: Optional[dict] = None) -> str:
    """Synchronous triage — tries Grok, falls back to rule-based engine."""
    if settings.GROK_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(
                api_key=settings.GROK_API_KEY,
                base_url=settings.GROK_BASE_URL,
                default_headers={
                    "HTTP-Referer": "https://vitalbridge.in",
                    "X-Title": "VitalBridge",
                }
            )
            messages = build_messages(conversation_history, patient_context)
            response = client.chat.completions.create(
                model=settings.GROK_MODEL,
                messages=messages,
                temperature=0.7,
                max_tokens=1024,
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"[AI] Grok API failed ({type(e).__name__}: {e}), using fallback engine")

    return _build_fallback_response(conversation_history, patient_context)


async def triage_chat_stream(
    conversation_history: List[dict],
    patient_context: Optional[dict] = None,
) -> AsyncGenerator[str, None]:
    """
    Async streaming triage — tries Grok streaming first.
    On any error, falls back to the rule-based engine and streams word-by-word
    to simulate a realistic streaming experience.
    """
    grok_success = False

    if settings.GROK_API_KEY:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(
                api_key=settings.GROK_API_KEY,
                base_url=settings.GROK_BASE_URL,
                default_headers={
                    "HTTP-Referer": "https://vitalbridge.in",
                    "X-Title": "VitalBridge",
                }
            )
            messages = build_messages(conversation_history, patient_context)

            stream = await client.chat.completions.create(
                model=settings.GROK_MODEL,
                messages=messages,
                temperature=0.7,
                max_tokens=1024,
                stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    grok_success = True
                    yield delta.content
        except Exception as e:
            print(f"[AI] Grok streaming failed ({type(e).__name__}: {e}), using fallback engine")

    if not grok_success:
        # Use rule-based fallback and stream word by word for realistic feel
        import asyncio
        fallback_text = _build_fallback_response(conversation_history, patient_context)

        # Stream chunk by chunk (groups of ~3-5 words) for natural feel
        words = fallback_text.split(" ")
        chunk_size = 4
        for i in range(0, len(words), chunk_size):
            chunk = " ".join(words[i:i + chunk_size])
            if i + chunk_size < len(words):
                chunk += " "
            yield chunk
            await asyncio.sleep(0.05)  # 50ms delay between chunks


def extract_severity(ai_response: str) -> Optional[str]:
    """Parse severity from AI response text."""
    text_lower = ai_response.lower()
    if "**severity: high**" in text_lower or "severity: high" in text_lower:
        return "high"
    elif "**severity: medium**" in text_lower or "severity: medium" in text_lower:
        return "medium"
    elif "**severity: low**" in text_lower or "severity: low" in text_lower:
        return "low"
    return None

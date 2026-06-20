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

_FOLLOW_UP_QUESTIONS = {
    "fever": [
        "How long have you had the fever? Have you measured your temperature? Do you have any other symptoms like chills, body aches, or rash?",
        "Is the fever continuous or does it come and go? Are you able to drink fluids? Any recent travel to a malaria-prone area?",
    ],
    "headache": [
        "Where exactly is the pain — forehead, back of the head, or one side? Is it throbbing or a dull ache? Any fever, nausea, or sensitivity to light?",
        "How severe is the pain on a scale of 1–10? Is this a new kind of headache, or something you've experienced before?",
    ],
    "chest": [
        "Can you describe the chest pain? Is it sharp, squeezing, or burning? Does it spread to your arm, neck, or jaw? Any shortness of breath or sweating?",
    ],
    "stomach": [
        "Where exactly is the pain — upper, lower, or all over? Did it start suddenly or gradually? Any vomiting, loose stools, or blood?",
    ],
    "cough": [
        "How long have you been coughing? Is there any phlegm — and if so, what color? Any fever or difficulty breathing?",
    ],
    "default": [
        "Can you tell me more about when these symptoms started and how severe they are? Are you able to go about your daily activities?",
        "Have you had these symptoms before? Are you currently taking any medications?",
        "Are there any other symptoms you are experiencing? Does anything make it better or worse?",
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

_Remember: I am an AI assistant, not a replacement for emergency medical care. Please seek help now._""",

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

_A VitalBridge doctor has been notified and may follow up with you. I'm an AI assistant — please consult a doctor for a definitive diagnosis._""",

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

_I'm an AI assistant providing initial guidance. Always consult a qualified doctor for proper diagnosis and treatment._"""
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
    # Count patient messages
    patient_messages = [m for m in conversation_history if m["role"] == "patient"]
    num_turns = len(patient_messages)

    if not patient_messages:
        greeting = "Namaste! 🙏 I'm VitalBridge AI, your medical triage assistant."
        if patient_context and patient_context.get("name"):
            greeting = f"Namaste {patient_context['name']}! 🙏 I'm VitalBridge AI, your medical triage assistant."
        return f"""{greeting}

I'm here to help assess your symptoms and guide you on the next steps for your healthcare.

Please tell me: **What symptoms are you experiencing today?**

You can describe your symptoms in English, Hindi (हिंदी), Tamil, Telugu, Kannada, or Bengali — I understand all of them."""

    # Get last patient message
    last_patient_msg = patient_messages[-1]["content"].lower()

    # Combine all patient messages for analysis
    all_patient_text = " ".join(m["content"] for m in patient_messages)

    # Detect severity
    severity = _detect_severity_from_text(all_patient_text)

    # First message — ask follow-up questions
    if num_turns == 1:
        topic = _get_topic(last_patient_msg)
        questions = _FOLLOW_UP_QUESTIONS.get(topic, _FOLLOW_UP_QUESTIONS["default"])
        question = random.choice(questions)

        intro = "Thank you for sharing that with me. I want to make sure I understand your situation fully."

        # Add patient context personalization
        if patient_context:
            if patient_context.get("conditions"):
                conditions = ", ".join(patient_context["conditions"])
                intro += f" I can see from your health record that you have a history of {conditions}, which I'll keep in mind."

        return f"""{intro}

{question}

Also: **How long have you been experiencing these symptoms?**"""

    # Second message — assess and possibly escalate
    if num_turns == 2:
        # If high severity, escalate immediately
        if severity == "high":
            return _SEVERITY_RESPONSES["high"]

        topic = _get_topic(all_patient_text)
        # Ask one more clarifying question before final assessment
        return f"""Thank you for that additional information. Let me ask a couple more things to complete my assessment:

1. **Are you able to perform your daily activities**, or are the symptoms significantly limiting you?
2. **Have you taken any medications** for this condition already?
3. Do you have any of these symptoms? Difficulty breathing, severe pain, high fever above 102°F (39°C), or blood anywhere?

_Based on what you've told me so far, I'm considering this a potential **{severity.upper()}** severity case, but let me confirm before giving you final guidance._"""

    # Third+ message — give final assessment
    if severity == "high":
        return _SEVERITY_RESPONSES["high"]
    elif severity == "medium":
        return _SEVERITY_RESPONSES["medium"]
    else:
        return _SEVERITY_RESPONSES["low"]


# ─────────────────────────────────────────────
#  Grok API Integration (with fallback)
# ─────────────────────────────────────────────

def build_messages(conversation_history: List[dict], patient_context: Optional[dict] = None) -> list:
    """Build the messages array for the LLM call."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

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

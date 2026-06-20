"""
AI Service — clean abstraction over the Grok (xAI) LLM.
Swap the provider by changing the base_url and model — no business logic changes needed.
"""

import json
from typing import AsyncGenerator, List, Optional
from openai import OpenAI, AsyncOpenAI
from app.core.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """You are VitalBridge AI, a medical triage assistant deployed in India. Your role is to:

1. Listen to the patient's symptoms carefully and empathetically
2. Ask targeted clarifying questions (1-3 at a time, not overwhelming)
3. After gathering enough information (usually 2-3 exchanges), provide a structured severity assessment
4. Give actionable home-care guidance for Low/Medium severity, or escalate for High severity

SEVERITY LEVELS:
- LOW: Minor symptoms manageable at home (common cold, mild headache, minor cuts)
- MEDIUM: Symptoms needing monitoring but not immediately dangerous (persistent fever, moderate pain, mild infections)
- HIGH: Potentially dangerous symptoms requiring immediate medical attention (chest pain, severe breathing difficulty, high fever with confusion, signs of stroke, severe allergic reactions)

RULES:
- Always be empathetic and culturally sensitive to Indian patients
- Use simple language, avoid excessive medical jargon
- Support both English and Hindi (respond in the language the patient uses)
- When you determine severity, output it clearly in bold: **Severity: LOW/MEDIUM/HIGH**
- For HIGH severity: clearly state you are escalating to a doctor and give immediate safety instructions
- Never diagnose definitively — use phrases like "this appears to be" or "this is consistent with"
- Always include warning signs that should prompt emergency care
- You are NOT a replacement for a doctor — make this clear when appropriate

IMPORTANT: Provide real, varying medical triage reasoning. Do NOT give templated or canned responses. Each interaction should feel like a genuine conversation with a knowledgeable health assistant."""


def _get_client() -> OpenAI:
    """Synchronous OpenAI-compatible client for Grok."""
    if not settings.GROK_API_KEY:
        raise ValueError("GROK_API_KEY not set in environment. Cannot perform AI triage.")
    return OpenAI(
        api_key=settings.GROK_API_KEY,
        base_url=settings.GROK_BASE_URL,
    )


def _get_async_client() -> AsyncOpenAI:
    """Async OpenAI-compatible client for Grok."""
    if not settings.GROK_API_KEY:
        raise ValueError("GROK_API_KEY not set in environment. Cannot perform AI triage.")
    return AsyncOpenAI(
        api_key=settings.GROK_API_KEY,
        base_url=settings.GROK_BASE_URL,
    )


def build_messages(conversation_history: List[dict], patient_context: Optional[dict] = None) -> list:
    """Build the messages array for the LLM call, including system prompt and patient context."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Inject patient context if available
    if patient_context:
        context_str = f"""Patient Context (use this to inform your assessment):
- Name: {patient_context.get('name', 'Unknown')}
- Age: {patient_context.get('age', 'Unknown')}
- Gender: {patient_context.get('gender', 'Unknown')}
- Known Allergies: {', '.join(patient_context.get('allergies', [])) or 'None reported'}
- Chronic Conditions: {', '.join(patient_context.get('conditions', [])) or 'None reported'}
- Blood Group: {patient_context.get('blood_group', 'Unknown')}"""
        messages.append({"role": "system", "content": context_str})

    # Add conversation history
    for msg in conversation_history:
        role = "user" if msg["role"] == "patient" else "assistant"
        messages.append({"role": role, "content": msg["content"]})

    return messages


def triage_chat(conversation_history: List[dict], patient_context: Optional[dict] = None) -> str:
    """Synchronous single-response triage call."""
    client = _get_client()
    messages = build_messages(conversation_history, patient_context)

    response = client.chat.completions.create(
        model=settings.GROK_MODEL,
        messages=messages,
        temperature=0.7,
        max_tokens=1024,
    )
    return response.choices[0].message.content


async def triage_chat_stream(
    conversation_history: List[dict],
    patient_context: Optional[dict] = None,
) -> AsyncGenerator[str, None]:
    """Async streaming triage call — yields text chunks as they arrive."""
    client = _get_async_client()
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
            yield delta.content


def extract_severity(ai_response: str) -> Optional[str]:
    """Parse severity from AI response text. Returns 'low', 'medium', 'high', or None."""
    text_lower = ai_response.lower()
    if "**severity: high**" in text_lower or "severity: high" in text_lower:
        return "high"
    elif "**severity: medium**" in text_lower or "severity: medium" in text_lower:
        return "medium"
    elif "**severity: low**" in text_lower or "severity: low" in text_lower:
        return "low"
    return None

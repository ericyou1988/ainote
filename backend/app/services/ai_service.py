import json
from sqlalchemy.orm import Session
from app.models.note import Note, NoteStatus
from app.models.conversation import Conversation
from app.models.provider import AIProvider
from app.services.provider_service import get_current_provider, decrypt_key, encrypt_key
import litellm


SYSTEM_PROMPTS = {
    "prompt_engineer": """你是一个专业的提示词工程师。请对用户输入的提示词进行结构化拆解和评估。

分析维度：
1. 角色设定：识别提示词中 AI 角色定义是否清晰
2. 任务描述：识别核心任务目标是否明确
3. 输出格式：识别输出格式要求是否具体可执行
4. 优化建议：给出具体的改进建议
5. 改进版本：输出优化后的完整提示词

请以 JSON 格式输出：
{
  "type": "prompt_analysis",
  "role_setting": "...",
  "task_description": "...",
  "output_format": "...",
  "suggestions": ["...", "..."],
  "improved_version": "..."
}""",

    "translation_expert": """你是一个专业的技术翻译专家。请对用户的英文内容进行中英文双向翻译和分析。

分析维度：
1. 逐词翻译表：每词的中英文对照、词性标注、语境说明
2. 语法树：句子结构分析（主句、从句、修饰关系）
3. 纠错建议：语法/拼写/表达地道性纠正
4. 技术术语：识别编程、AI、云计算等领域术语
5. 改进版本：输出更地道/更精确的英文表达

请以 JSON 格式输出：
{
  "type": "translation_analysis",
  "translation_table": [{"word": "", "translation": "", "pos": "", "note": ""}],
  "grammar_tree": "...",
  "corrections": ["..."],
  "technical_terms": ["..."],
  "improved_version": "..."
}""",
}


def detect_content_type(content: str) -> str:
    chinese_chars = sum(1 for c in content if '一' <= c <= '鿿')
    english_chars = sum(1 for c in content if c.isascii() and c.isalpha())
    total = chinese_chars + english_chars
    if total == 0:
        return "unknown"

    ratio_zh = chinese_chars / total
    ratio_en = english_chars / total

    prompt_keywords = ["请帮我", "写一个", "作为", "你是一个", "你是一位", "扮演", "generate", "act as", "you are a", "you are an"]
    has_prompt_keywords = any(kw in content for kw in prompt_keywords)

    if ratio_en > 0.5:
        return "english"
    if ratio_zh > 0.5 and has_prompt_keywords:
        return "prompt"
    if ratio_zh > 0.5 and not has_prompt_keywords:
        return "chinese"
    if ratio_en > 0.3 and has_prompt_keywords:
        return "prompt"
    if ratio_zh > 0.3 and ratio_en > 0.2:
        return "mixed"
    return "unknown"


def detect_language_tags(content: str) -> list[str]:
    chinese_chars = sum(1 for c in content if '一' <= c <= '鿿')
    english_chars = sum(1 for c in content if c.isascii() and c.isalpha())
    total = chinese_chars + english_chars
    if total == 0:
        return []

    ratio_zh = chinese_chars / total
    ratio_en = english_chars / total

    tags = []
    if ratio_zh > 0.5:
        tags.append("中文")
    elif ratio_zh > 0.2:
        tags.append("中文")

    if ratio_en > 0.5:
        tags.append("英文")
    elif ratio_en > 0.2:
        tags.append("英文")

    prompt_keywords = ["请帮我", "写一个", "作为", "你是一个", "你是一位", "扮演", "act as", "you are a", "you are an"]
    if any(kw in content for kw in prompt_keywords):
        tags.append("提示词")

    return tags if tags else ["中文"]


def _extract_delta(chunk) -> str | None:
    if not chunk.choices:
        return None
    delta = chunk.choices[0].delta
    text = getattr(delta, "content", None) or ""
    reasoning = getattr(delta, "reasoning", None) or getattr(delta, "reasoning_content", None) or ""
    result = text + reasoning
    return result if result else None


def _resolve_model(model: str, base_url: str) -> str:
    if "openrouter" in base_url.lower() and "/" not in model.split("/")[0]:
        return f"openrouter/{model}"
    return model


async def analyze_note(db: Session, note: Note, provider: AIProvider):
    content_type = detect_content_type(note.content)

    if content_type == "english":
        system_prompt = SYSTEM_PROMPTS["translation_expert"]
    elif content_type == "prompt":
        system_prompt = SYSTEM_PROMPTS["prompt_engineer"]
    elif content_type == "mixed":
        system_prompt = SYSTEM_PROMPTS["prompt_engineer"] + "\n\n同时请对英文部分做翻译分析。"
    else:
        system_prompt = SYSTEM_PROMPTS["prompt_engineer"]

    api_key = decrypt_key(provider.api_key)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": note.content},
    ]

    response = await litellm.acompletion(
        model=_resolve_model(provider.model, provider.base_url),
        api_base=provider.base_url,
        api_key=api_key,
        messages=messages,
        stream=True,
    )

    full_content = ""
    async for chunk in response:
        content = _extract_delta(chunk)
        if content:
            full_content += content
            yield content

    # Parse and save analysis result
    try:
        analysis_result = json.loads(full_content)
        note.analysis_result = analysis_result
        note.status = NoteStatus.analyzed
        db.commit()
    except json.JSONDecodeError:
        # If not valid JSON, save as text
        note.analysis_result = {"raw": full_content}
        note.status = NoteStatus.analyzed
        db.commit()


async def chat_message(db: Session, note: Note, provider: AIProvider, user_message: str):
    conversation = db.query(Conversation).filter(Conversation.note_id == note.id).first()
    if not conversation:
        conversation = Conversation(note_id=note.id, messages=[])
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    # Add user message
    conversation.messages.append({
        "role": "user",
        "content": user_message,
    })

    api_key = decrypt_key(provider.api_key)

    # Build message history
    system_prompt = "你是 AInote 的 AI 助手，基于用户笔记内容进行对话。请结合笔记上下文来回答问题。"
    messages = [{"role": "system", "content": system_prompt}]
    messages += conversation.messages

    response = await litellm.acompletion(
        model=_resolve_model(provider.model, provider.base_url),
        api_base=provider.base_url,
        api_key=api_key,
        messages=messages,
        stream=True,
    )

    assistant_content = ""
    async for chunk in response:
        content = _extract_delta(chunk)
        if content:
            assistant_content += content
            yield content

    # Save assistant response
    conversation.messages.append({
        "role": "assistant",
        "content": assistant_content,
    })
    note.status = NoteStatus.discussed
    db.commit()

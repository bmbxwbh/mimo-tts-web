"""
MiMo-V2.5-TTS Web UI — 合成路由

处理三种合成请求：预置音色、音色设计、音色复刻。
支持非流式（WAV 下载）和流式（WebSocket PCM 实时推送）。
"""

import base64
import json
import time

from fastapi import APIRouter, Header, WebSocket, WebSocketDisconnect
from fastapi.responses import Response

from config import MODELS, MAX_AUDIO_BASE64_SIZE
from schemas import (
    PresetRequest, VoiceDesignRequest, VoiceCloneRequest,
    DirectorConfig,
    BatchPresetRequest, BatchVoiceDesignRequest, BatchVoiceCloneRequest,
    BatchResultItem, BatchResponse,
)
from services.mimo_client import mimo_client

router = APIRouter(prefix="/api", tags=["synthesize"])


def _get_api_key(x_api_key: str) -> str:
    """从 header 提取 API Key"""
    return x_api_key


def _build_preset_messages(req: PresetRequest) -> list[dict]:
    """
    构造预置音色合成的 messages

    - user 消息：自然语言风格控制 / 导演模式
    - assistant 消息：音频标签前缀 + 合成文本
    """
    messages = []

    # user 消息（可选）：自然语言风格控制
    user_content = ""
    if req.director:
        # 导演模式：拼接角色/场景/指导
        parts = []
        if req.director.character:
            parts.append(f"角色：{req.director.character}")
        if req.director.scene:
            parts.append(f"场景：{req.director.scene}")
        if req.director.direction:
            parts.append(f"指导：\n{req.director.direction}")
        if parts:
            user_content = "\n\n".join(parts)
    elif req.style_prompt:
        user_content = req.style_prompt

    if user_content:
        messages.append({"role": "user", "content": user_content})

    # assistant 消息：音频标签 + 文本
    assistant_content = req.text
    if req.singing:
        assistant_content = f"(唱歌){assistant_content}"
    if req.audio_tags:
        assistant_content = f"({req.audio_tags}){assistant_content}"
    messages.append({"role": "assistant", "content": assistant_content})

    return messages


def _build_voicedesign_messages(req: VoiceDesignRequest) -> list[dict]:
    """构造音色设计合成的 messages"""
    messages = [
        {"role": "user", "content": req.voice_description},
    ]

    assistant_content = req.text
    if req.audio_tags:
        assistant_content = f"({req.audio_tags}){assistant_content}"
    messages.append({"role": "assistant", "content": assistant_content})

    return messages


def _build_voiceclone_messages(req: VoiceCloneRequest) -> list[dict]:
    """构造音色复刻合成的 messages"""
    assistant_content = req.text
    if req.audio_tags:
        assistant_content = f"({req.audio_tags}){assistant_content}"

    messages = [
        {"role": "assistant", "content": assistant_content},
    ]
    return messages


@router.post("/synthesize/preset")
async def synthesize_preset(
    req: PresetRequest,
    x_api_key: str = Header(..., alias="X-Api-Key"),
):
    """
    预置音色合成（非流式）

    返回 WAV 音频文件。
    """
    api_key = _get_api_key(x_api_key)
    messages = _build_preset_messages(req)
    audio_config = {"format": "wav", "voice": req.voice}

    try:
        wav_bytes, duration = await mimo_client.synthesize_nonstream(
            model=MODELS["preset"],
            messages=messages,
            audio_config=audio_config,
            api_key=api_key,
        )
        return Response(
            content=wav_bytes,
            media_type="audio/wav",
            headers={
                "X-Audio-Duration": str(duration),
                "Content-Disposition": "attachment; filename=preset_audio.wav",
            },
        )
    except Exception as e:
        return Response(
            content=json.dumps({"error": str(e)}),
            media_type="application/json",
            status_code=500,
        )


@router.post("/synthesize/voicedesign")
async def synthesize_voicedesign(
    req: VoiceDesignRequest,
    x_api_key: str = Header(..., alias="X-Api-Key"),
):
    """
    音色设计合成（非流式）

    返回 WAV 音频文件。
    """
    api_key = _get_api_key(x_api_key)
    messages = _build_voicedesign_messages(req)
    audio_config = {"format": "wav"}

    try:
        wav_bytes, duration = await mimo_client.synthesize_nonstream(
            model=MODELS["voicedesign"],
            messages=messages,
            audio_config=audio_config,
            api_key=api_key,
        )
        return Response(
            content=wav_bytes,
            media_type="audio/wav",
            headers={
                "X-Audio-Duration": str(duration),
                "Content-Disposition": "attachment; filename=voicedesign_audio.wav",
            },
        )
    except Exception as e:
        return Response(
            content=json.dumps({"error": str(e)}),
            media_type="application/json",
            status_code=500,
        )


@router.post("/synthesize/voiceclone")
async def synthesize_voiceclone(
    req: VoiceCloneRequest,
    x_api_key: str = Header(..., alias="X-Api-Key"),
):
    """
    音色复刻合成（非流式）

    返回 WAV 音频文件。
    """
    api_key = _get_api_key(x_api_key)

    # 验证 Base64 大小
    if len(req.audio_base64) > MAX_AUDIO_BASE64_SIZE:
        return Response(
            content=json.dumps({"error": "音频样本 Base64 超过 10MB 限制"}),
            media_type="application/json",
            status_code=400,
        )

    messages = _build_voiceclone_messages(req)
    voice_value = f"data:{req.mime_type};base64,{req.audio_base64}"
    audio_config = {"format": "wav", "voice": voice_value}

    try:
        wav_bytes, duration = await mimo_client.synthesize_nonstream(
            model=MODELS["voiceclone"],
            messages=messages,
            audio_config=audio_config,
            api_key=api_key,
        )
        return Response(
            content=wav_bytes,
            media_type="audio/wav",
            headers={
                "X-Audio-Duration": str(duration),
                "Content-Disposition": "attachment; filename=voiceclone_audio.wav",
            },
        )
    except Exception as e:
        return Response(
            content=json.dumps({"error": str(e)}),
            media_type="application/json",
            status_code=500,
        )


# ==================== 批量合成 ====================

async def _batch_synthesize(
    model: str,
    texts: list[str],
    build_messages_fn,
    build_req_fn,
    api_key: str,
    extra_config: dict | None = None,
) -> BatchResponse:
    """
    批量合成通用逻辑

    串行逐条调用 API，返回所有结果。
    """
    results = []
    completed = 0

    for idx, text in enumerate(texts):
        try:
            req = build_req_fn(text)
            messages = build_messages_fn(req)
            audio_config = {"format": "wav", **(extra_config or {})}

            wav_bytes, duration = await mimo_client.synthesize_nonstream(
                model=model,
                messages=messages,
                audio_config=audio_config,
                api_key=api_key,
            )
            results.append(BatchResultItem(
                index=idx,
                text=text[:100],
                success=True,
                audio_base64=base64.b64encode(wav_bytes).decode("utf-8"),
                duration=duration,
            ))
            completed += 1
        except Exception as e:
            results.append(BatchResultItem(
                index=idx,
                text=text[:100],
                success=False,
                error=str(e),
            ))

    return BatchResponse(total=len(texts), completed=completed, results=results)


@router.post("/synthesize/batch/preset", response_model=BatchResponse)
async def batch_synthesize_preset(
    req: BatchPresetRequest,
    x_api_key: str = Header(..., alias="X-Api-Key"),
):
    """批量预置音色合成"""
    api_key = _get_api_key(x_api_key)
    texts = [item.text for item in req.texts]

    def build_req(text):
        return PresetRequest(
            voice=req.voice,
            text=text,
            style_prompt=req.style_prompt,
            audio_tags=req.audio_tags,
            director=req.director,
            singing=req.singing,
        )

    return await _batch_synthesize(
        model=MODELS["preset"],
        texts=texts,
        build_messages_fn=_build_preset_messages,
        build_req_fn=build_req,
        api_key=api_key,
        extra_config={"voice": req.voice},
    )


@router.post("/synthesize/batch/voicedesign", response_model=BatchResponse)
async def batch_synthesize_voicedesign(
    req: BatchVoiceDesignRequest,
    x_api_key: str = Header(..., alias="X-Api-Key"),
):
    """批量音色设计合成"""
    api_key = _get_api_key(x_api_key)
    texts = [item.text for item in req.texts]

    def build_req(text):
        return VoiceDesignRequest(
            voice_description=req.voice_description,
            text=text,
            audio_tags=req.audio_tags,
        )

    return await _batch_synthesize(
        model=MODELS["voicedesign"],
        texts=texts,
        build_messages_fn=_build_voicedesign_messages,
        build_req_fn=build_req,
        api_key=api_key,
    )


@router.post("/synthesize/batch/voiceclone", response_model=BatchResponse)
async def batch_synthesize_voiceclone(
    req: BatchVoiceCloneRequest,
    x_api_key: str = Header(..., alias="X-Api-Key"),
):
    """批量音色复刻合成"""
    api_key = _get_api_key(x_api_key)

    if len(req.audio_base64) > MAX_AUDIO_BASE64_SIZE:
        return BatchResponse(
            total=len(req.texts), completed=0,
            results=[BatchResultItem(index=0, text="", success=False, error="音频样本超过 10MB 限制")],
        )

    texts = [item.text for item in req.texts]
    voice_value = f"data:{req.mime_type};base64,{req.audio_base64}"

    def build_req(text):
        return VoiceCloneRequest(
            audio_base64=req.audio_base64,
            mime_type=req.mime_type,
            text=text,
            audio_tags=req.audio_tags,
        )

    return await _batch_synthesize(
        model=MODELS["voiceclone"],
        texts=texts,
        build_messages_fn=_build_voiceclone_messages,
        build_req_fn=build_req,
        api_key=api_key,
        extra_config={"voice": voice_value},
    )


# ==================== WebSocket 流式合成 ====================

@router.websocket("/ws/synthesize")
async def ws_synthesize(websocket: WebSocket):
    """
    WebSocket 流式合成

    客户端先发送 JSON 配置帧，服务端逐 chunk 发送 PCM 二进制帧，
    最后发送 JSON 结束帧。

    配置帧格式：
    {
        "type": "preset" | "voicedesign" | "voiceclone",
        "api_key": "...",
        "voice": "...",           // preset 专用
        "text": "...",
        "style_prompt": "...",    // preset 专用
        "audio_tags": "...",
        "director": {...},        // preset 专用
        "singing": false,         // preset 专用
        "voice_description": "...", // voicedesign 专用
        "audio_base64": "...",    // voiceclone 专用
        "mime_type": "...",       // voiceclone 专用
    }
    """
    await websocket.accept()

    try:
        # 接收配置帧
        config_str = await websocket.receive_text()
        config = json.loads(config_str)

        synth_type = config.get("type", "preset")
        api_key = config.get("api_key", "")

        if not api_key:
            await websocket.send_json({"type": "error", "message": "缺少 API Key"})
            await websocket.close()
            return

        # 根据类型构造请求
        model = MODELS.get(synth_type)
        if not model:
            await websocket.send_json({"type": "error", "message": f"未知合成类型: {synth_type}"})
            await websocket.close()
            return

        if synth_type == "preset":
            text = config.get("text", "")
            voice = config.get("voice", "mimo_default")
            style_prompt = config.get("style_prompt")
            audio_tags = config.get("audio_tags")
            director = config.get("director")
            singing = config.get("singing", False)

            req = PresetRequest(
                voice=voice,
                text=text,
                style_prompt=style_prompt,
                audio_tags=audio_tags,
                director=DirectorConfig(**director) if director else None,
                singing=singing,
            )
            messages = _build_preset_messages(req)
            audio_config = {"format": "pcm16", "voice": voice}

        elif synth_type == "voicedesign":
            voice_description = config.get("voice_description", "")
            text = config.get("text", "")
            audio_tags = config.get("audio_tags")

            req = VoiceDesignRequest(
                voice_description=voice_description,
                text=text,
                audio_tags=audio_tags,
            )
            messages = _build_voicedesign_messages(req)
            audio_config = {"format": "pcm16"}

        elif synth_type == "voiceclone":
            audio_base64 = config.get("audio_base64", "")
            mime_type = config.get("mime_type", "audio/wav")
            text = config.get("text", "")
            audio_tags = config.get("audio_tags")

            req = VoiceCloneRequest(
                audio_base64=audio_base64,
                mime_type=mime_type,
                text=text,
                audio_tags=audio_tags,
            )
            messages = _build_voiceclone_messages(req)
            voice_value = f"data:{mime_type};base64,{audio_base64}"
            audio_config = {"format": "pcm16", "voice": voice_value}

        # 开始流式合成
        start_time = time.monotonic()
        total_bytes = 0
        chunk_count = 0

        async for pcm_chunk in mimo_client.synthesize_stream(
            model=model,
            messages=messages,
            audio_config=audio_config,
            api_key=api_key,
        ):
            await websocket.send_bytes(pcm_chunk)
            total_bytes += len(pcm_chunk)
            chunk_count += 1

        duration = time.monotonic() - start_time

        # 发送结束帧
        await websocket.send_json({
            "type": "done",
            "total_bytes": total_bytes,
            "chunk_count": chunk_count,
            "duration": round(duration, 2),
        })

    except WebSocketDisconnect:
        pass
    except json.JSONDecodeError as e:
        try:
            await websocket.send_json({"type": "error", "message": f"JSON 解析错误: {e}"})
        except Exception:
            pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

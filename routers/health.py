"""
MiMo-V2.5-TTS Web UI — 健康检查 / 连接测试路由
"""

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

from services.mimo_client import mimo_client
from schemas import ConnectionTestResponse

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health_check():
    """服务健康检查"""
    return {"status": "ok", "service": "mimo-tts-web"}


@router.get("/test-connection", response_model=ConnectionTestResponse)
async def test_connection(x_api_key: str = Header(..., alias="X-Api-Key")):
    """
    测试 MiMo API 连接

    通过发送一个轻量请求验证 API Key 是否有效。
    API Key 通过 X-Api-Key header 传入。
    """
    success, message = await mimo_client.test_connection(x_api_key)
    return ConnectionTestResponse(success=success, message=message)


@router.get("/voices")
async def get_voices():
    """获取预置音色列表（含试听文件 URL）"""
    from config import PRESET_VOICES
    voices = []
    for v in PRESET_VOICES:
        voices.append({
            **v,
            "preview_url": f"/assets/previews/{v['id']}.wav",
        })
    return {"voices": voices}


@router.get("/style-tags")
async def get_style_tags():
    """获取风格标签列表"""
    from config import STYLE_TAGS
    return {"tags": STYLE_TAGS}


@router.get("/audio-tags")
async def get_audio_tags():
    """获取音频标签列表"""
    from config import AUDIO_TAGS
    return {"tags": AUDIO_TAGS}

"""
MiMo-V2.5-TTS Web UI — Pydantic 请求/响应模型
"""

from pydantic import BaseModel, Field
from typing import Optional


class DirectorConfig(BaseModel):
    """导演模式配置"""
    character: str = Field("", description="角色描述")
    scene: str = Field("", description="场景描述")
    direction: str = Field("", description="演绎指导")


class PresetRequest(BaseModel):
    """预置音色合成请求"""
    voice: str = Field("mimo_default", description="音色 ID")
    text: str = Field(..., min_length=1, description="合成文本")
    style_prompt: Optional[str] = Field(None, description="自然语言风格控制")
    audio_tags: Optional[str] = Field(None, description="音频标签前缀")
    director: Optional[DirectorConfig] = Field(None, description="导演模式配置")
    singing: bool = Field(False, description="唱歌模式")
    stream: bool = Field(False, description="是否流式")


class VoiceDesignRequest(BaseModel):
    """音色设计合成请求"""
    voice_description: str = Field(..., min_length=1, description="音色描述")
    text: str = Field(..., min_length=1, description="合成文本")
    audio_tags: Optional[str] = Field(None, description="音频标签前缀")
    stream: bool = Field(False, description="是否流式")


class VoiceCloneRequest(BaseModel):
    """音色复刻合成请求"""
    audio_base64: str = Field(..., min_length=1, description="音频样本 Base64")
    mime_type: str = Field(..., description="MIME 类型")
    text: str = Field(..., min_length=1, description="合成文本")
    audio_tags: Optional[str] = Field(None, description="音频标签前缀")
    stream: bool = Field(False, description="是否流式")


class ConnectionTestResponse(BaseModel):
    """连接测试响应"""
    success: bool
    message: str


class SynthesisResponse(BaseModel):
    """合成响应（非流式时用于错误返回）"""
    success: bool
    message: str
    duration: Optional[float] = None


# ==================== 批量合成 ====================

class BatchPresetItem(BaseModel):
    """批量合成中的单条文本"""
    text: str = Field(..., min_length=1, description="合成文本")


class BatchPresetRequest(BaseModel):
    """批量预置音色合成请求"""
    voice: str = Field("mimo_default", description="音色 ID")
    texts: list[BatchPresetItem] = Field(..., min_length=1, max_length=50, description="文本列表")
    style_prompt: Optional[str] = Field(None, description="自然语言风格控制")
    audio_tags: Optional[str] = Field(None, description="音频标签前缀")
    director: Optional[DirectorConfig] = Field(None, description="导演模式配置")
    singing: bool = Field(False, description="唱歌模式")


class BatchVoiceDesignRequest(BaseModel):
    """批量音色设计合成请求"""
    voice_description: str = Field(..., min_length=1, description="音色描述")
    texts: list[BatchPresetItem] = Field(..., min_length=1, max_length=50, description="文本列表")
    audio_tags: Optional[str] = Field(None, description="音频标签前缀")


class BatchVoiceCloneRequest(BaseModel):
    """批量音色复刻合成请求"""
    audio_base64: str = Field(..., min_length=1, description="音频样本 Base64")
    mime_type: str = Field(..., description="MIME 类型")
    texts: list[BatchPresetItem] = Field(..., min_length=1, max_length=50, description="文本列表")
    audio_tags: Optional[str] = Field(None, description="音频标签前缀")


class BatchResultItem(BaseModel):
    """批量合成单条结果"""
    index: int
    text: str
    success: bool
    audio_base64: Optional[str] = None
    duration: Optional[float] = None
    error: Optional[str] = None


class BatchResponse(BaseModel):
    """批量合成响应"""
    total: int
    completed: int
    results: list[BatchResultItem]

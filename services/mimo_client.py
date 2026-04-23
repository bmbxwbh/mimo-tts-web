"""
MiMo-V2.5-TTS Web UI — MiMo API 客户端封装

统一封装对 MiMo API 的调用逻辑，三个模型共享。
"""

import base64
import json
import time
from typing import AsyncGenerator, Optional

import httpx

from config import MIMO_API_BASE_URL, MIMO_API_ENDPOINT


class MiMoClient:
    """MiMo API 客户端（共享连接池）"""

    def __init__(self):
        self.base_url = MIMO_API_BASE_URL
        self.endpoint = MIMO_API_ENDPOINT
        self.timeout = httpx.Timeout(120.0, connect=30.0)
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        """获取或创建共享的 httpx 客户端"""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client

    async def close(self):
        """关闭共享客户端（应用关闭时调用）"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def synthesize_nonstream(
        self,
        model: str,
        messages: list[dict],
        audio_config: dict,
        api_key: str,
    ) -> tuple[bytes, float]:
        """
        非流式合成

        Args:
            model: 模型 ID
            messages: 消息列表
            audio_config: 音频配置 {format, voice?}
            api_key: API Key

        Returns:
            (wav_bytes, duration_seconds)

        Raises:
            Exception: API 调用失败
        """
        url = f"{self.base_url}{self.endpoint}"
        headers = {
            "api-key": api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": messages,
            "audio": audio_config,
        }

        start_time = time.monotonic()
        client = self._get_client()
        resp = await client.post(url, headers=headers, json=payload)
        duration = time.monotonic() - start_time

        if resp.status_code != 200:
            error_msg = self._parse_error(resp)
            raise Exception(f"API 错误 ({resp.status_code}): {error_msg}")

        data = resp.json()
        return self._extract_audio(data), duration

    async def synthesize_stream(
        self,
        model: str,
        messages: list[dict],
        audio_config: dict,
        api_key: str,
    ) -> AsyncGenerator[bytes, None]:
        """
        流式合成（SSE）

        注意：MiMo API 当前流式为兼容模式，仅在推理完成后以流式格式返回。
        但接口仍按标准 SSE 流式处理。

        Yields:
            PCM16 原始字节块
        """
        url = f"{self.base_url}{self.endpoint}"
        headers = {
            "api-key": api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": messages,
            "audio": {**audio_config, "format": "pcm16"},
            "stream": True,
        }

        client = self._get_client()
        async with client.stream("POST", url, headers=headers, json=payload) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                raise Exception(f"API 流式错误 ({resp.status_code}): {body.decode('utf-8', errors='replace')}")

            async for line in resp.aiter_lines():
                if not line:
                    continue
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        return
                    try:
                        chunk_data = json.loads(data_str)
                        audio_data = self._extract_stream_chunk(chunk_data)
                        if audio_data:
                            yield audio_data
                    except json.JSONDecodeError:
                        continue

    def _extract_audio(self, data: dict) -> bytes:
        """从非流式响应中提取音频字节"""
        try:
            choices = data.get("choices", [])
            if not choices:
                raise Exception("API 返回空结果")
            message = choices[0].get("message", {})
            audio = message.get("audio", {})
            audio_b64 = audio.get("data", "")
            if not audio_b64:
                raise Exception("API 返回无音频数据")
            return base64.b64decode(audio_b64)
        except (KeyError, IndexError) as e:
            raise Exception(f"解析 API 响应失败: {e}")

    def _extract_stream_chunk(self, chunk_data: dict) -> Optional[bytes]:
        """从流式 chunk 中提取 PCM 字节"""
        try:
            choices = chunk_data.get("choices", [])
            if not choices:
                return None
            delta = choices[0].get("delta", {})
            audio = delta.get("audio", None)
            if audio and isinstance(audio, dict):
                audio_b64 = audio.get("data", "")
                if audio_b64:
                    return base64.b64decode(audio_b64)
        except (KeyError, IndexError):
            pass
        return None

    def _parse_error(self, resp: httpx.Response) -> str:
        """解析错误响应"""
        try:
            data = resp.json()
            error = data.get("error", {})
            return error.get("message", resp.text[:500])
        except Exception:
            return resp.text[:500]

    async def test_connection(self, api_key: str) -> tuple[bool, str]:
        """
        测试 API 连接

        发送一个极简请求验证 API Key 是否有效。
        """
        url = f"{self.base_url}{self.endpoint}"
        headers = {
            "api-key": api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "model": "mimo-v2.5-tts",
            "messages": [
                {"role": "assistant", "content": "Hi"}
            ],
            "audio": {"format": "wav", "voice": "mimo_default"},
        }

        try:
            client = self._get_client()
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                return True, "连接成功"
            elif resp.status_code == 401:
                return False, "API Key 无效或已过期"
            else:
                error_msg = self._parse_error(resp)
                return False, f"API 错误 ({resp.status_code}): {error_msg}"
        except httpx.TimeoutException:
            return False, "连接超时，请检查网络"
        except httpx.ConnectError:
            return False, "无法连接到 MiMo API 服务器"
        except Exception as e:
            return False, f"连接失败: {str(e)}"


# 全局单例
mimo_client = MiMoClient()

"""
MiMo-V2.5-TTS Web UI — 音频处理工具
"""

import io
import struct
from config import AUDIO_SAMPLE_RATE, AUDIO_CHANNELS, AUDIO_SAMPLE_WIDTH


def pcm_to_wav(
    pcm_bytes: bytes,
    sample_rate: int = AUDIO_SAMPLE_RATE,
    channels: int = AUDIO_CHANNELS,
    sample_width: int = AUDIO_SAMPLE_WIDTH,
) -> bytes:
    """
    PCM16LE → WAV 封装

    Args:
        pcm_bytes: 原始 PCM16LE 数据
        sample_rate: 采样率（默认 24000）
        channels: 声道数（默认 1）
        sample_width: 采样位宽字节数（默认 2，即 16-bit）

    Returns:
        完整的 WAV 文件字节
    """
    data_size = len(pcm_bytes)
    byte_rate = sample_rate * channels * sample_width
    block_align = channels * sample_width

    # WAV 文件头
    buf = io.BytesIO()
    # RIFF header
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))  # 文件大小 - 8
    buf.write(b"WAVE")
    # fmt chunk
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))              # chunk 大小
    buf.write(struct.pack("<H", 1))               # PCM 格式
    buf.write(struct.pack("<H", channels))
    buf.write(struct.pack("<I", sample_rate))
    buf.write(struct.pack("<I", byte_rate))
    buf.write(struct.pack("<H", block_align))
    buf.write(struct.pack("<H", sample_width * 8))  # bits per sample
    # data chunk
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(pcm_bytes)

    return buf.getvalue()


def get_audio_duration(wav_bytes: bytes) -> float:
    """
    计算 WAV 音频时长（秒）

    Args:
        wav_bytes: 完整的 WAV 文件字节

    Returns:
        时长（秒）
    """
    if len(wav_bytes) < 44:
        return 0.0

    try:
        # 从 WAV 头解析参数
        channels = struct.unpack_from("<H", wav_bytes, 22)[0]
        sample_rate = struct.unpack_from("<I", wav_bytes, 24)[0]
        bits_per_sample = struct.unpack_from("<H", wav_bytes, 34)[0]

        # 找到 data chunk 的大小
        # 简单方式：假设 data chunk 紧跟 fmt chunk
        data_size = struct.unpack_from("<I", wav_bytes, 40)[0]

        if sample_rate == 0 or channels == 0 or bits_per_sample == 0:
            return 0.0

        duration = data_size / (sample_rate * channels * (bits_per_sample // 8))
        return round(duration, 2)
    except Exception:
        return 0.0


def pcm_duration(pcm_bytes: bytes, sample_rate: int = AUDIO_SAMPLE_RATE) -> float:
    """
    计算 PCM16 数据时长

    Args:
        pcm_bytes: PCM16LE 原始数据
        sample_rate: 采样率

    Returns:
        时长（秒）
    """
    num_samples = len(pcm_bytes) // 2  # 16-bit = 2 bytes per sample
    return num_samples / sample_rate if sample_rate > 0 else 0.0

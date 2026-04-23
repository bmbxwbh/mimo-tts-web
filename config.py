"""
MiMo-V2.5-TTS Web UI — 配置常量
"""

# MiMo API 配置
MIMO_API_BASE_URL = "https://api.xiaomimimo.com/v1"
MIMO_API_ENDPOINT = "/chat/completions"

# 支持的模型
MODELS = {
    "preset": "mimo-v2.5-tts",
    "voicedesign": "mimo-v2.5-tts-voicedesign",
    "voiceclone": "mimo-v2.5-tts-voiceclone",
}

# 预置音色列表
PRESET_VOICES = [
    {"id": "mimo_default", "name": "MiMo-默认", "language": "多语言", "gender": "neutral"},
    {"id": "冰糖", "name": "冰糖", "language": "中文", "gender": "female"},
    {"id": "茉莉", "name": "茉莉", "language": "中文", "gender": "female"},
    {"id": "苏打", "name": "苏打", "language": "中文", "gender": "male"},
    {"id": "白桦", "name": "白桦", "language": "中文", "gender": "male"},
    {"id": "Mia", "name": "Mia", "language": "英文", "gender": "female"},
    {"id": "Chloe", "name": "Chloe", "language": "英文", "gender": "female"},
    {"id": "Milo", "name": "Milo", "language": "英文", "gender": "male"},
    {"id": "Dean", "name": "Dean", "language": "英文", "gender": "male"},
]

# 音频配置
AUDIO_SAMPLE_RATE = 24000
AUDIO_CHANNELS = 1
AUDIO_SAMPLE_WIDTH = 2  # 16-bit PCM

# 风格标签列表
STYLE_TAGS = {
    "情绪": ["开心", "悲伤", "愤怒", "恐惧", "惊讶", "兴奋", "委屈", "平静", "冷漠"],
    "复合情绪": ["怅然", "欣慰", "无奈", "愧疚", "释然", "嫉妒", "厌倦", "忐忑", "动情"],
    "语调": ["温柔", "高冷", "活泼", "严肃", "慵懒", "俏皮", "深沉", "干练", "凌厉"],
    "音色": ["磁性", "醇厚", "清亮", "空灵", "稚嫩", "苍老", "甜美", "沙哑", "醇雅"],
    "人设": ["夹子音", "御姐音", "正太音", "大叔音", "台湾腔"],
    "方言": ["东北话", "四川话", "河南话", "粤语"],
    "角色扮演": ["孙悟空", "林黛玉"],
    "唱歌": ["唱歌"],
}

# 音频标签列表
AUDIO_TAGS = [
    "吸气", "深呼吸", "叹气", "长叹一口气", "喘息", "屏息",
    "紧张", "害怕", "激动", "疲惫", "委屈", "撒娇", "心虚", "震惊", "不耐烦",
    "颤抖", "声音颤抖", "变调", "破音", "鼻音", "气声", "沙哑",
    "笑", "轻笑", "大笑", "冷笑", "抽泣", "呜咽", "哽咽", "嚎啕大哭",
]

# 音色设计预设模板
VOICE_DESIGN_TEMPLATES = [
    "温柔甜美的年轻女性",
    "低沉磁性的成熟男性",
    "活泼俏皮的少女",
    "苍老慈祥的老人",
]

# 文件大小限制
MAX_AUDIO_BASE64_SIZE = 10 * 1024 * 1024  # 10MB

# 服务器配置
SERVER_HOST = "0.0.0.0"
SERVER_PORT = 26645

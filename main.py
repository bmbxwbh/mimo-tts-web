"""
MiMo-V2.5-TTS Web UI — FastAPI 入口

基于小米 MiMo-V2.5-TTS 系列 API 的语音合成 Web 应用。
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import health, synthesize
from config import SERVER_HOST, SERVER_PORT


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    print("=" * 50)
    print("  MiMo-V2.5-TTS Web UI")
    print(f"  http://{SERVER_HOST}:{SERVER_PORT}")
    print("=" * 50)
    yield
    print("Shutting down...")


app = FastAPI(
    title="MiMo-V2.5-TTS Web UI",
    description="基于小米 MiMo-V2.5-TTS 系列 API 的语音合成 Web 应用",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 中间件 — 允许前端跨域调用
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(health.router)
app.include_router(synthesize.router)

# 挂载静态文件（必须放在路由之后）
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", SERVER_PORT))
    workers = int(os.environ.get("WORKERS", 1))

    uvicorn.run(
        "main:app",
        host=SERVER_HOST,
        port=port,
        workers=workers,
        reload=os.environ.get("RELOAD", "false").lower() == "true",
    )

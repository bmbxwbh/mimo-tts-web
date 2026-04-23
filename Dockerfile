FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 26645

CMD echo "=========================================" && \
    echo "  MiMo-V2.5-TTS Web UI 已启动" && \
    echo "  访问地址: http://localhost:26645" && \
    echo "=========================================" && \
    uvicorn main:app --host 0.0.0.0 --port 26645

FROM python:3.11-slim
WORKDIR /app
COPY ai-agent/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY ai-agent ./ai-agent
COPY eligibility-engine ./eligibility-engine
WORKDIR /app/ai-agent
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001"]

FROM python:3.11-slim

WORKDIR /app

# torch + sentence-transformers önceden derlenmiş (manylinux) wheel ile gelir;
# build-essential gerekmez (apt mirror erişimi de bu ortamda güvenilmez).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

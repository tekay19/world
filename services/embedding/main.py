"""
Anahtarsız self-hosted çok dilli embedding servisi.
Kümeleme/dedup için kullanılır — kullanıcının BYOK anahtarına BAĞLI DEĞİL.
Model: intfloat/multilingual-e5-small (384 dim). Türkçe morfolojisi için çok dilli model.

Çalıştırma (yerel):  uvicorn main:app --port 8000
Docker:             docker compose --profile ai up embedding
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import List, Literal

from fastapi import FastAPI
from pydantic import BaseModel

MODEL_NAME = os.getenv("EMBEDDING_MODEL", "intfloat/multilingual-e5-small")

app = FastAPI(title="Dünya Analiz — Embedding", version="0.2.0")


@lru_cache(maxsize=1)
def get_model():
    # Ağır import tembel yüklenir (servis hızlı açılsın).
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(MODEL_NAME)


class EmbedRequest(BaseModel):
    texts: List[str]
    # e5 ailesi "query:" / "passage:" ön ekleriyle daha iyi çalışır.
    kind: Literal["query", "passage"] = "passage"


class EmbedResponse(BaseModel):
    model: str
    dim: int
    embeddings: List[List[float]]


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest) -> EmbedResponse:
    model = get_model()
    prefixed = [f"{req.kind}: {t}" for t in req.texts]
    vectors = model.encode(prefixed, normalize_embeddings=True)
    embeddings = [v.tolist() for v in vectors]
    dim = len(embeddings[0]) if embeddings else 0
    return EmbedResponse(model=MODEL_NAME, dim=dim, embeddings=embeddings)

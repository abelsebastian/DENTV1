"""
Smart DentalOps — NLP Sentiment Analysis Microservice
Uses DistilBERT fine-tuned on SST-2 (binary sentiment).

Run:
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8001 --reload
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import pipeline

# ── Model — loaded once at startup ────────────────────────────────────────────
MODEL_NAME = "distilbert-base-uncased-finetuned-sst-2-english"
sentiment_pipeline = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the model on startup, release on shutdown."""
    global sentiment_pipeline
    print(f"Loading model: {MODEL_NAME} ...")
    sentiment_pipeline = pipeline(
        "sentiment-analysis",
        model=MODEL_NAME,
        truncation=True,
        max_length=512,
    )
    print("Model ready.")
    yield
    sentiment_pipeline = None
    print("Model released.")


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Smart DentalOps — NLP Sentiment Service",
    description="DistilBERT-based sentiment analysis for patient communications",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ────────────────────────────────────────────────────────────────────
class SentimentRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Patient message text")


class SentimentResponse(BaseModel):
    label: str = Field(..., description="POSITIVE or NEGATIVE")
    score: float = Field(..., description="Confidence score (0–1)")


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "model_loaded": sentiment_pipeline is not None,
    }


@app.post("/nlp/sentiment", response_model=SentimentResponse)
def analyze_sentiment(payload: SentimentRequest):
    if sentiment_pipeline is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet.")

    result = sentiment_pipeline(payload.text)[0]

    return SentimentResponse(
        label=result["label"],          # "POSITIVE" or "NEGATIVE"
        score=round(result["score"], 4),
    )

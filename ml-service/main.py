"""
Smart DentalOps — No-Show Prediction Microservice
Run: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import numpy as np
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Smart DentalOps — No-Show Prediction",
    description="ML microservice for appointment no-show risk scoring",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load model ─────────────────────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

def load_model():
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(
            "model.pkl not found. Run `python train.py` first."
        )
    return joblib.load(MODEL_PATH)

try:
    model = load_model()
except RuntimeError as e:
    model = None
    print(f"WARNING: {e}")


# ── Schemas ────────────────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    age: int = Field(..., ge=0, le=120, description="Patient age in years")
    lead_time: int = Field(..., ge=0, description="Days between booking and appointment")
    previous_no_shows: int = Field(..., ge=0, description="Number of past no-shows")
    appointment_day: int = Field(..., ge=0, le=6, description="Day of week: 0=Mon … 6=Sun")


class PredictResponse(BaseModel):
    probability: float = Field(..., description="No-show probability (0–1)")
    risk: str = Field(..., description="Risk level: LOW | MEDIUM | HIGH")


# ── Helpers ────────────────────────────────────────────────────────────────────
def classify_risk(probability: float) -> str:
    if probability >= 0.55:
        return "HIGH"
    if probability >= 0.30:
        return "MEDIUM"
    return "LOW"


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.post("/predict/no-show", response_model=PredictResponse)
def predict_no_show(payload: PredictRequest):
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Run `python train.py` to generate model.pkl.",
        )

    features = np.array([[
        payload.age,
        payload.lead_time,
        payload.previous_no_shows,
        payload.appointment_day,
    ]])

    probability = float(model.predict_proba(features)[0][1])
    risk = classify_risk(probability)

    return PredictResponse(probability=round(probability, 4), risk=risk)

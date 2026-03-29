"""
Smart DentalOps — ANN No-Show Prediction Microservice (PyTorch)
Run: uvicorn main:app --host 0.0.0.0 --port 8003 --reload
"""

import os
import numpy as np
import joblib
import torch
import torch.nn as nn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── ANN architecture (must match train.py) ────────────────────────────────────
def build_model():
    return nn.Sequential(
        nn.Linear(4, 16), nn.ReLU(),
        nn.Linear(16, 8), nn.ReLU(),
        nn.Linear(8,  1), nn.Sigmoid(),
    )


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Smart DentalOps — ANN No-Show Prediction",
    description="PyTorch ANN microservice for appointment no-show risk scoring",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load model + scaler ────────────────────────────────────────────────────────
BASE        = os.path.dirname(__file__)
MODEL_PATH  = os.path.join(BASE, 'ann_model.pt')
SCALER_PATH = os.path.join(BASE, 'scaler.pkl')

model  = None
scaler = None

try:
    model = build_model()
    model.load_state_dict(torch.load(MODEL_PATH, weights_only=True))
    model.eval()
    scaler = joblib.load(SCALER_PATH)
    print("ANN model and scaler loaded.")
except Exception as e:
    print(f"WARNING: Could not load model — {e}. Run `python train.py` first.")


# ── Schemas ────────────────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    age: int               = Field(..., ge=0, le=120, description="Patient age in years")
    lead_time: int         = Field(..., ge=0,         description="Days between booking and appointment")
    previous_no_shows: int = Field(..., ge=0,         description="Number of past no-shows")
    appointment_day: int   = Field(..., ge=0, le=6,   description="Day of week: 0=Mon … 6=Sun")


class PredictResponse(BaseModel):
    probability: float = Field(..., description="No-show probability (0–1)")
    risk: str          = Field(..., description="LOW | MEDIUM | HIGH")


# ── Helpers ────────────────────────────────────────────────────────────────────
def classify_risk(p: float) -> str:
    if p >= 0.55: return "HIGH"
    if p >= 0.30: return "MEDIUM"
    return "LOW"


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.post("/predict/no-show-ann", response_model=PredictResponse)
def predict_no_show_ann(payload: PredictRequest):
    if model is None or scaler is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Run `python train.py` to generate ann_model.pt.",
        )

    features = np.array([[
        payload.age,
        payload.lead_time,
        payload.previous_no_shows,
        payload.appointment_day,
    ]], dtype=float)

    features_scaled = scaler.transform(features)
    tensor = torch.tensor(features_scaled, dtype=torch.float32)

    with torch.no_grad():
        probability = float(model(tensor)[0][0].item())

    return PredictResponse(
        probability=round(probability, 4),
        risk=classify_risk(probability),
    )

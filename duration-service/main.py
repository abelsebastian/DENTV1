"""
Smart DentalOps — Procedure Duration Prediction Microservice
Run: uvicorn main:app --host 0.0.0.0 --port 8002 --reload
"""

import os
import numpy as np
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Smart DentalOps — Duration Prediction",
    description="Predicts procedure duration in minutes using Linear Regression",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load model ─────────────────────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), "duration_model.pkl")

try:
    model = joblib.load(MODEL_PATH)
except FileNotFoundError:
    model = None
    print("WARNING: duration_model.pkl not found. Run `python train.py` first.")


# ── Schemas ────────────────────────────────────────────────────────────────────
class DurationRequest(BaseModel):
    procedure_type: int = Field(
        ..., ge=0, le=5,
        description="0=Checkup, 1=Cleaning, 2=Filling, 3=RootCanal, 4=Extraction, 5=Crown"
    )
    dentist_experience: int = Field(..., ge=0, description="Years of experience")
    past_avg_duration: int = Field(..., ge=1, description="Patient's past average duration (minutes)")


class DurationResponse(BaseModel):
    predicted_duration: float = Field(..., description="Predicted duration in minutes")


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.post("/predict/duration", response_model=DurationResponse)
def predict_duration(payload: DurationRequest):
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Run `python train.py` to generate duration_model.pkl.",
        )

    features = np.array([[
        payload.procedure_type,
        payload.dentist_experience,
        payload.past_avg_duration,
    ]])

    predicted = float(model.predict(features)[0])
    # Clamp to realistic bounds
    predicted = round(max(15.0, min(180.0, predicted)), 1)

    return DurationResponse(predicted_duration=predicted)

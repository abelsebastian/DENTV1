"""
Train the procedure duration prediction model and save as duration_model.pkl.
Run once before starting the API: python train.py
"""

import numpy as np
import joblib
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

np.random.seed(42)
N = 1500

# procedure_type: 0=Checkup, 1=Cleaning, 2=Filling, 3=RootCanal, 4=Extraction, 5=Crown
procedure_type     = np.random.randint(0, 6, N)
dentist_experience = np.random.randint(1, 30, N)   # years
past_avg_duration  = np.random.randint(20, 120, N) # minutes

X = np.column_stack([procedure_type, dentist_experience, past_avg_duration])

# Base durations per procedure type (minutes)
base = np.array([30, 45, 60, 90, 50, 75])

# Duration logic:
#   - procedure type drives the base time
#   - more experience → slightly faster (-1 min per year)
#   - past avg duration has strong influence (patient/complexity factor)
duration = (
    base[procedure_type]
    - 1.0 * dentist_experience
    + 0.5 * past_avg_duration
    + np.random.normal(0, 5, N)   # noise
).clip(15, 180)                   # clamp to realistic range

print(f"Dataset: {N} samples | avg duration: {duration.mean():.1f} min")

model = Pipeline([
    ("scaler", StandardScaler()),
    ("reg",    LinearRegression()),
])
model.fit(X, duration)

joblib.dump(model, "duration_model.pkl")
print("Model saved → duration_model.pkl")

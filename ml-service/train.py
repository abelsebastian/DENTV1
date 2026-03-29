"""
Train the no-show prediction model and save it as model.pkl.
Run once before starting the API: python train.py
"""

import numpy as np
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

np.random.seed(42)
N = 2000

# Features: age, lead_time (days), previous_no_shows, appointment_day (0=Mon..6=Sun)
age               = np.random.randint(18, 80, N)
lead_time         = np.random.randint(0, 60, N)
previous_no_shows = np.random.randint(0, 8, N)
appointment_day   = np.random.randint(0, 7, N)

X = np.column_stack([age, lead_time, previous_no_shows, appointment_day])

# Label logic that mirrors real-world patterns:
#   - more previous no-shows  → higher risk
#   - longer lead time        → higher risk
#   - younger patients        → slightly higher risk
#   - Mon (0) and Fri (4)     → higher risk
logit = (
    -3.0
    + 0.40 * previous_no_shows
    + 0.03 * lead_time
    - 0.01 * age
    + 0.20 * ((appointment_day == 0) | (appointment_day == 4)).astype(float)
)
prob = 1 / (1 + np.exp(-logit))
y = (np.random.rand(N) < prob).astype(int)

print(f"Dataset: {N} samples | no-show rate: {y.mean():.1%}")

model = Pipeline([
    ("scaler", StandardScaler()),
    ("clf",    LogisticRegression(max_iter=500, random_state=42)),
])
model.fit(X, y)

joblib.dump(model, "model.pkl")
print("Model saved → model.pkl")

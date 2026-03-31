"""
Train the procedure duration prediction model and save as duration_model.pkl.
Run once before starting the API: python train.py
"""

import numpy as np
import joblib
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

np.random.seed(42)
N = 40000

# procedure_type: 0=Checkup, 1=Cleaning, 2=Filling, 3=RootCanal, 4=Extraction, 5=Crown
procedure_type     = np.random.randint(0, 6, N)
dentist_experience = np.random.randint(1, 30, N)   # years
past_avg_duration  = np.random.randint(20, 120, N) # minutes

X = np.column_stack([procedure_type, dentist_experience, past_avg_duration])

# Base durations per procedure type (minutes)
base = np.array([30, 45, 60, 90, 50, 75])

duration = (
    base[procedure_type]
    - 1.0 * dentist_experience
    + 0.5 * past_avg_duration
    + np.random.normal(0, 5, N)
).clip(15, 180)

print(f"Dataset: {N} samples | avg duration: {duration.mean():.1f} min")

# Train / test split
X_train, X_test, y_train, y_test = train_test_split(X, duration, test_size=0.2, random_state=42)

model = Pipeline([
    ("scaler", StandardScaler()),
    ("reg",    LinearRegression()),
])
model.fit(X_train, y_train)

# ── Regression metrics ────────────────────────────────────────────────────────
y_pred = model.predict(X_test)

mae  = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
r2   = r2_score(y_test, y_pred)

print("\n── Linear Regression (Duration) — Evaluation Metrics ─────────")
print(f"  MAE  (Mean Absolute Error)  : {mae:.2f} min")
print(f"  RMSE (Root Mean Sq. Error)  : {rmse:.2f} min")
print(f"  R²   (Coefficient of Det.)  : {r2:.4f}  ({r2*100:.2f}% variance explained)")
print(f"\n  Sample predictions vs actual:")
for i in range(5):
    print(f"    Predicted: {y_pred[i]:.1f} min  |  Actual: {y_test[i]:.1f} min  |  Error: {abs(y_pred[i]-y_test[i]):.1f} min")
print("──────────────────────────────────────────────────────────────")

joblib.dump(model, "duration_model.pkl")
print("Model saved → duration_model.pkl")

"""
Train the no-show prediction model and save it as model.pkl.
Run once before starting the API: python train.py
"""

import numpy as np
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score,
    recall_score, confusion_matrix, classification_report
)

np.random.seed(42)
N = 40000

# Features: age, lead_time (days), previous_no_shows, appointment_day (0=Mon..6=Sun)
age               = np.random.randint(18, 80, N)
lead_time         = np.random.randint(0, 60, N)
previous_no_shows = np.random.randint(0, 8, N)
appointment_day   = np.random.randint(0, 7, N)

X = np.column_stack([age, lead_time, previous_no_shows, appointment_day])

# Label logic that mirrors real-world patterns:
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

# Train / test split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = Pipeline([
    ("scaler", StandardScaler()),
    ("clf",    LogisticRegression(max_iter=500, random_state=42)),
])
model.fit(X_train, y_train)

# ── Evaluation metrics ────────────────────────────────────────────────────────
y_pred = model.predict(X_test)

accuracy  = accuracy_score(y_test, y_pred)
f1        = f1_score(y_test, y_pred, zero_division=0)
precision = precision_score(y_test, y_pred, zero_division=0)
recall    = recall_score(y_test, y_pred, zero_division=0)
cm        = confusion_matrix(y_test, y_pred)

print("\n── Logistic Regression — Evaluation Metrics ──────────────────")
print(f"  Accuracy  : {accuracy:.4f}  ({accuracy*100:.2f}%)")
print(f"  F1 Score  : {f1:.4f}")
print(f"  Precision : {precision:.4f}")
print(f"  Recall    : {recall:.4f}")
print(f"\n  Confusion Matrix:")
print(f"              Predicted 0   Predicted 1")
print(f"  Actual 0  :     {cm[0][0]:5d}         {cm[0][1]:5d}")
print(f"  Actual 1  :     {cm[1][0]:5d}         {cm[1][1]:5d}")
print(f"\n  TN={cm[0][0]}  FP={cm[0][1]}  FN={cm[1][0]}  TP={cm[1][1]}")
print("\n" + classification_report(y_test, y_pred, target_names=["Show", "No-Show"]))
print("──────────────────────────────────────────────────────────────")

joblib.dump(model, "model.pkl")
print("Model saved → model.pkl")

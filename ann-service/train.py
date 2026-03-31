"""
Train ANN no-show prediction model using PyTorch.
Saves: ann_model.pt + scaler.pkl
Run once: python train.py
"""

import numpy as np
import joblib
import torch
import torch.nn as nn
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score,
    recall_score, confusion_matrix, classification_report
)

np.random.seed(42)
torch.manual_seed(42)
N = 40000

# Features: age, lead_time, previous_no_shows, appointment_day (0=Mon..6=Sun)
age               = np.random.randint(18, 80, N)
lead_time         = np.random.randint(0, 60, N)
previous_no_shows = np.random.randint(0, 8, N)
appointment_day   = np.random.randint(0, 7, N)

X = np.column_stack([age, lead_time, previous_no_shows, appointment_day]).astype(float)

# Label logic — same as ml-service for consistency
logit = (
    -3.0
    + 0.40 * previous_no_shows
    + 0.03 * lead_time
    - 0.01 * age
    + 0.20 * ((appointment_day == 0) | (appointment_day == 4)).astype(float)
)
prob = 1 / (1 + np.exp(-logit))
y = (np.random.rand(N) < prob).astype(float)

print(f"Dataset: {N} samples | no-show rate: {y.mean():.1%}")

# Train / test split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Normalize
scaler  = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s  = scaler.transform(X_test)

# Tensors
X_tensor = torch.tensor(X_train_s, dtype=torch.float32)
y_tensor = torch.tensor(y_train,   dtype=torch.float32).unsqueeze(1)

# ANN: 4 → 16 → 8 → 1
model = nn.Sequential(
    nn.Linear(4, 16), nn.ReLU(),
    nn.Linear(16, 8), nn.ReLU(),
    nn.Linear(8,  1), nn.Sigmoid(),
)

criterion = nn.BCELoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

# Train
for epoch in range(50):
    model.train()
    optimizer.zero_grad()
    output = model(X_tensor)
    loss   = criterion(output, y_tensor)
    loss.backward()
    optimizer.step()

    if (epoch + 1) % 10 == 0:
        with torch.no_grad():
            preds    = (output >= 0.5).float()
            accuracy = (preds == y_tensor).float().mean().item()
        print(f"Epoch {epoch+1:3d} | loss: {loss.item():.4f} | train acc: {accuracy:.3f}")

# ── Evaluation metrics on test set ───────────────────────────────────────────
model.eval()
with torch.no_grad():
    X_test_tensor = torch.tensor(X_test_s, dtype=torch.float32)
    y_prob  = model(X_test_tensor).squeeze().numpy()
    y_pred  = (y_prob >= 0.5).astype(int)
    y_true  = y_test.astype(int)

accuracy  = accuracy_score(y_true, y_pred)
f1        = f1_score(y_true, y_pred, zero_division=0)
precision = precision_score(y_true, y_pred, zero_division=0)
recall    = recall_score(y_true, y_pred, zero_division=0)
cm        = confusion_matrix(y_true, y_pred)

print("\n── ANN (PyTorch) — Evaluation Metrics ────────────────────────")
print(f"  Accuracy  : {accuracy:.4f}  ({accuracy*100:.2f}%)")
print(f"  F1 Score  : {f1:.4f}")
print(f"  Precision : {precision:.4f}")
print(f"  Recall    : {recall:.4f}")
print(f"\n  Confusion Matrix:")
print(f"              Predicted 0   Predicted 1")
print(f"  Actual 0  :     {cm[0][0]:5d}         {cm[0][1]:5d}")
print(f"  Actual 1  :     {cm[1][0]:5d}         {cm[1][1]:5d}")
print(f"\n  TN={cm[0][0]}  FP={cm[0][1]}  FN={cm[1][0]}  TP={cm[1][1]}")
print("\n" + classification_report(y_true, y_pred, target_names=["Show", "No-Show"]))
print("──────────────────────────────────────────────────────────────")

torch.save(model.state_dict(), 'ann_model.pt')
joblib.dump(scaler, 'scaler.pkl')
print("\nSaved → ann_model.pt, scaler.pkl")

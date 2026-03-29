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

np.random.seed(42)
torch.manual_seed(42)
N = 3000

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

# Normalize
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Tensors
X_tensor = torch.tensor(X_scaled, dtype=torch.float32)
y_tensor = torch.tensor(y,        dtype=torch.float32).unsqueeze(1)

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
        print(f"Epoch {epoch+1:3d} | loss: {loss.item():.4f} | acc: {accuracy:.3f}")

torch.save(model.state_dict(), 'ann_model.pt')
joblib.dump(scaler, 'scaler.pkl')
print("\nSaved → ann_model.pt, scaler.pkl")

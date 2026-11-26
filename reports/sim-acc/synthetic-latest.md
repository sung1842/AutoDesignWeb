# sim:survey dev — n/a

자극물: {"source":"synthetic","normalizer_version":"2026-S0","normalizer_provenance":"temp"}

| 조건 | 변형 | 판정 | RMSE | top-1 | 포함률 | κ |
|---|---|---|---|---|---|---|
| PU-b16 | none | 차단 | 0.111 | 0.780 | 0.904 | 0.900 |
| PU-b8 | none | 차단 | 0.126 | 0.673 | 0.853 | 0.750 |
| PU-b4 | none | 차단 | 0.161 | 0.567 | 0.726 | 0.366 |
| PU-b2 | none | 차단 | 0.199 | 0.450 | 0.576 | 0.172 |
| PC-b8 | none | 차단 | 0.140 | 0.923 | 0.823 | 0.806 |
| PC-b4 | none | 차단 | 0.176 | 0.787 | 0.682 | 0.514 |
| PA-b8 | none | 차단 | 0.137 | 0.943 | 0.840 | 0.868 |
| PU-b8-rand | V-RAND | 차단 | 0.131 | 0.660 | 0.906 | 0.680 |
| PU-b8-prior | V-PRIOR | 차단 | 0.127 | 0.737 | 0.850 | 0.736 |
| PU-b8-none | V-NONE | 차단 | 0.129 | 0.690 | 0.863 | 0.723 |
| PU-b8-meas | V-MEAS | 비차단 | 0.130 | 0.707 | 0.841 | 0.741 |
| PU-b8-lambda | V-LAMBDA | 비차단 | 0.134 | 0.673 | 0.835 | 0.726 |
| PU-b8-pos | V-POS | 비차단 | 0.134 | 0.680 | 0.825 | 0.672 |
| PU-b8-mix | V-MIX | 비차단 | 0.155 | 0.613 | 0.758 | 0.553 |

| 지표 | 값 | 합격선 | 판정 |
|---|---|---|---|
| rmseBeta8Max | 0.1261 | 0.12 | FAIL |
| rmseBeta4Max | 0.1606 | 0.18 | PASS |
| typeAccPCBeta8Min | 0.9233 | 0.85 | PASS |
| typeAccPCBeta4Min | 0.7867 | 0.7 | PASS |
| top1PUMin | 0.6733 | 0.62 | PASS |
| top2PUMin | 0.9000 | 0.85 | PASS |
| anchorAccPABeta8Min | 0.9433 | 0.95 | FAIL (margin_warning) |
| coverage90 | 0.8533 | [0.85,0.95] | PASS |
| consistencyBeta16Min | 0.8997 | 0.5 | PASS |
| consistencyBeta2Max | 0.1724 | 0.25 | PASS |
| adaptiveRmseGainMin | 0.0385 | 0.05 | FAIL (margin_warning) |
| adaptiveTop1GainMinPp | 1.3333 | 3 | FAIL |
| priorTypeChangeMax | 0.0606 | 0.06 | FAIL |
| robustNoneRmseMax | 0.1294 | 0.13 | PASS |
| diagnosis.maxQuestions | 16.0000 | 16 | PASS |
| diagnosis.stage1Questions | 1.0000 | 1 | PASS |
| errors | 0.0000 | 0 | PASS |

import requests

try:
    response = requests.post("http://127.0.0.1:8000/api/catchment-direct", json={
        "lat": 23.0225,
        "lon": 72.5714,
        "time_mins": 10,
        "mode": "drive"
    })
    print("STATUS", response.status_code)
    print("RESPONSE", response.text)
except Exception as e:
    print("REQUEST FAILED", e)

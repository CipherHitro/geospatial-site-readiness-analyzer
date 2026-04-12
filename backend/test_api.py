import requests

res = requests.post("http://localhost:8000/api/demographics/score", json={
    "lat": 23.0225,
    "lng": 72.5714,
    "use_case": "retail"
})
print("STATUS CODE:", res.status_code)
print(res.text)

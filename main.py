from math import radians, sin, cos, sqrt, atan2
import requests
import time
from datetime import datetime

url = "http://api.open-notify.org/iss-now.json"

# position data list relative to one below 
positions = []

def calculate_distance(lat1, lon1, lat2, lon2):
    # Earth's approximate radius in kilometres
    R = 6371

    lat1 = radians(lat1)
    lat2 = radians(lat2)
    lon1 = radians(lon1)
    lon2 = radians(lon2)

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return R * c

def get_iss_position():
    response = requests.get(url)
    data = response.json()

    latitude = float(data["iss_position"]["latitude"])
    longitude = float(data["iss_position"]["longitude"])

    timestamp = data["timestamp"]
    time_now = datetime.fromtimestamp(timestamp)

    return {
        "latitude": latitude,
        "longitude": longitude,
        "time": time_now
    }

while True:
    position = get_iss_position()

    positions.append(position)

    if len(positions) >= 2:
        previous = positions[-2]
        current = positions[-1]

        distance = calculate_distance(
        previous["latitude"],
        previous["longitude"],
        current["latitude"],
        current["longitude"]
        )

        time_elapsed = (
        current["time"] - previous["time"]
        ).total_seconds()

        speed = distance / (time_elapsed / 3600)

        print("Speed:", round(speed, 2), "km/h")

    if len(positions) > 100:
     positions.pop(0)

    print("Time:", position["time"])
    print("Latitude:", position["latitude"])
    print("Longitude:", position["longitude"])
    print("-  -  -")
    print("Position:", position["latitude"], position["longitude"])
    print("Points stored:", len(positions))
    print("----------------")

    time.sleep(5)
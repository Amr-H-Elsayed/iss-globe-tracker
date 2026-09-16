from math import radians, sin, cos, sqrt, atan2
import requests
from datetime import datetime

from dash import Dash, html, dcc, Input, Output

url = "http://api.open-notify.org/iss-now.json"

# Position data list
positions = []


# Calculates distance between two points on Earth
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


# Gets the ISS position
def get_iss_position():
    response = requests.get(url, timeout=10)
    response.raise_for_status()

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


# Creates the Dash application
app = Dash(__name__)


# Page layout
app.layout = html.Div([

    html.Div(
        id="iss-map",
        style={
            "width": "100%",
            "height": "700px"
        }
    ),

    dcc.Interval(
        id="update-interval",
        interval=5000,
        n_intervals=0
    ),

    dcc.Store(
        id="iss-position"
    ),

    html.Div(
        id="map-update"
    )
])


# Gets a new ISS position every 5 seconds
@app.callback(
    Output("iss-position", "data"),
    Input("update-interval", "n_intervals")
)
def update_position(n):

    position = get_iss_position()

    print("ISS:", position["latitude"], position["longitude"])

    return {
        "latitude": position["latitude"],
        "longitude": position["longitude"]
    }


# Sends the position from Python to the JavaScript map
app.clientside_callback(
    """
    function(position) {

        if (!position || !window.issMarker) {
            return "";
        }

        window.issMarker.setLngLat([
            position.longitude,
            position.latitude
        ]);

        return "";

    }
    """,

    Output("map-update", "children"),

    Input("iss-position", "data")
)


if __name__ == "__main__":
    app.run(debug=True)
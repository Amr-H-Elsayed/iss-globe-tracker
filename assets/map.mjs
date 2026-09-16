import * as maplibregl from "https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs";


const style = {
    version: 8,

    sources: {
        satellite: {
            type: "raster",
            tiles: [
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            ],
            tileSize: 256,
            attribution: "Tiles © Esri"
        }
    },

    layers: [
        {
            id: "satellite",
            type: "raster",
            source: "satellite"
        }
    ]
};


// Store the most recent ISS position
window.latestISSPosition = null;


// Create this BEFORE the map exists.
//
// Your existing Dash callback calls:
// window.issMarker.setLngLat([longitude, latitude])
//
// This object catches that call even if the map hasn't loaded yet.
window.issMarker = {

    setLngLat: function (coordinates) {

        // Always remember the latest position
        window.latestISSPosition = coordinates;

        // If the map isn't ready yet, stop here.
        if (!window.issMap) {
            return;
        }

        const source = window.issMap.getSource("iss");

        // If the GeoJSON source isn't ready yet, stop here.
        if (!source) {
            return;
        }

        // Update the actual ISS point
        source.setData({
            type: "Feature",

            geometry: {
                type: "Point",
                coordinates: coordinates
            }
        });

        console.log("ISS position:", coordinates);
    }
};


function createMap() {

    const container = document.getElementById("iss-map");

    if (!container || window.issMap) {
        return;
    }


    const map = new maplibregl.Map({

        container: "iss-map",

        style: style,

        center: [30, 20],

        zoom: 1
    });


    map.on("style.load", function () {

        map.setProjection({
            type: "globe"
        });


        // Make the map globally accessible
        window.issMap = map;


        // Create the ISS GeoJSON source
        map.addSource("iss", {

            type: "geojson",

            data: {

                type: "Feature",

                geometry: {

                    type: "Point",

                    coordinates: [0, 0]
                }
            }
        });


        // Create the ISS marker
        map.addLayer({

            id: "iss",

            type: "circle",

            source: "iss",

            paint: {

                "circle-radius": 9,

                "circle-color": "#ff0000",

                "circle-stroke-color": "#ffffff",

                "circle-stroke-width": 3
            }
        });


        // If Dash sent an ISS position BEFORE the map
        // finished loading, apply that saved position now.
        if (window.latestISSPosition) {

            window.issMarker.setLngLat(
                window.latestISSPosition
            );
        }


        console.log("Map ready");

    });
}


// Wait for Dash to create the map container
const checkForMap = setInterval(function () {

    if (document.getElementById("iss-map")) {

        clearInterval(checkForMap);

        createMap();
    }

}, 100);
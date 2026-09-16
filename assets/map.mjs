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
        id: "space-background",
        type: "background",
        paint: {
            "background-color": "#020611"
        }
    },

    {
        id: "satellite",
        type: "raster",
        source: "satellite"
    }
]
};


// ==================================================
// ISS STATE
// ==================================================

window.latestISSPosition = null;

let previousPosition = null;
let targetPosition = null;

let animationStartTime = null;

const animationDuration = 5000;


// Real positions received from the API.
const realTrail = [];


// ==================================================
// ORBIT SETTINGS
// ==================================================

const EARTH_RADIUS = 6371;

const EARTH_ROTATION_RATE =
    7.2921159e-5;


// ISS orbital period.
//
// NASA gives approximately 90 minutes.
const ORBITAL_PERIOD = 90 * 60;


// Angular velocity of the ISS around Earth.
const ORBITAL_RATE =
    (2 * Math.PI) / ORBITAL_PERIOD;


// How much predicted orbit to display.
const PREDICTION_MINUTES = 45;


// Number of points used to draw the predicted path.
const PREDICTION_POINTS = 270;


// ==================================================
// VECTOR FUNCTIONS
// ==================================================

function vectorAdd(a, b) {

    return [
        a[0] + b[0],
        a[1] + b[1],
        a[2] + b[2]
    ];
}


function vectorSubtract(a, b) {

    return [
        a[0] - b[0],
        a[1] - b[1],
        a[2] - b[2]
    ];
}


function vectorMultiply(a, scalar) {

    return [
        a[0] * scalar,
        a[1] * scalar,
        a[2] * scalar
    ];
}


function crossProduct(a, b) {

    return [
        a[1] * b[2] - a[2] * b[1],

        a[2] * b[0] - a[0] * b[2],

        a[0] * b[1] - a[1] * b[0]
    ];
}


function vectorLength(v) {

    return Math.sqrt(
        v[0] ** 2 +
        v[1] ** 2 +
        v[2] ** 2
    );
}


function normalize(v) {

    const length = vectorLength(v);

    if (length === 0) {
        return [0, 0, 0];
    }

    return [
        v[0] / length,
        v[1] / length,
        v[2] / length
    ];
}


// ==================================================
// COORDINATE CONVERSION
// ==================================================

function latLonToVector(latitude, longitude) {

    const lat = latitude * Math.PI / 180;
    const lon = longitude * Math.PI / 180;

    return [
        Math.cos(lat) * Math.cos(lon),
        Math.cos(lat) * Math.sin(lon),
        Math.sin(lat)
    ];
}


function vectorToLatLon(vector) {

    const v = normalize(vector);

    const latitude =
        Math.asin(v[2]) * 180 / Math.PI;

    const longitude =
        Math.atan2(v[1], v[0]) * 180 / Math.PI;

    return [
        longitude,
        latitude
    ];
}


// ==================================================
// LONGITUDE HANDLING
// ==================================================

function normalizeLongitude(longitude) {

    while (longitude > 180) {
        longitude -= 360;
    }

    while (longitude < -180) {
        longitude += 360;
    }

    return longitude;
}


function shortestLongitudeDifference(from, to) {

    let difference = to - from;

    if (difference > 180) {
        difference -= 360;
    }

    if (difference < -180) {
        difference += 360;
    }

    return difference;
}


// ==================================================
// ISS SMOOTH MOVEMENT
// ==================================================

function interpolatePosition(from, to, progress) {

    const longitudeDifference =
        shortestLongitudeDifference(
            from[0],
            to[0]
        );

    return [

        from[0] +
        longitudeDifference * progress,

        from[1] +
        (to[1] - from[1]) * progress
    ];
}


function updateISSPosition(coordinates) {

    if (!window.issMap) {
        return;
    }

    const source =
        window.issMap.getSource("iss");

    if (!source) {
        return;
    }

    source.setData({

        type: "Feature",

        geometry: {
            type: "Point",
            coordinates: coordinates
        }
    });
}


function animateISS(timestamp) {

    if (!previousPosition || !targetPosition) {
        return;
    }

    if (!animationStartTime) {
        animationStartTime = timestamp;
    }

    let progress =
        (timestamp - animationStartTime)
        / animationDuration;

    progress = Math.min(progress, 1);


    const currentPosition =
        interpolatePosition(
            previousPosition,
            targetPosition,
            progress
        );


    updateISSPosition(currentPosition);


    if (progress < 1) {

        requestAnimationFrame(
            animateISS
        );

    } else {

        previousPosition =
            targetPosition;

        animationStartTime = null;
    }
}


// ==================================================
// ORBIT MODEL
// ==================================================

let orbitNormal = null;
let orbitReference = null;


// Build an approximate orbital plane from
// two real ISS positions.
//
// We estimate velocity from the change in
// position between API samples.
function updateOrbitModel() {

    if (realTrail.length < 2) {
        return;
    }


    const current =
        realTrail[realTrail.length - 1];

    const previous =
        realTrail[realTrail.length - 2];


    const currentVector =
        latLonToVector(
            current[1],
            current[0]
        );


    const previousVector =
        latLonToVector(
            previous[1],
            previous[0]
        );


    // Ground-fixed movement vector.
    const movement =
        vectorSubtract(
            currentVector,
            previousVector
        );


    if (vectorLength(movement) === 0) {
        return;
    }


    // Approximate orbital-plane normal.
    //
    // This is a simplified model, but over
    // tens of minutes it gives us a useful
    // orbital-shaped prediction.
    const normal =
        crossProduct(
            currentVector,
            movement
        );


    if (vectorLength(normal) === 0) {
        return;
    }


    orbitNormal =
        normalize(normal);


    orbitReference =
        normalize(currentVector);
}


// ==================================================
// ROTATE A VECTOR AROUND AN AXIS
// ==================================================

function rotateAroundAxis(vector, axis, angle) {

    const cosAngle =
        Math.cos(angle);

    const sinAngle =
        Math.sin(angle);


    const term1 =
        vectorMultiply(
            vector,
            cosAngle
        );


    const term2 =
        vectorMultiply(
            crossProduct(
                axis,
                vector
            ),
            sinAngle
        );


    const axisDotVector =
        axis[0] * vector[0] +
        axis[1] * vector[1] +
        axis[2] * vector[2];


    const term3 =
        vectorMultiply(
            axis,
            axisDotVector *
            (1 - cosAngle)
        );


    return normalize(
        vectorAdd(
            vectorAdd(
                term1,
                term2
            ),
            term3
        )
    );
}


// ==================================================
// PREDICT FUTURE/PREVIOUS ORBIT
// ==================================================

function generatePredictedOrbit() {

    if (!orbitNormal || !orbitReference) {
        return null;
    }


    const totalSeconds =
        PREDICTION_MINUTES * 60;


    const stepSeconds =
        totalSeconds /
        PREDICTION_POINTS;


    const past = [];
    const future = [];


    // --------------------------------------------------
    // FUTURE
    // --------------------------------------------------

    for (
        let i = 1;
        i <= PREDICTION_POINTS;
        i++
    ) {

        const seconds =
            i * stepSeconds;


        // Move around the orbital plane.
        let inertialVector =
            rotateAroundAxis(
                orbitReference,
                orbitNormal,
                ORBITAL_RATE * seconds
            );


        // Compensate for Earth's rotation.
        inertialVector =
            rotateAroundAxis(
                inertialVector,
                [0, 0, 1],
                -EARTH_ROTATION_RATE * seconds
            );


        future.push(
            vectorToLatLon(
                inertialVector
            )
        );
    }


    // --------------------------------------------------
    // PAST
    // --------------------------------------------------

    for (
        let i = PREDICTION_POINTS;
        i >= 1;
        i--
    ) {

        const seconds =
            i * stepSeconds;


        let inertialVector =
            rotateAroundAxis(
                orbitReference,
                orbitNormal,
                -ORBITAL_RATE * seconds
            );


        inertialVector =
            rotateAroundAxis(
                inertialVector,
                [0, 0, 1],
                EARTH_ROTATION_RATE * seconds
            );


        past.push(
            vectorToLatLon(
                inertialVector
            )
        );
    }


    return {
        past,
        future
    };
}


// ==================================================
// SPLIT LINES AT THE INTERNATIONAL DATE LINE
// ==================================================

function splitDateline(coordinates) {

    const segments = [];

    let currentSegment = [];


    for (let i = 0; i < coordinates.length; i++) {

        const point = coordinates[i];


        if (currentSegment.length === 0) {

            currentSegment.push(point);

            continue;
        }


        const previous =
            currentSegment[
                currentSegment.length - 1
            ];


        const longitudeJump =
            Math.abs(
                point[0] -
                previous[0]
            );


        if (longitudeJump > 180) {

            if (currentSegment.length > 1) {
                segments.push(currentSegment);
            }

            currentSegment = [point];

        } else {

            currentSegment.push(point);
        }
    }


    if (currentSegment.length > 1) {
        segments.push(currentSegment);
    }


    return segments;
}


// ==================================================
// UPDATE ORBIT TRAILS
// ==================================================

function updateOrbitTrails() {

    if (!window.issMap) {
        return;
    }


    const prediction =
        generatePredictedOrbit();


    if (!prediction) {
        return;
    }


    const pastSource =
        window.issMap.getSource(
            "iss-past"
        );


    const futureSource =
        window.issMap.getSource(
            "iss-future"
        );


    if (!pastSource || !futureSource) {
        return;
    }


    const pastSegments =
        splitDateline(
            prediction.past
        );


    const futureSegments =
        splitDateline(
            prediction.future
        );


    pastSource.setData({

        type: "FeatureCollection",

        features:
            pastSegments.map(
                coordinates => ({

                    type: "Feature",

                    properties: {},

                    geometry: {

                        type: "LineString",

                        coordinates
                    }
                })
            )
    });


    futureSource.setData({

        type: "FeatureCollection",

        features:
            futureSegments.map(
                coordinates => ({

                    type: "Feature",

                    properties: {},

                    geometry: {

                        type: "LineString",

                        coordinates
                    }
                })
            )
    });
}


// ==================================================
// RECEIVE REAL ISS POSITION
// ==================================================

window.issMarker = {

    setLngLat: function (coordinates) {

        window.latestISSPosition =
            coordinates;


        // ------------------------------------------
        // FIRST POSITION
        // ------------------------------------------

        if (!previousPosition) {

            previousPosition =
                coordinates;

            targetPosition =
                coordinates;

            updateISSPosition(
                coordinates
            );

            realTrail.push(
                coordinates
            );

            return;
        }


        // ------------------------------------------
        // ADD REAL POSITION
        // ------------------------------------------

        realTrail.push(
            coordinates
        );


        if (realTrail.length > 20) {
            realTrail.shift();
        }


        // ------------------------------------------
        // UPDATE ORBIT MODEL
        // ------------------------------------------

        updateOrbitModel();


        updateOrbitTrails();


        // ------------------------------------------
        // SMOOTH LIVE MARKER
        // ------------------------------------------

        const longitudeDifference =
            shortestLongitudeDifference(
                previousPosition[0],
                coordinates[0]
            );


        const latitudeDifference =
            coordinates[1] -
            previousPosition[1];


        const difference =
            Math.sqrt(
                longitudeDifference ** 2 +
                latitudeDifference ** 2
            );


        // If something went seriously wrong,
        // trust the real API position.
        if (difference > 2) {

            previousPosition =
                coordinates;

            targetPosition =
                coordinates;

            animationStartTime =
                null;

            updateISSPosition(
                coordinates
            );

        } else {

            targetPosition =
                coordinates;

            animationStartTime =
                null;

            requestAnimationFrame(
                animateISS
            );
        }


        console.log(
            "ISS:",
            coordinates
        );
    }
};


// ==================================================
// CREATE MAP
// ==================================================

function createMap() {
    const container =
        document.getElementById("iss-map");

    if (!container || window.issMap) {
        return;
    }

    container.style.backgroundColor = "#020611";

    const map =
        new maplibregl.Map({
            container: "iss-map",
            style: style,
            center: [30, 20],
            zoom: 1
        });


    map.on("style.load", function () {

        map.setProjection({
            type: "globe"
        });


        window.issMap =
            map;


        // ==================================================
        // LIVE ISS
        // ==================================================

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


        // ==================================================
        // PAST PREDICTION
        // ==================================================

        map.addSource("iss-past", {

            type: "geojson",

            data: {

                type: "FeatureCollection",

                features: []
            }
        });


        // ==================================================
        // FUTURE PREDICTION
        // ==================================================

        map.addSource("iss-future", {

            type: "geojson",

            data: {

                type: "FeatureCollection",

                features: []
            }
        });


        // ==================================================
        // PAST TRAIL
        // ==================================================

        map.addLayer({

            id: "iss-past",

            type: "line",

            source: "iss-past",

            layout: {

                "line-cap": "round",

                "line-join": "round"
            },

            paint: {

                "line-color": "#ff0000",

                "line-width": 3,

                "line-opacity": 0.45
            }
        });


        // ==================================================
        // FUTURE TRAIL
        // ==================================================

        map.addLayer({

            id: "iss-future",

            type: "line",

            source: "iss-future",

            layout: {

                "line-cap": "round",

                "line-join": "round"
            },

            paint: {

                "line-color": "#ffffff",

                "line-width": 2,

                "line-opacity": 0.55,

                "line-dasharray": [
                    2,
                    3
                ]
            }
        });


        // ==================================================
        // ISS MARKER
        // ==================================================

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


        // ==================================================
        // APPLY POSITION RECEIVED BEFORE MAP LOAD
        // ==================================================

        if (window.latestISSPosition) {

            window.issMarker.setLngLat(
                window.latestISSPosition
            );
        }


        console.log("Map ready");
    });
}


// ==================================================
// WAIT FOR DASH
// ==================================================

const checkForMap =
    setInterval(function () {

        if (
            document.getElementById(
                "iss-map"
            )
        ) {

            clearInterval(
                checkForMap
            );

            createMap();
        }

    }, 100);
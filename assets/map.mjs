import * as maplibregl from "https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs";
import * as THREE from "https://esm.sh/three@0.180.0";
import { GLTFLoader } from "https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://esm.sh/three@0.180.0/examples/jsm/loaders/DRACOLoader.js";


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


// ==================================================
// ORBIT SETTINGS
// ==================================================

const EARTH_RADIUS = 6371008.8;

// Actual ISS altitude is ~400 km.
// We exaggerate this visually so the orbit is
// clearly separated from the globe.
const VISUAL_ALTITUDE = 700000;


// ISS orbital period ≈ 90 minutes.
const ORBITAL_PERIOD = 90 * 60;

const ORBITAL_RATE =
    (2 * Math.PI) / ORBITAL_PERIOD;


// Display 45 minutes in either direction.
const PREDICTION_MINUTES = 45;

const PREDICTION_POINTS = 270;


// ==================================================
// ORBIT STATE
// ==================================================

const realTrail = [];

let orbitNormal = null;
let orbitReference = null;


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
// LAT/LON → UNIT VECTOR
// ==================================================

function latLonToVector(latitude, longitude) {

    const lat =
        latitude * Math.PI / 180;

    const lon =
        longitude * Math.PI / 180;

    return [
        Math.cos(lat) * Math.cos(lon),
        Math.cos(lat) * Math.sin(lon),
        Math.sin(lat)
    ];
}


// ==================================================
// UNIT VECTOR → LAT/LON
// ==================================================

function vectorToLatLon(vector) {

    const v = normalize(vector);

    const latitude =
        Math.asin(v[2]) *
        180 / Math.PI;

    const longitude =
        Math.atan2(v[1], v[0]) *
        180 / Math.PI;

    return [
        longitude,
        latitude
    ];
}


// ==================================================
// LONGITUDE
// ==================================================

function shortestLongitudeDifference(from, to) {

    let difference =
        to - from;

    if (difference > 180) {
        difference -= 360;
    }

    if (difference < -180) {
        difference += 360;
    }

    return difference;
}


// ==================================================
// SMOOTH ISS MOVEMENT
// ==================================================

function interpolatePosition(
    from,
    to,
    progress
) {

    const longitudeDifference =
        shortestLongitudeDifference(
            from[0],
            to[0]
        );

    return [
        from[0] +
        longitudeDifference * progress,

        from[1] +
        (to[1] - from[1]) *
        progress
    ];
}


function animateISS(timestamp) {

    if (
        !previousPosition ||
        !targetPosition
    ) {
        return;
    }

    if (!animationStartTime) {
        animationStartTime =
            timestamp;
    }

    let progress =
        (timestamp - animationStartTime)
        / animationDuration;

    progress =
        Math.min(progress, 1);

    const currentPosition =
        interpolatePosition(
            previousPosition,
            targetPosition,
            progress
        );

    update3DObjects(currentPosition);

    if (progress < 1) {

        requestAnimationFrame(
            animateISS
        );

    } else {

        previousPosition =
            targetPosition;

        animationStartTime =
            null;
    }
}


// ==================================================
// ORBIT MODEL
// ==================================================

function updateOrbitModel() {

    if (realTrail.length < 2) {
        return;
    }

    const current =
        realTrail[
            realTrail.length - 1
        ];

    const previous =
        realTrail[
            realTrail.length - 2
        ];

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

    const movement =
        vectorSubtract(
            currentVector,
            previousVector
        );

    if (
        vectorLength(movement) === 0
    ) {
        return;
    }

    const normal =
        crossProduct(
            currentVector,
            movement
        );

    if (
        vectorLength(normal) === 0
    ) {
        return;
    }

    orbitNormal =
        normalize(normal);

    orbitReference =
        normalize(currentVector);
}


// ==================================================
// ROTATE VECTOR AROUND AXIS
// ==================================================

function rotateAroundAxis(
    vector,
    axis,
    angle
) {

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
// PREDICT ORBIT
// ==================================================

function generatePredictedOrbit() {

    if (
        !orbitNormal ||
        !orbitReference
    ) {
        return null;
    }

    const totalSeconds =
        PREDICTION_MINUTES * 60;

    const stepSeconds =
        totalSeconds /
        PREDICTION_POINTS;

    const past = [];
    const future = [];


    // FUTURE
    for (
        let i = 1;
        i <= PREDICTION_POINTS;
        i++
    ) {

        const seconds =
            i * stepSeconds;

        const position =
            rotateAroundAxis(
                orbitReference,
                orbitNormal,
                ORBITAL_RATE *
                seconds
            );

        future.push(
            vectorToLatLon(position)
        );
    }


    // PAST
    for (
        let i = PREDICTION_POINTS;
        i >= 1;
        i--
    ) {

        const seconds =
            i * stepSeconds;

        const position =
            rotateAroundAxis(
                orbitReference,
                orbitNormal,
                -ORBITAL_RATE *
                seconds
            );

        past.push(
            vectorToLatLon(position)
        );
    }


    return {
        past,
        future
    };
}


// ==================================================
// SPLIT DATELINE
// ==================================================

function splitDateline(coordinates) {

    const segments = [];

    let currentSegment = [];


    for (
        let i = 0;
        i < coordinates.length;
        i++
    ) {

        const point =
            coordinates[i];

        if (
            currentSegment.length === 0
        ) {

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

            if (
                currentSegment.length > 1
            ) {
                segments.push(
                    currentSegment
                );
            }

            currentSegment = [point];

        } else {

            currentSegment.push(point);
        }
    }


    if (
        currentSegment.length > 1
    ) {
        segments.push(
            currentSegment
        );
    }


    return segments;
}


// ==================================================
// 3D COORDINATES
// ==================================================
//
// MapLibre's globe uses a sphere.
// We convert longitude/latitude into
// Earth-centered coordinates.
//
// VISUAL_ALTITUDE lifts the ISS away
// from the globe.
//
// ==================================================

function latLonTo3D(
    longitude,
    latitude,
    altitude
) {

    const lat =
        latitude *
        Math.PI / 180;

    const lon =
        longitude *
        Math.PI / 180;

    const radius =
        EARTH_RADIUS +
        altitude;

    return new THREE.Vector3(

        Math.sin(lon) *
        Math.cos(lat) *
        radius,

        Math.sin(lat) *
        radius,

        Math.cos(lon) *
        Math.cos(lat) *
        radius
    );
}


// ==================================================
// 3D SCENE
// ==================================================

let threeScene = null;
let threeCamera = null;
let threeRenderer = null;

let issMesh = null;

let pastLine = null;
let futureLine = null;


// ==================================================
// CREATE 3D SPHERE
// ==================================================

function createISSMesh() {

    const dracoLoader = new DRACOLoader();

    dracoLoader.setDecoderPath(
    "https://www.gstatic.com/draco/versioned/decoders/1.5.7/"
    );

    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load(
        "/assets/ISS.glb",
        (gltf) => {
            issMesh = gltf.scene;

            // Find the model's dimensions
            const box = new THREE.Box3().setFromObject(issMesh);
            const size = new THREE.Vector3();
            box.getSize(size);

         const maxDimension = Math.max(size.x, size.y, size.z);

            // Visual size of the ISS in our exaggerated 3D world
            const desiredSize = 1000000;

            issMesh.scale.setScalar(desiredSize / maxDimension);

            console.log("ISS scale:", issMesh.scale.x);
            console.log("ISS position:", issMesh.position);
            console.log("ISS dimensions:", size);

            threeScene.add(issMesh);

            console.log("ISS model loaded:", size);
        },
        undefined,
        (error) => {
         console.error("Failed to load ISS.glb:", error);
        }
    );
}


// ==================================================
// CREATE ORBIT LINE
// ==================================================

function createOrbitLine(
    color,
    opacity,
    dashed
) {

    const geometry =
        new THREE.BufferGeometry();

    const material =
        dashed
            ? new THREE.LineDashedMaterial({
                color: color,
                transparent: true,
                opacity: opacity,
                dashSize: 180000,
                gapSize: 140000
            })
            : new THREE.LineBasicMaterial({
                color: color,
                transparent: true,
                opacity: opacity
            });

    const line =
        dashed
            ? new THREE.LineSegments(
                geometry,
                material
            )
            : new THREE.Line(
                geometry,
                material
            );

    threeScene.add(line);

    return line;
}


// ==================================================
// UPDATE ISS 3D POSITION
// ==================================================

function updateISS3DPosition(
    coordinates
) {

    if (!issMesh) {
        return;
    }

    const position =
        latLonTo3D(
            coordinates[0],
            coordinates[1],
            VISUAL_ALTITUDE
        );

    issMesh.position.copy(
        position
    );
}


// ==================================================
// UPDATE ORBIT LINE
// ==================================================

function updateOrbitLine(
    line,
    coordinates
) {

    if (!line) {
        return;
    }

    const points = [];

    for (
        const coordinate of coordinates
    ) {

        points.push(
            latLonTo3D(
                coordinate[0],
                coordinate[1],
                VISUAL_ALTITUDE
            )
        );
    }

    const geometry =
        line.geometry;

    geometry.setFromPoints(
        points
    );

    geometry.attributes.position.needsUpdate =
        true;

    geometry.computeBoundingSphere();

    if (
        line instanceof THREE.LineSegments
    ) {
        line.computeLineDistances();
    }
}


// ==================================================
// UPDATE ALL 3D OBJECTS
// ==================================================

function update3DObjects(
    currentPosition
) {

    updateISS3DPosition(
        currentPosition
    );

    if (
        orbitNormal &&
        orbitReference
    ) {

        const prediction =
            generatePredictedOrbit();

        if (prediction) {

            updateOrbitLine(
                pastLine,
                prediction.past
            );

            updateOrbitLine(
                futureLine,
                prediction.future
            );
        }
    }

    if (window.issMap) {
        window.issMap.triggerRepaint();
    }
}


// ==================================================
// MAP
// ==================================================

function createMap() {

    const container =
        document.getElementById(
            "iss-map"
        );

    if (
        !container ||
        window.issMap
    ) {
        return;
    }

    container.style.backgroundColor =
        "#020611";


    const map =
        new maplibregl.Map({

            container: "iss-map",

            style: style,

            center: [30, 20],

            zoom: 1,

            canvasContextAttributes: {
                antialias: true
            }
        });


    map.on(
        "style.load",
        function () {

            map.setProjection({
                type: "globe"
            });


            window.issMap =
                map;


            // ==========================================
            // THREE.JS
            // ==========================================

            threeCamera =
                new THREE.Camera();

            threeScene =
                new THREE.Scene();


            threeRenderer =
                new THREE.WebGLRenderer({
                    canvas:
                        map.getCanvas(),

                    context:
                        map.painter.context.gl,

                    antialias: true
                });


            threeRenderer.autoClear =
                false;


            // Lighting

            const ambientLight =
                new THREE.AmbientLight(
                    0xffffff,
                    1.4
                );

            threeScene.add(
                ambientLight
            );


            const directionalLight =
                new THREE.DirectionalLight(
                    0xffffff,
                    2.0
                );

            directionalLight.position.set(
                5,
                3,
                5
            );

            threeScene.add(
                directionalLight
            );


            // ==========================================
            // ISS
            // ==========================================

            createISSMesh();


            // ==========================================
            // ORBIT
            // ==========================================

            pastLine =
                createOrbitLine(
                    0xff0000,
                    0.55,
                    false
                );


            futureLine =
                createOrbitLine(
                    0xffffff,
                    0.60,
                    true
                );


            // ==========================================
            // CUSTOM MAPLIBRE 3D LAYER
            // ==========================================

            const customLayer = {

                id: "iss-3d",

                type: "custom",

                renderingMode: "3d",


                render(gl, args) {

                    const projectionMatrix =
                        new THREE.Matrix4()
                            .fromArray(
                                args
                                    .defaultProjectionData
                                    .mainMatrix
                            );


                    // Convert our Earth-centered
                    // meter coordinates into the
                    // unit sphere used by MapLibre.

                    const scale =
                        1 /
                        EARTH_RADIUS;


                    const worldMatrix =
                        new THREE.Matrix4()
                            .makeScale(
                                scale,
                                scale,
                                scale
                            );


                    threeCamera
                        .projectionMatrix =
                            projectionMatrix
                                .multiply(
                                    worldMatrix
                                );


                    threeRenderer.resetState();

                    threeRenderer.render(
                        threeScene,
                        threeCamera
                    );


                    map.triggerRepaint();
                }
            };


            map.addLayer(
                customLayer
            );


            // ==========================================
            // INITIAL POSITION
            // ==========================================

            if (
                window.latestISSPosition
            ) {

                update3DObjects(
                    window.latestISSPosition
                );
            }


            console.log(
                "3D ISS layer ready"
            );
        }
    );
}


// ==================================================
// RECEIVE ISS POSITION
// ==================================================

window.issMarker = {

    setLngLat: function (
        coordinates
    ) {

        window.latestISSPosition =
            coordinates;


        // First position

        if (!previousPosition) {

            previousPosition =
                coordinates;

            targetPosition =
                coordinates;

            update3DObjects(
                coordinates
            );

            realTrail.push(
                coordinates
            );

            return;
        }


        // Store real position

        realTrail.push(
            coordinates
        );


        if (
            realTrail.length > 20
        ) {
            realTrail.shift();
        }


        // Update orbital plane

        updateOrbitModel();


        // Update prediction

        update3DObjects(
            coordinates
        );


        // Smooth movement

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


        if (difference > 2) {

            previousPosition =
                coordinates;

            targetPosition =
                coordinates;

            animationStartTime =
                null;

            update3DObjects(
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
// WAIT FOR DASH
// ==================================================

const checkForMap =
    setInterval(
        function () {

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

        },
        100
    );
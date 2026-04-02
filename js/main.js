// ===============================
// CONFIG
// ===============================
const CONFIG = {
    center: [51.92, 4.48],
    zoom: 8,
    dataUrl: './data/netherlands_cities_enriched.geojson'
};
const STYLE_CONFIG = {
    city: {
        color: '#a3169c'
    },
    corridor: {
        default: '#1900ff'
    },
    region: {
        default: '#0fe41a'
    }
};
// ===============================
// MAP INITIALIZATION
// ===============================
function initMap() {
    const map = L.map('map').setView(CONFIG.center, CONFIG.zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    return map;
}

// ===============================
// STYLE SYSTEM (DATA-DRIVEN)
// ===============================
function getStyle(feature) {
    const props = feature.properties;

    const styles = {
        corridor: {
            color: props.color || '#1556ce',
            weight: 3,
            dashArray: '8 5'
        },
        region: {
            color: props.fillColor || '#0fe41a',
            fillColor: props.fillColor || '#0fe41a',
            fillOpacity: 0.15,
            weight: 2
        }
    };

    return styles[props.type] || {};
}

// ===============================
// CITY MARKER (SMART SCALING)
// ===============================
function createCityMarker(feature, latlng) {
    const rank = feature.properties.rank || 3;

    const sizeMap = {
        1: 36,
        2: 28,
        3: 22
    };

    const size = sizeMap[rank] || 18;

    // THESE VALUES ARE HARD-CODED FOR DEMO PURPOSES, IN A REAL APP YOU WOULD PROBABLY WANT TO MAKE THIS MORE DYNAMIC
    const icon = L.BeautifyIcon.icon({
        icon: 'pin',
        iconShape: 'marker',
        backgroundColor: '#16a322',
        borderColor: '#14532d',
        textColor: 'white',
        iconSize: [size, size]
    });

    return L.marker(latlng, { icon });
}

// ===============================
// POPUPS
// ===============================
function bindPopup(feature, layer) {
    const props = feature.properties;

    if (props.featureType === 'city') {
        layer.bindPopup(`
            <div style="font-family:sans-serif">
                <strong>${props.name}</strong><br>
                Population: ${props.population.toLocaleString()}
            </div>
        `);
    } else {
        layer.bindPopup(`<strong>${props.name}</strong>`);
    }
}

// ===============================
// HOVER EFFECT
// ===============================
function highlightFeature(e) {
    const layer = e.target;
    if (layer.setStyle) {
        layer.setStyle({
            weight: 5,
            color: '#000'
        });
    }
}

function resetHighlight(e) {
    const layer = e.target;
    if (layer.setStyle) {
        layer.setStyle(getStyle(layer.feature));
    }
}

function addHoverEffect(layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight
    });
}
// ===============================
// LEGEND
// ===============================
function addLegend(map) {
    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'legend');
        // THESE COLORS  ARE HARD-CODED 
        div.innerHTML = `
            <div style="background:white;padding:10px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.2)">
                <strong>Legend</strong><br>
                🟢 Cities<br>
                🔵 Corridors<br>
                🟩 Regions
            </div>
        `;
        return div;
    };

    legend.addTo(map);
}

// ===============================
// LOAD DATA
// ===============================
async function loadData(map) {
    try {
        const response = await fetch(CONFIG.dataUrl);
        const data = await response.json();

        // Separate layers
        const cities = [];
        const corridors = [];
        const regions = [];

        data.features.forEach(feature => {
            if (feature.properties.featureType === 'city') {
                cities.push(feature);
            } else if (feature.properties.type === 'corridor') {
                corridors.push(feature);
            } else if (feature.properties.type === 'region') {
                regions.push(feature);
            }
        });

        // Create layers

        const cityMarkers = [];

        // Create cluster group
        const cityCluster = L.markerClusterGroup({
            iconCreateFunction: function (cluster) {
                const count = cluster.getChildCount();
                // THESE COLORS  ARE HARD-CODED 
                return L.divIcon({
                    html: `<div style="
                background:#2563eb;
                color:white;
                border-radius:50%;
                width:40px;
                height:40px;
                display:flex;
                align-items:center;
                justify-content:center;
                font-weight:bold;
            ">${count}</div>`,
                    className: 'custom-cluster',
                    iconSize: [40, 40]
                });
            }
        });



        const cityLayer = L.geoJSON(cities, {
            pointToLayer: (feature, latlng) => {
                const marker = createCityMarker(feature, latlng);

                marker.feature = feature; // 🔥 required for search
                cityMarkers.push(marker);

                return marker;
            },
            onEachFeature: bindPopup
        });

        // Add markers to cluster instead of map
        cityLayer.eachLayer(layer => {
            cityCluster.addLayer(layer);
        });

        // Add cluster to map
        cityCluster.addTo(map);

        const corridorLayer = L.geoJSON(corridors, {
            style: getStyle,
            onEachFeature: (feature, layer) => {
                bindPopup(feature, layer);
                addHoverEffect(layer);
            }
        });

        const regionLayer = L.geoJSON(regions, {
            style: getStyle,
            onEachFeature: (feature, layer) => {
                bindPopup(feature, layer);
                addHoverEffect(layer);
            }
        });

        // Add to map (default visible)
        //cityLayer.addTo(map);

        corridorLayer.addTo(map);
        regionLayer.addTo(map);

        //CALLING SEARCH FUNCTION
        setupSearch(map, cityMarkers);
        //CALLING POPULATION FILTER
        setupPopulationFilter(map, cityMarkers);
        // Fit bounds (use all layers)
        const group = L.featureGroup([cityLayer, corridorLayer, regionLayer]);
        map.fitBounds(group.getBounds());

        // Layer control
        // THESE COLORS  ARE HARD-CODED 
        const overlayMaps = {
            "🟢 Cities": cityCluster,
            "🔵 Corridors": corridorLayer,
            "🟩 Regions": regionLayer
        };

        L.control.layers(null, overlayMaps, {
            collapsed: false,
            position: 'topright'
        }).addTo(map);

        addLegend(map);

    } catch (error) {
        console.error(error);
        alert('Error loading map data');
    }

}


//================================
//SEARCH FUNCTION
//================================
function setupSearch(map, cityMarkers) {
    const input = document.getElementById('searchBox');

    input.addEventListener('input', function () {
        const query = input.value.toLowerCase();

        cityMarkers.forEach(marker => {
            const name = marker.feature.properties.name.toLowerCase();

            if (name.includes(query) && query.length > 1) {

                // Zoom to result
                map.setView(marker.getLatLng(), 13);

                // Open popup
                marker.openPopup();

                // Highlight effect
                marker.setOpacity(1);
            } else {
                marker.setOpacity(0.5);
            }
        });
    });
}
//================================
//POPULATION FILTER
//================================
function setupPopulationFilter(map, cityMarkers) {
    const slider = document.getElementById('populationSlider');
    const valueLabel = document.getElementById('populationValue');

    slider.addEventListener('input', function () {
        const minPopulation = parseInt(slider.value);
        valueLabel.innerText = minPopulation.toLocaleString();

        const visibleMarkers = [];

        cityMarkers.forEach(marker => {
            const population = marker.feature.properties.population;

            if (population >= minPopulation) {
                marker.setOpacity(1);
                visibleMarkers.push(marker); // ✅ track visible
            } else {
                marker.setOpacity(0);
            }
        });

        // 👇 NEW PART: FIT MAP
        if (visibleMarkers.length > 0) {
            const group = L.featureGroup(visibleMarkers);
       map.fitBounds(group.getBounds(), {
    padding: [30, 30],
    animate: true,
    duration: 0.5
});
        }
    });
}
// ===============================
// INIT APP
// ===============================
function init() {
    const map = initMap();
    loadData(map);
}

init();
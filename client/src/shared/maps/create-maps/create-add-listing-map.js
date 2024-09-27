import L from 'leaflet'
import { moveableMarker } from './helpers/marker/setup-marker.js'
import { country } from './state.js'

let map
let marker
const latLngs = []
const osmUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const osmAttrib = 'Map data &copy; OpenStreetMap contributors'
// "add-listing-map" is used to add a listing in: /listings/section

/**
 * create a listing's Map
 */
export function addListingMap({ lat, lng, zoom, layerFactory }) {
    const coordinates = country.borders
    let container = L.DomUtil.get('add-listing-map')
    if (container != null) {
        container['_leaflet_id'] = null
    }
    map = new L.Map('add-listing-map', {
        dragging: !L.Browser.mobile,
        attributionControl: false,
    })
    map['name'] = 'addListingMap'
    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    map.addLayer(layerFactory(osmUrl, osmAttrib, isDarkMode))
    map.setView(new L.LatLng(lat, lng), zoom)
    // transform geojson coordinates into an array of L.LatLng
    for (const element of coordinates) {
        latLngs.push(new L.LatLng(element[1], element[0]))
    }
    L.mask(latLngs).addTo(map)
    // console.log(names);
    marker = L.marker([lat, lng], { radius: 6000 }).addTo(map)
    // let lastValid = []
    // let moveable
    // lastValid = [lat, lng]
    // ;[moveable, lastValid] = moveableMarker(map, marker, coordinates)
    moveableMarker(map, marker, coordinates)
    // Refresh tiles after some time
    // because it doesn't load properly at first
    setTimeout(() => {
        map.invalidateSize()
    }, 300)
    return map
}

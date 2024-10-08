import { createRequire } from 'module'
import { config } from '../utils.js'
const require = createRequire(import.meta.url)

let borders
let states
switch (config('APP_NAME')) {
    case 'open_listings_fr':
        states = require('../../data/geo/states.fr.min.json')
        borders = require('../../data/geo/borders.fr.json')
        break
    case 'open_listings_en':
        states = require('../../data/geo/states.en.min.json')
        borders = require('../../data/geo/borders.en.json')
        break
    case 'open_listings_ar':
        states = require('../../data/geo/states.ar.min.json')
        borders = require('../../data/geo/borders.ar.json')
        break
    default:
        break
}

// TODO: DECODE YOUR GEOJSON. THIS MIGHT NOT WORK ON YOUR DATA
// DECODE YOUR GEOJSON. THIS MIGHT NOT WORK ON YOUR DATA
function getBorders() {
    switch (config('APP_NAME')) {
        // case 'OLisings-xx':
        //     return borders.features[0].geometry.coordinates[0]
        case 'open_listings_fr':
            return borders.features[0].geometry.geometries[0].coordinates
        case 'open_listings_en':
            return borders.features[0].geometry.geometries[0].coordinates
        case 'open_listings_ar':
            return borders.features[0].geometry.coordinates.flat()
        default:
            break
    }
}

function getStates() {
    switch (config('APP_NAME')) {
        case 'open_listings_fr':
            return states.features.map((a) => a.geometry.coordinates[0])
        case 'open_listings_en':
            return states.features.map((a) => a.geometry.coordinates[0])
        case 'open_listings_ar':
            return states.features.map((a) => a.geometry.coordinates[0])

        default:
            break
    }
}

// name: required - the name of the region (Default is English)
// name_{lang}: optional - the name of the region (Other languages)
// If feature.properties.name_{lang} doesn't exist, it falls to feature.properties.name (English)
const getStateNames = (lang) => {
    console.log(`Reading states names from app: ${config('APP_NAME')}`)
    switch (config('APP_NAME')) {
        case 'open_listings_en':
            return states.features.map((f) => f.properties.nom)
        case 'open_listings_fr':
            return states.features.map((f) => f.properties.nom)
        case 'open_listings_ar':
            return lang === 'en'
                ? states.features.map((f) => f.properties.name)
                : states.features.map((f) => f.properties[`name_${lang}`] || f.properties.name)
        default:
            break
    }
}

export { getBorders, getStateNames, getStates }

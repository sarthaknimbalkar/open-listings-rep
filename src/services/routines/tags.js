import { createRequire } from 'module'
import { give } from '../tags/data.js'
import { slugify, truncate } from './strings.js'
import { config } from '../../utils.js'

const require = createRequire(import.meta.url)

const TAG_HARD_SIZE_LIMIT = config('TAG_HARD_SIZE_LIMIT')

// Example getting parent of 'Dresses' (Markets section)
// var parent = getKey('Dresses', googleTagsEnLevel2)
// var granpa = getKey(parent, googleTagsEnLevel1)

// Example getting parent of 'Zumba' (Hobbies section)
// getAscendants('Zumba', 'en', 'hobbies')

// derive parent tag from an array of arrays
function groupOneLevel(data, fstIdx, sndIdx) {
    const result = {}
    data.forEach((row) => {
        if (!result[row[fstIdx]]) {
            result[row[fstIdx]] = new Set()
        }
        result[row[fstIdx]].add(row[sndIdx])
    })
    return result
}

const { googleTagsEn, googleTagsFr, googleTagsAr } = give

const donLeveled = { en: {}, fr: {}, ar: {} }
donLeveled.en['level1'] = groupOneLevel(googleTagsEn, 0, 1)
donLeveled.en['level2'] = groupOneLevel(googleTagsEn, 1, 2)
donLeveled.fr['level1'] = groupOneLevel(googleTagsFr, 0, 1)
donLeveled.fr['level2'] = groupOneLevel(googleTagsFr, 1, 2)
donLeveled.ar['level1'] = groupOneLevel(googleTagsAr, 0, 1)
donLeveled.ar['level2'] = groupOneLevel(googleTagsAr, 1, 2)

Set.prototype['hasIgnoreCase'] = function (str) {
    return this.has(str) || this.has(str.toUpperCase())
}

Array.prototype['_includes'] = function (str) {
    return this.some((x) => x.toLowerCase() === (str || '').toLowerCase())
}

function getKey(value, level) {
    for (const [key, values] of Object.entries(level)) {
        if (Array.isArray(values) ? values['_includes'](value) : values.hasIgnoreCase(value)) {
            return key
        }
        return ''
    }
}

const { googleTagsArLite, googleTagsEnLite, googleTagsFrLite } = give
const allTags = {
    hobbies: {
        ar: require('../../../data/taxonomy/hobbies_ar.json'),
        en: require('../../../data/taxonomy/hobbies_en.json'),
        fr: require('../../../data/taxonomy/hobbies_fr.json'),
    },
    markets: {
        ar: googleTagsArLite,
        en: googleTagsEnLite,
        fr: googleTagsFrLite,
    },
}

function treat(hobbies, opt) {
    for (const key in hobbies)
        hobbies[key] = hobbies[key].map((tag) => truncate(slugify(tag, opt), TAG_HARD_SIZE_LIMIT))
}

treat(allTags.hobbies.ar, { locale: 'ar' })
treat(allTags.hobbies.fr)
treat(allTags.hobbies.en)

function getAscendants(keyword, lang, section) {
    let parent, granpa
    try {
        if (section === 'markets') {
            const parent = getKey(keyword, donLeveled[lang].level2)
            const granpa = getKey(parent, donLeveled[lang].level1)
            return [parent, granpa]
        }
        if (section === 'hobbies') {
            parent = getKey(keyword, allTags.hobbies[lang])
            return [parent, granpa]
        }
    } catch (error) {
        ;[parent = granpa] = keyword
        return [parent, granpa]
    }
    // TODO: other sections
    ;[parent = granpa] = keyword
    return [parent, granpa]
}

export { allTags, getAscendants }

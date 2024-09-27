import { createRequire } from 'module'
import { config } from '../../utils.js'
import { slugify, truncate } from '../routines/strings.js'

const require = createRequire(import.meta.url)

const TAG_HARD_SIZE_LIMIT = config('TAG_HARD_SIZE_LIMIT')

/**
 * Load wiki tags for "hobbies"
 */
export function loadHobbiesTags(give) {
    give.wikiHobbiesEn = require('../../../data/taxonomy/hobbies_en.json')
    give.wikiHobbiesFr = require('../../../data/taxonomy/hobbies_fr.json')
    give.wikiHobbiesAr = require('../../../data/taxonomy/hobbies_ar.json')
    // TODO: sacrifice Parents for now.
    give.wikiHobbiesEn = Object.values(give.wikiHobbiesEn).flat()
    give.wikiHobbiesFr = Object.values(give.wikiHobbiesFr).flat()
    give.wikiHobbiesAr = Object.values(give.wikiHobbiesAr).flat()

    give.wikiHobbiesEn = give.wikiHobbiesEn.map((tag) => truncate(slugify(tag), TAG_HARD_SIZE_LIMIT))
    give.wikiHobbiesFr = give.wikiHobbiesFr.map((tag) => truncate(slugify(tag), TAG_HARD_SIZE_LIMIT))
    give.wikiHobbiesAr = give.wikiHobbiesAr.map((tag) => truncate(slugify(tag, { locale: 'ar' }), TAG_HARD_SIZE_LIMIT))
}

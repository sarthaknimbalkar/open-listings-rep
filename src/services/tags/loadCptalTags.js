import { createRequire } from 'module'
import { config } from '../../utils.js'
import { slugify, truncate } from '../routines/strings.js'

const require = createRequire(import.meta.url)
const TAG_HARD_SIZE_LIMIT = config('TAG_HARD_SIZE_LIMIT')

/**
 * Load CPTALL tags for "events"
 */
export function loadCptallTags(give) {
    // CPTALL DATA
    // broadMatch to omit
    // 02000000  Police et justice
    // 03000000 Désastres et accidents
    // 04000000 Economie et finance
    // 07000000 Santé
    // 09000000 Travail
    // 11000000 Politique
    // 12000000 Religion
    // 13000000 Science
    // 14000000 Société (concepts)
    // 16000000 Conflit, guerre et paix
    // 17000000 météo
    const toKeep = ['01000000', '05000000', '06000000', '08000000', '10000000', '15000000']
    const toKeep_ = (s) => toKeep.some((mediaTopic) => s.indexOf(mediaTopic) >= 0)
    give.cptallTagsEn = require('../../../data/taxonomy/cptall_en.json')
        .conceptSet.filter((o) => toKeep_(o.uri) || (o['broader'] && toKeep_(o['broader'].join(''))))
        .map((o) => o['prefLabel']['en-US'])
        .filter(Boolean)

    give.cptallTagsFr = require('../../../data/taxonomy/cptall_fr.json')
        .conceptSet.filter((o) => toKeep_(o.uri) || (o['broader'] && toKeep_(o['broader'].join(''))))
        .map((o) => o['prefLabel']['fr'])
        .filter(Boolean)

    give.cptallTagsAr = require('../../../data/taxonomy/cptall_ar.json')
        .conceptSet.filter((o) => toKeep_(o.uri) || (o['broader'] && toKeep_(o['broader'].join(''))))
        .map((o) => o['prefLabel']['ar'])
        .filter(Boolean)

    give.cptallTagsEn = give.cptallTagsEn.map((tag) => truncate(slugify(tag), TAG_HARD_SIZE_LIMIT))
    give.cptallTagsFr = give.cptallTagsFr.map((tag) => truncate(slugify(tag), TAG_HARD_SIZE_LIMIT))
    give.cptallTagsAr = give.cptallTagsAr.map((tag) => truncate(slugify(tag, { locale: 'ar' }), TAG_HARD_SIZE_LIMIT))
}

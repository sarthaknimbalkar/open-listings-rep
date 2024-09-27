import { loadCptallTags } from './loadCptalTags.js'
import { loadEScotTags } from './loadEScotTags.js'
import { loadGemetTags, loadWikiAndGemetTags } from './loadGemetTags.js'
import { loadGoogleTags } from './loadGoogleTags.js'
import { loadHobbiesTags } from './loadHobbiesTags.js'

const give = {}

async function loadTags() {
    loadGoogleTags(give)
    await loadEScotTags(give)
    loadCptallTags(give)
    loadHobbiesTags(give)
    loadGemetTags(give)
    loadWikiAndGemetTags(give)
}

await loadTags()

// const handler = {
//     get(target, property) {
//     // fastify.log.info(`Raw data ${property} loaded`)
//         return target[property];
//     }
// }
// Wrapping give object breaks some IDR links but,,,
// module.exports.give = new Proxy(give, handler);
export { give }

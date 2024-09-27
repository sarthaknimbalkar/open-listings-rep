// eslint-disable-next-line max-len
// @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ Sync data @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

import { markRequiredInputs, updatePostPostInputs } from './ReactiveUI/constraints.js'
// import { renderTopByDiv, renderTopSearches, renderTopTags } from './renderers/renderer.js'

export const renderShared = async () => {
    // if (window.__section__) {
    //     renderTopTags(window.__section__)
    // }
    // renderTopSearches()
    // renderTopByDiv()
    try {
        markRequiredInputs()
        console.log('### function "markRequiredInputs" run successfully')
    } catch (error) {
        console.log(error.message)
    }
    try {
        updatePostPostInputs()
        console.log('### function "updatePostPostInputs" run successfully')
    } catch (error) {
        console.log(error.message)
    }

    console.log('### function "renderShared" run successfully')
}

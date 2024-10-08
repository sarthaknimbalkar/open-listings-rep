/**
 * ADD 'https://tarekraafat.github.io/autoComplete.js/' auto complete
 * MUST EXIST:
 *    input id="autoComplete"
 */
import autoComplete from '@tarekraafat/autocomplete.js'
import { consts, isDevEnv } from '../../views/main/consts.js'

export const setupAutoComplete = async () => {
    if (!document.querySelector('input#autoComplete')) {
        return '### function "setupAutoComplete"  ignored well'
    }
    const autoCompleteJS = new autoComplete({
        selector: '#autoComplete',
        placeHolder: 'Recherche rapide...',
        data: {
            src: async (query) => {
                try {
                    // Fetch Data from external Source
                    const options = isDevEnv
                        ? { referrerPolicy: 'unsafe-url', credentials: 'include' }
                        : { credentials: 'include' }
                    const source = await fetch(`${consts.APIHost[process.env.NODE_ENV]}/autocomplete/${query}`, options)
                    // Data is array of `Objects` | `Strings`
                    return await source.json()
                } catch (error) {
                    return error
                }
            },
            // Data 'Object' key to be searched
            keys: ['_id'],
        },
        cache: true,
        debounce: 300,
        searchEngine: 'loose',
        diacritics: true,
        maxResults: 15,
        threshold: 3,
        resultItem: {
            highlight: true,
        },
        events: {
            input: {
                selection: (event) => {
                    const selection = event.detail.selection.value
                    const keyword = selection._id
                    autoCompleteJS.input.value = keyword
                    window.location.href = `${consts.APIHost[process.env.NODE_ENV]}/keyword/${keyword}`
                },
            },
        },
    })
    return '### function "setupAutoComplete" run successfully'
}

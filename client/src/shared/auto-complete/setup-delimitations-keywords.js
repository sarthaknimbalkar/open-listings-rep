import autocomplete from 'autocompleter'
import { getStateNames } from '../../helpers/get-state-names.js'
import { LIS } from '../../helpers/lis.js'

export const setupDelimitationsKeywords = () => {
    const input = LIS.id('autoCompleter-states')
    if (!input) {
        console.log('### function "setupDelimitationsKeywords"  ignored well')
        return
    }
    const names = getStateNames()
    const namesThatThisGuyWants = names.map((n) => ({
        label: n,
        value: n,
    }))
    // Autocomplete for governmental divisions
    try {
        autocomplete({
            input: input,
            fetch: function (text, update) {
                text = text.toLowerCase()
                // you can also use AJAX requests instead of preloaded data
                var suggestions = namesThatThisGuyWants.filter((n) => n.label.toLowerCase().startsWith(text))
                update(suggestions)
            },
            onSelect: function (item) {
                input.value = item.value
            },
        })
        console.log('### function "setupDelimitationsKeywords" run successfully')
    } catch (error) {
        console.error('### function "setupDelimitationsKeywords" failed')
    }
}

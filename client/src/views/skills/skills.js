import { setupUndrawKeywords } from './auto-complete/setup-undraw-keywords.js'
import { setupColorPicker } from './color-picker/setup-color-picker.js'
import { loadIllustrations } from './load-illustrations/load-illustrations.js'

setupUndrawKeywords().then(() => {
    setupColorPicker()
    const selectElement = document.querySelector('#autoComplete-illu')

    selectElement.addEventListener('selection', (event) => {
        const value = event.detail.selection.value
        loadIllustrations(value)
    })
})

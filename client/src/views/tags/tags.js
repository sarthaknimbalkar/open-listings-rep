import './datatable/datatable.js'
try {
    document.getElementsByClassName('loading-text')[0].remove()
    document.getElementsByClassName(('bd-subnavbar py-2'))[0].remove()
} catch (error) {
    console.log(error.message)
}
// eslint-disable-next-line no-undef
new ClipboardJS('.copybtn')

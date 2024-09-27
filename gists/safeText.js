import { safeText } from './../src/services/apis/safe-text.js'
safeText({
    text: '<p>What+is+Lorem+Ipsum?</p><p><br></p><p><br></p><p>What+is+Lorem+Ipsum?</p><p>What+is+Lorem+Ipsum?</p><p>What+is+Lorem+Ipsum?++fdsfdsf</p><p><br></p><p>What+is+Lorem+Ipsum?</p><p>What+is+Lorem+Ipsum?</p><p><br></p><p>What+is+Lorem+Ipsum?</p>',
}).then((oo) => {
    console.log(oo)

})


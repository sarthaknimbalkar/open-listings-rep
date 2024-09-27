import { formatCurrency } from './helpers.js'

export const lightTweaks = async () => {
    const currencyInput = document.querySelector("input[data-type='currency']")

    // if (!currencyInput) {
    //     console.log('### currencyInput ignored')
    // } else {
    //     currencyInput.addEventListener("keyup", function () {
    //         formatCurrency(this)
    //     });
    //     currencyInput.addEventListener("blur", function () {
    //         formatCurrency(this, 'blur')
    //     });
    // }

    console.log('### function "lightTweaks" run successfully')
}

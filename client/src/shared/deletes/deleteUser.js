// Define the modal (for the image onclick) behavior
import { LIS } from '../../helpers/lis.js'

export const setupUserDeletes = async () => {
    if (
        // eslint-disable-next-line no-undef
        (typeof __context__ !== 'undefined' && __context__ !== 'usersettings') ||
        !document.querySelector('.user-delete')
    ) {
        return '### function "setupUserDeletes" ignored well'
    }
    const elem = LIS.elements('user-delete')[0]
    const confirmIt = function (e) {
        if (!confirm('Vous etes sure?')) e.preventDefault()
    }
    elem.addEventListener('click', confirmIt, false)

    return '### function "setupUserDeletes" run successfully'
}

// expects __UXConstraints__

export function markRequiredInputs() {
    if (!window.__UXConstraints__) return
    for (let [formName, constraint] of Object.entries(window.__UXConstraints__)) {
        if (constraint.requiredUXInputs.length === 0) continue
        const form = document.querySelector(`form[name="${formName}"]`)
        if (form) {
            const inputs = form.elements
            for (const input of inputs) {
                if (input.nodeName === 'INPUT' && constraint.requiredUXInputs.indexOf(input.name) > -1) {
                    input.setAttribute('required', 'required')
                }
                if (input.nodeName === 'INPUT' && constraint.minInputs[input.name]) {
                    input.setAttribute('minlength', constraint.minInputs[input.name])
                }
            }
        }
    }
}

export function updatePostPostInputs() {
    if (!window.__formData__) return
    for (let [inputName, value] of Object.entries(window.__formData__)) {
        const input = document.querySelector(`input[name="${inputName}"]`)
        if (input && inputName !== 'tags') {
            input.value = value
        }
    }
}

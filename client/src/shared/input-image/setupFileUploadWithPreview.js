// import { FileUploadWithPreview } from 'file-upload-with-preview';
// import axios from "axios"
import { LIS } from '../../helpers/lis.js'

const loadFile = function (event) {
    const image = LIS.id('output')
    const imgFile = event.target.files[0]

    if (!imgFile) {
        if (image.src) image.src = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="
        image.style.width = "1px"
        return;
    }

    image.src = URL.createObjectURL(imgFile)
    image.style.width = '200px'
}


// eslint-disable-next-line max-len
// @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ Avatar @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
export const setupFileUploadWithPreview = () => {
    const formName = "addMarket"
    const form = document.querySelector(`form[name="${formName}"]`)
    const inputFile = document.querySelector("input[type='file']");
    if (!form) return;

    inputFile.onchange = loadFile

    // form.addEventListener("submit", (event) => {
    //     event.preventDefault();
    //     const formData = new FormData()
    //     Object.keys(form).forEach((key) => {
    //         formData.append(key, form[key])
    //     })

    //     axios.post('/listings/markets', formData, {
    //         headers: {
    //             'Content-Type': 'multipart/form-data'
    //         },
    //         validateStatus: (status) => status === 599
    //     }).then(function (response) {
    //         if (response.request.responseURL !== document.URL || response.status !== 200)
    //             window.location.replace(response.request.responseURL)
    //     }).catch((error) => ("Something went wrong!", error));
    // });

    // const input = document.querySelector(".custom-file-container")
    // if (input) {
    //     const upload = new FileUploadWithPreview('my-unique-id');
    // }

    console.log('### function "setupFileUploadWithPreview" run successfully')
}

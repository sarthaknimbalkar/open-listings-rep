import decancer from 'decancer'

const settings = decancer.options({
    retainArabic: true,
    disableBidi: true,
})

const str = decancer('Bonjour la france', settings).toString()
console.log(str)

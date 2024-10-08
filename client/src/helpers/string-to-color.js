/**
 * A bijective String to color function
 * @param {string} str, ex: "hello"
 * @return {string} color color code, ex: #00000
 */
// export function stringToColor(string) {
//     const idx = Math.floor(Math.random() * 5)

//     return ['#1b85b8', '#1b85b8', '#559e83', '#ae5a41', '#c3cb71'][idx]
// }

export function stringToColor(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    let color = '#'
    for (let j = 0; j < 3; j++) {
        const value = (hash >> (j * 8)) & 0xff
        color += ('00' + value.toString(16)).substr(-2)
    }
    return color
}
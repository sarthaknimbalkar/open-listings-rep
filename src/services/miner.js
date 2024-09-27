import { CircularQueue } from '@toreda/adt'
import FuzzySet from 'fuzzyset'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { TopK } = require('bloom-filters')

// Arbitrary choice
const maxSize = 3000
let fuzzySet, circularQueue, topK

/**
 * Inits the bag (circular buffer) and the topK bloom filter
 */
function init() {
    fuzzySet = FuzzySet()
    circularQueue = new CircularQueue({
        maxSize: maxSize,
        overwrite: true,
    })
    topK = new TopK(10, 0.001, 0.99)
}

init()

let pushCount = 0
const isRound = () => pushCount++ % maxSize === maxSize / 2
/**
 * Purges old elements from the bag
 */
const purgeOld = () => {
    const front = circularQueue.front()
    if (front && front[0] < new Date().getTime() - 2592000000 /*month*/) {
        circularQueue.pop()
        purgeOld()
    }
}

/**
 * 'Hello' and 'Helo' are assumed equal, this is a bijective function
 * @param {*} keyword
 * @returns {string}
 */
const checkSimilarity = (keyword) => {
    const similar = fuzzySet.get(keyword)
    if (!similar || similar[0][0] < 0.8) {
        fuzzySet.add(keyword)
        return ''
    } else {
        return similar[0][1]
    }
}

/**
 * Refreshes TOPK adding a string to the bloom filter
 * @param {string} keyword
 */
const refreshTopK = (keyword) => {
    // split a phrase into words
    if (keyword.split(' ').length > 1) {
        keyword.split(' ').forEach((word) => {
            if (word.length > 2) refreshTopK(word)
        })
        return
    }
    // prepare the bag (circular buffer)
    purgeOld()
    const similar = checkSimilarity(keyword)
    if (similar) keyword = similar
    circularQueue.push([new Date().getTime(), keyword])
    topK.add(keyword)

    // when half the queue is seen already
    // renew the topK bag
    if (isRound()) {
        pushCount = 0
        topK = new TopK(10, 0.001, 0.99)
        circularQueue.forEach((elem) => {
            topK.add(elem[1])
        })
    }
}

// init() must be called once
export { refreshTopK, topK }

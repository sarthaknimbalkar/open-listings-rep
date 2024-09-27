import { parse } from 'csv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { config } from '../../utils.js'
import { slugify, truncate } from '../routines/strings.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TAG_HARD_SIZE_LIMIT = config('TAG_HARD_SIZE_LIMIT')

const getTagsParser = async (path_, arr) => {
    return new Promise((resolve, reject) => {
        const stream = fs
            .createReadStream(path.join(__dirname, path_))
            .pipe(parse({ columns: true }))

        stream.on('data', function (row) {
            const preferredLabel = row['preferredLabel']
            const masculine = preferredLabel.split('/')[0] ?? ''
            const feminine = preferredLabel.split('/')[1] ?? ''

            arr.push({ feminine, masculine })
        })
        stream.on('error', (err) => {
            reject(err);
        })
        stream.on('end', () => {
            resolve();
        })
    })
}

/**
 * Load ESCOT tags for "skills"
 */
export async function loadEScotTags(give) {
    give.ESCOTagsFr = []
    give.ESCOTagsEn = []
    give.ESCOTagsAr = []

    await getTagsParser('../../../data/taxonomy/occupations_fr.csv', give.ESCOTagsFr)
    await getTagsParser('../../../data/taxonomy/occupations_ar.csv', give.ESCOTagsAr)
    await getTagsParser('../../../data/taxonomy/occupations_en.csv', give.ESCOTagsEn)

    give.ESCOTagsFr = give.ESCOTagsFr.map((tag) => {
        return {
            masculine: truncate(slugify(tag.masculine), TAG_HARD_SIZE_LIMIT),
            feminine: truncate(slugify(tag.feminine), TAG_HARD_SIZE_LIMIT)
        }
    })

    give.ESCOTagsEn = give.ESCOTagsEn.map((tag) => {
        return {
            masculine: truncate(slugify(tag.masculine), TAG_HARD_SIZE_LIMIT),
            feminine: truncate(slugify(tag.feminine), TAG_HARD_SIZE_LIMIT)
        }
    })


    give.ESCOTagsAr = give.ESCOTagsAr.map((tag) => {
        return {
            masculine: truncate(slugify(tag.masculine), TAG_HARD_SIZE_LIMIT),
            feminine: truncate(slugify(tag.feminine), TAG_HARD_SIZE_LIMIT)
        }
    })
}

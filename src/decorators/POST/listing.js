// @flow

import { Storage } from '@google-cloud/storage'
import Jimp from 'jimp-compact'
import { createRequire } from 'module'
import path from 'path'
import contexts from '../../contexts.js'
import { config, Logger, NODE_ENV } from '../../utils.js'
import { Actions } from '../../constraints/constants.js'
import constraints from '../../constraints/constraints.js'
import queries from '../../services/apis/mongo-queries.js'
import { safeText } from '../../services/apis/safe-text.js'
import { listingValidation } from '../../services/pipeLine.js'
import { to } from '../../services/routines/code.js'
import { initials } from '../../services/routines/strings.js'
import intoStream from 'into-stream'
import ExifTransformer from 'exif-be-gone'
import { createWriteStream } from 'fs'
import transformers from '../../constraints/transformers.js'
// eslint-disable-next-line no-unused-vars
import * as Types from '../../types.d.js'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

const require = createRequire(import.meta.url)
let sharp
try {
    sharp = require('sharp')
} catch (error) {
    console.log('oh no no sharp module. I hope this is not a production environment')
}

let storage, bucket
if (NODE_ENV === 'production' && config('GCLOUD_STORAGE_BUCKET')) {
    storage = new Storage({ keyFilename: './credentials/service-account.json' })
    bucket = storage.bucket(config('GCLOUD_STORAGE_BUCKET'))
}

/**
 * @typedef {{username: string}} Username
 * @param {Types.Request & {params: Username}} req
 * @param {{name: string;small: boolean;}[]} blobNames
 * @param {boolean} isUpload
 * @returns {Types.Listing}
 */
const formatNInsertListing = (req, blobNames, isUpload) => {
    const { body } = req
    let listing = { ...body, a: false, d: false, usr: req.session.get('user').username }

    // Adding pictures if present
    if (bucket && isUpload && blobNames.length) {
        // in case of cloud upload
        const [blobName, blobNameSmall] = blobNames[0].small
            ? [blobNames[1].name, blobNames[0].name]
            : [blobNames[0].name, blobNames[1].name]
        if (blobNameSmall) listing['thum'] = `https://storage.googleapis.com/${bucket.name}/${blobNameSmall}`
        listing['img'] = `https://storage.googleapis.com/${bucket.name}/${blobName}`
    } else {
        // in case of local uploads (for development purposes)
        // Or in case of no picture for this section (for instance events section has no picture)
        if (!blobNames.length) {
            listing['img'] = '' // imgHolder[listing['section']]
            listing['thum'] = '' // imgHolder[listing['section']]
            return listing
        }

        const [blobName, blobNameSmall] = blobNames[0].small
            ? [blobNames[1].name, blobNames[0].name]
            : [blobNames[0].name, blobNames[1].name]
        listing['img'] = `http://localhost:3003/${blobName}`
        listing['thum'] = `http://localhost:3003/${blobNameSmall}`
    }

    // @ts-ignore
    return listing
}

export default (fastify: FastifyInstance) => {
    const { redis } = fastify
    const QInstance = new queries(redis, new Logger(fastify).log)

    return async (req: FastifyRequest, reply: FastifyReply) => {
        /** @type Types.Listing */
        const body = req.body

        transformers['sanitize'](body, ['title', 'section', 'div', 'img_radio'])

        const { method } = req
        const section = body?.section
        if (!body || !section) {
            req.log.error(`post/listings#listing: no section provided}`)
            return reply.prepareView([{}, contexts.message_, contexts.message.SERVER_ERROR])
        }
        let errors, tagsValid, geoValid
        try {
            ;({ errors, geoValid, tagsValid } = listingValidation(req))
        } catch (error) {
            req.log.error(`post/listings#listing: ${error.message}`)
            return reply.prepareView([{}, contexts.message_, contexts.message.SERVER_ERROR])
        }
        const valid = !errors.length && tagsValid && geoValid
        if (!valid) {
            req.log.error(`post/listings#listing: ${JSON.stringify(errors)}`)
            return reply.prepareView([{ errors, section }, contexts.listings_, contexts.listings.POST_ERR])
        } else {
            const { clean, language, text } = await safeText({
                text: body.desc,
            })
            body.desc = text
            body.lang = language
            body.cdesc = clean
            const { upload } = constraints[config('NODE_ENV')][method][section]
            if (upload && !req.file) {
                req.log.error(`post/listings#listing: file not found`)
                return reply.prepareView(
                    [{ title: 'TODO: blaaaaaaaaaaa' }, contexts.message_, contexts.message.SERVER_ERROR],
                    req,
                )
            }
            if (!upload) {
                const listing = formatNInsertListing(req, [], false)
                const [err, insertedId] = await to(QInstance.insertListing(listing))

                if (err) throw err
                listing['_id'] = insertedId.toHexString ? insertedId.toHexString() : insertedId
                let data = { data: listing, section: listing.section }
                fastify.happened(Actions.new_listing, 'post/listings#listing', { reply, req })

                return reply.prepareView([data, contexts.listing_, contexts.listing.id])
            } else {
                // If image is not defined for some reason ! I do not know when !!
                // If Multer is being buggy or so
                if (!req.file.buffer)
                    reply.prepareView(
                        [{ title: 'TODO: blaaaaaaaaaaa' }, contexts.message_, contexts.message.SERVER_ERROR],
                        req,
                    )
                // Upload that damn pictures the original (req.file) and the thumbnail
                // Create a new blob in the bucket and upload the file data.
                // req.file       | Image {
                // req.file       |   fieldname: 'file',
                // req.file       |   originalname: 'cruise.jpg',
                // req.file       |   encoding: '7bit',
                // req.file       |   mimetype: 'image/jpeg',
                // req.file       |   buffer: <Buffer ff d8 ff e1 3d 1e 45 78 69 66 00... 15755535 more bytes>,
                // req.file       |   size: 15755585
                // req.file       | }
                /** @type Promise<{name: string, small:boolean}> */
                let uploadSmallImg
                /** @type Promise<{name: string, small:boolean}> */
                let uploadImg
                let thumbnailBuffer, originalBuffer
                let withoutExifStream = intoStream(req.file.buffer).pipe(new ExifTransformer())
                async function streamToBuffer() {
                    return new Promise((resolve, reject) => {
                        let tempBuffers = []
                        withoutExifStream.on('readable', function (buffer) {
                            for (;;) {
                                let buffer = withoutExifStream.read()
                                if (!buffer) {
                                    break
                                }
                                tempBuffers.push(buffer)
                            }
                        })
                        withoutExifStream.on('end', function () {
                            originalBuffer = Buffer.concat(tempBuffers)
                            resolve()
                        })
                    })
                }
                await streamToBuffer()

                const { width } = config('IMG_THUMB')
                const suffix = () => Date.now() + '-' + Math.round(Math.random() * 1e9)

                try {
                    if (sharp) {
                        const { width: originalWidth } = await sharp(originalBuffer).metadata()
                        if (originalWidth > 400) {
                            thumbnailBuffer = await sharp(originalBuffer)
                                .resize(Math.round(originalWidth * 0.5), null)
                                .toBuffer()
                        } else if (originalWidth > 200) {
                            thumbnailBuffer = await sharp(originalBuffer)
                                .resize(width, null, {
                                    fit: 'inside',
                                })
                                .toBuffer()
                        }
                    } else {
                        const image = await Jimp.read(originalBuffer)
                        image.quality(80).resize(width, Jimp.AUTO)
                        thumbnailBuffer = await image.getBufferAsync(Jimp.AUTO)
                    }
                } catch (error) {
                    req.log.error(`post/listings#listing#Image compression: ${error.message}`)
                }

                uploadSmallImg = thumbnailBuffer
                    ? new Promise((resolve, reject) => {
                          const filename = suffix() + path.extname(req.file.originalname)
                          if (!bucket) {
                              return resolve({
                                  name: filename,
                                  small: true,
                              })
                          }
                          const blob = bucket.file(filename)
                          blob.createWriteStream({
                              resumable: false,
                          })
                              .on('finish', () => {
                                  resolve({
                                      name: blob.name,
                                      small: true,
                                  })
                              })
                              .on('error', (err) => {
                                  reject(err)
                              })
                              .end(thumbnailBuffer)
                      })
                    : Promise.resolve({
                          name: '',
                          small: true,
                      })

                uploadImg = new Promise((resolve, reject) => {
                    const filename = suffix() + path.extname(req.file.originalname)
                    if (!bucket) {
                        return resolve({
                            name: filename,
                            small: false,
                        })
                    }
                    const blob = bucket.file(filename)
                    blob.createWriteStream({
                        metadata: {
                            contentType: req.file.mimetype,
                        },
                        resumable: true,
                    })
                        .on('finish', () => {
                            resolve({
                                name: blob.name,
                                small: false,
                            })
                        })
                        .on('error', (err) => {
                            reject(err)
                        })
                        .end(originalBuffer)
                })

                let blobNames = []
                try {
                    blobNames = await Promise.all([uploadImg, uploadSmallImg])
                } catch (error) {
                    req.log.error(`post/listings#listing#Image upload: ${error.message}`)
                }

                const listing = formatNInsertListing(req, blobNames, true)
                const [err, insertedId] = await to(QInstance.insertListing(listing))
                if (err) throw err
                listing['_id'] = insertedId.toHexString ? insertedId.toHexString() : insertedId
                listing.usr = listing.usr ? initials(listing.usr) : 'YY'
                let data = { data: listing, section: listing.section }
                fastify.happened(Actions.new_listing, 'post/listings#listing', { reply, req })

                return reply.prepareView([data, contexts.listing_, contexts.listing.post])
            }
        }
    }
}

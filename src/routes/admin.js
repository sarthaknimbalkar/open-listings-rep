// @flow

import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import ajvKeywords from 'ajv-keywords'

import { config, Logger } from '../utils.js'
import authAdapter from '../decorators/auth.js'
import queries from '../services/apis/mongo-queries.js'
import { removeKey } from '../services/routines/code.js'
import constraints from '../constraints/constraints.js'
import { imgHolder } from '../constraints/constants.js'

// eslint-disable-next-line no-unused-vars
import * as Types from '../types.d.js'

import type { FastifyInstance } from 'fastify'

const ajv = new Ajv({ allErrors: true, coerceTypes: true, parseDate: true })
addFormats(ajv)
ajvKeywords(ajv, ['transform'])

// The function would need to be declared async for return to work.
// Only routes accept next parameter.

async function routes(fastify: FastifyInstance) {
    const { redis } = fastify

    const QInstance = new queries(redis, new Logger(fastify).log)
    let { adminAuth } = authAdapter(fastify)
    // CLONE BASE DATA LIST
    let realtimeJSON = []

    fastify.get('/', { preHandler: adminAuth }, async function (req, reply) {
        const listings = await QInstance.getListingsForModeration(true)
        listings.documents.forEach((elem) => {
            if (!elem.img) elem.img = imgHolder[elem['section']]
            elem._id = elem._id.toHexString ? elem._id.toHexString() : elem._id
        })
        listings.documents.forEach((elem) => {
            realtimeJSON[elem._id] = elem
        })
        reply.send({
            data: {
                contents: listings.documents,
            },
            result: true,
        })

        return reply
    })
    //  { preHandler: adminAuth },
    fastify.get('/dashboard', { preHandler: adminAuth }, async function (req, reply) {
        return reply.view('./pages/admin', {})
    })

    // CREATE
    fastify.post('/', { preHandler: adminAuth }, async function (req, reply) {
        reply.send('listing creation not implemented')

        return reply
    })

    // UPDATE (Patch for single-cell edit)
    // Replace some or all of a listing's properties
    // Using `patch` instead of `put` to allow partial update
    // fastify.patch('/:id', async function (req, reply) {
    //     // Early Exit
    //     if (!Object.keys(req.body).length) {
    //         reply.send('The request object has no options or is not in the correct format (application/json).')
    //     }
    //     // Update the target object
    //     else {
    //         const match = req.params.id
    //         realtimeJSON[match] = Object.assign({}, realtimeJSON[match], req.body)
    //         if (realtimeJSON[match].img.includes('via.placeholder')) realtimeJSON[match].img = ''
    //         await QInstance.updateListing(realtimeJSON[match], Types.Collections.Listing)
    //         if (realtimeJSON[match].a) {
    //             console.log('document approved')
    //             delete realtimeJSON[match]
    //         }
    //         reply.send(realtimeJSON)
    //     }
    // })

    // PUT (For multi-cell edit)
    // Replaces record instead of merging (patch)
    fastify.put('/', { preHandler: adminAuth }, async function (req, reply) {
        let listing = req.body.updatedRows[0]
        delete listing['_attributes']
        const match = listing['_id']

        const section = listing.section
        const { schema } = constraints[config('NODE_ENV')]['POST'][section]
        const singletonSchema = schema()

        // Final validation according to schema / if not yet validated
        const validate = ajv.compile(singletonSchema.def.valueOf())
        const valid = singletonSchema.called ? true : validate(listing)

        if (!valid) {
            throw new Error('Format error')
        }

        await QInstance.updateListing(listing, Types.Collections.Listing)
        realtimeJSON[match] = listing
        removeKey('rowKey', listing)
        if (realtimeJSON[match].a) delete realtimeJSON[match]
        return reply.send(realtimeJSON)
    })

    // DELETE
    fastify.delete('/:id', { preHandler: adminAuth }, async function (req, reply) {
        const body = req.body.updatedRows[0]
        delete body['_attributes']
        const match = body['_id']
        await QInstance.removeDocument(match, Types.Collections.Listing)
        delete realtimeJSON[match]
        return reply.send(realtimeJSON)
    })

    // Add an announcement
    // fastify.post('/announce',  { preHandler: adminAuth },async function (req, reply) {
    //     const { body } = req
    //     // const { title_en, title_fr, english, french } = body
    //     const id = await QInstance.insertAnnouncement(body)
    //     reply.send(`announcement added ${JSON.stringify(id)}`)
    // })
}

export default routes

// @flow

import type { FastifyRequest, FastifyReply } from 'fastify'

/**
 * A pre-validation helper particularly for user POST requests
 */
function transformer(request: FastifyRequest, reply: FastifyReply, done) {
    // This hook will always be executed after the shared `preValidation` hooks
    if (request.method === 'GET' || !request.body) {
        done()
        return
    }
    // TODO: check constraints per route
    let inputs = []
    if (request.url.indexOf('textSearch') > -1) inputs = ['exact']

    if (inputs.length === 0) {
        done()
        return
    }

    // do some mapping
    let keyValues = Object.keys(request.body)
        .map((key) => {
            // RULE 1: remove keys with empty string
            if (request.body[key] === '') {
                return
            }
            // RULE 2: map { on: true, off: false }
            // console.log('inputsValueMapping')
            // console.log(key)
            if (inputs.indexOf(key) > -1) {
                // console.log(request.body[key])
                // TODO: this is a hack because it is called two times
                const isTrue = request.body[key] === true || request.body[key] === 'on'
                return [key, isTrue]
            } else {
                return [key, request.body[key]]
            }
        })
        .filter(Boolean)
    // @ts-ignore // TODO: must be very careful about this transformer. whether to keep it or not !
    request.body = Object.fromEntries(keyValues)
    done()
}

export default transformer

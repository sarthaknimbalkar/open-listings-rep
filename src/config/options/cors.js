// TODO: A networking guy should revise these.


/**
 * @return {import("@fastify/cors").FastifyCorsOptionsDelegateCallback}
 */
export default () => {
    return (req, callback) => {
        /**@type import("@fastify/cors").FastifyCorsOptions */
        const corsOptions = {
            // This is NOT recommended for production as it enables reflection exploits
            origin: true,
        }
        // do not include CORS headers for requests from localhost
        if (
            (!req.headers.origin && /^http:\/\/localhost/.test(req.headers.host)) ||
            /^localhost$/m.test(req.headers.origin)
        ) {
            corsOptions.origin = false
        }
        // callback expects two parameters: error and options
        callback(null, corsOptions)
    }
}

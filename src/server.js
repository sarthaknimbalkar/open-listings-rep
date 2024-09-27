// Require app configurations
import { config } from 'dotenv'
import build from './app.js'

config()
process.title = process.env['APP_NAME'] || 'open-listings'

process.env.worker_id = '1'
build(true).then(() => {
    console.log('Server done')
}).catch((err) => {
    throw (err)
})

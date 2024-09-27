import { ObjectId } from 'mongodb'
const ss = new ObjectId('5217a543dd99a6d9e0f74702').getTimestamp()
console.log(ss.toISOString().substring(0, 10))

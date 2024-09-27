import bcrypt from 'bcryptjs'

let passHash = await bcrypt.hash('Iaminopen0', 10)

console.log(passHash)
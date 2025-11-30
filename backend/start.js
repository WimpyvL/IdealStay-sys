require('dotenv').config()
const path = require('path')
const fs = require('fs')

const serverPath = path.join(__dirname, 'dist', 'server.js')
if (!fs.existsSync(serverPath)) {
  console.error('dist/server.js not found. Run backend build first.')
  process.exit(1)
}

require(serverPath)


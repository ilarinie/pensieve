import { createApp } from './app.js'
import { env } from './env.js'
import { getLogger } from './logging/get-logger.js'

const logger = getLogger(import.meta.url)

const app = createApp()

app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT}`)
})

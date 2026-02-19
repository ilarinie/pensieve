import express from 'express'

/**
 * Creates and configures the Express application.
 *
 * @returns The configured Express app instance
 */
export const createApp = () => {
  const app = express()

  app.get('/health-check', (_req, res) => {
    res.json({ status: 'ok' })
  })

  return app
}

import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string(),
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_ALLOWED_USER_IDS: z
    .string()
    .transform((value) => value.split(','))
    .pipe(z.array(z.string())),
  ANTHROPIC_API_KEY: z.string(),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().default('3000'),
  LOG_LEVEL: z.string().default('info'),
  TZ_DISPLAY: z.string().default('Europe/Helsinki'),
})

/**
 * Validated environment variables. App crashes at startup if any are missing or invalid.
 */
export const env = envSchema.parse(process.env)

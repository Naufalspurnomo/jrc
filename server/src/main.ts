import { bootstrap } from './bootstrap';

void bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error &&
    (error.message.startsWith('Invalid production runtime configuration:') ||
      error.message.startsWith('EMAIL_TRANSPORT must be') ||
      error.message.endsWith('is required for SMTP') ||
      error.message.startsWith('Manual payment bank configuration is required'))
      ? error.message
      : 'Application bootstrap failed. Check configuration and service dependencies.';
  console.error(message);
  process.exitCode = 1;
});
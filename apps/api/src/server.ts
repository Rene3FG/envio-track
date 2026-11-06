import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`🚀 API de EnvíoTrack escuchando en http://localhost:${env.PORT}`);
  console.log(`📡 Modo: ${env.NODE_ENV}`);
});

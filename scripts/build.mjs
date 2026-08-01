import { build } from 'vite';
import react from '@vitejs/plugin-react';

// Supplying the small config directly keeps Vite from scanning parent folders
// when this project is built from a restricted workspace.
await build({
  configFile: false,
  root: process.cwd(),
  plugins: [react()],
});

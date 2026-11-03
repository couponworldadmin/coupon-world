import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cspMetaPolicy, cspHeaderPolicy } from './security/csp.mjs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

  return {
    plugins: [
      {
        name: 'production-content-security-policy',
        apply: 'build',
        transformIndexHtml: {
          order: 'post',
          handler(html) {
            return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" /><meta http-equiv="Content-Security-Policy" content="${cspMetaPolicy}" />`);
          },
        },
      },
      tailwindcss(),
      react(),
    ],
    preview: { headers: { 'Content-Security-Policy': cspHeaderPolicy } },
    server: supabaseUrl && supabaseAnonKey
      ? {
          proxy: {
            '/__sbfn': {
              target: `${supabaseUrl}/functions/v1`,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/__sbfn/, ''),
              headers: {
                apikey: supabaseAnonKey,
              },
            },
          },
        }
      : undefined,
  };
})


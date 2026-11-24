import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Dev-server middleware ensuring legacy or stored production hashed URLs
 * (e.g. /assets/tan-juttis-EZdIDvxm.jpg) resolve seamlessly to source assets
 * in the Vite development environment without requiring data resets.
 */
function wardrobeAssetDevMiddleware(): Plugin {
  const assetMap: Record<string, string> = {
    'white-tee': 'tops/white-tee.webp',
    'blue-shirt': 'tops/blue-shirt.jpg',
    'blue-jeans': 'bottoms/blue-jeans.jpg',
    'chikankari-kurta': 'ethnic/chikankari-kurta.jpg',
    'white-kurta': 'ethnic/chikankari-kurta.jpg',
    'indigo-kurta': 'ethnic/indigo-kurta.jpg',
    'blue-kurti': 'ethnic/indigo-kurta.jpg',
    'tan-juttis': 'footwear/tan-juttis.jpg',
    'juttis': 'footwear/tan-juttis.jpg',
  };

  return {
    name: 'wardrobe-asset-dev-middleware',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/assets/')) {
          for (const [key, relativePath] of Object.entries(assetMap)) {
            if (req.url.includes(key)) {
              const filePath = path.resolve(__dirname, 'src/assets/wardrobe', relativePath);
              if (fs.existsSync(filePath)) {
                const ext = path.extname(filePath).toLowerCase();
                const contentType =
                  ext === '.webp'
                    ? 'image/webp'
                    : ext === '.jpg' || ext === '.jpeg'
                    ? 'image/jpeg'
                    : 'image/png';
                res.writeHead(200, {
                  'Content-Type': contentType,
                  'Cache-Control': 'no-cache',
                });
                fs.createReadStream(filePath).pipe(res);
                return;
              }
            }
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), wardrobeAssetDevMiddleware()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    tsconfigPaths: true,
  },
});

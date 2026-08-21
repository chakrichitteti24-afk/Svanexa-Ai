import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Svanexa AI — Women’s Health & Endocrine Wellness',
    short_name: 'Svanexa AI',
    description: 'Intelligent hormonal wellness, endocrine care, and cycle harmony powered by AI.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#09080e',
    theme_color: '#09080e',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon.jpg',
        sizes: '192x192',
        type: 'image/jpeg',
        purpose: 'maskable',
      },
      {
        src: '/icon.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'any',
      },
      {
        src: '/apple-icon.jpg',
        sizes: '180x180',
        type: 'image/jpeg',
      },
    ],
  };
}

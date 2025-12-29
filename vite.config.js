import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    build: {
        chunkSizeWarningLimit: 1500,
    },
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: [
                'g-note.svg',
                'g-note-dark.svg',
                'apple-touch-icon.png',
                'favicon-32x32.png',
                'favicon-16x16.png',
                'drive-color-svgrepo-com.svg',
                'drive-google-svgrepo-com.svg',
                'pwa-64x64.png',
                'pwa-192x192.png',
                'pwa-512x512.png',
                'pwa-maskable-192x192.png',
                'pwa-maskable-512x512.png',
                'apple-splash-*.png'
            ],
            manifest: {
                name: 'G-Note - Free Note Taking App',
                short_name: 'G-Note',
                description: 'G-Note is a free, beautiful note-taking app that syncs with Google Drive. Create notes, collaborate in real-time, use AI assistance, and access your notes anywhere. Works offline!',
                theme_color: '#0a0a0a',
                background_color: '#0a0a0a',
                display: 'fullscreen',
                display_override: ['fullscreen', 'standalone'],
                orientation: 'any',
                start_url: '/',
                scope: '/',
                id: '/',
                lang: 'en',
                dir: 'ltr',
                categories: ['productivity', 'utilities', 'business', 'education'],
                prefer_related_applications: false,
                iarc_rating_id: '',
                related_applications: [
                    {
                        platform: 'webapp',
                        url: 'https://g-note.app'
                    }
                ],
                icons: [
                    // Icons với nền trắng - dùng cho install dialog và favicon
                    {
                        src: 'pwa-64x64.png',
                        sizes: '64x64',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    // Maskable icons - icon nhỏ hơn trong safe zone 80%, nền trắng
                    // Dùng cho Android adaptive icon và home screen
                    {
                        src: 'pwa-maskable-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'maskable'
                    },
                    {
                        src: 'pwa-maskable-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable'
                    }
                ],
                shortcuts: [
                    {
                        name: 'New Note',
                        short_name: 'New',
                        description: 'Create a new note quickly',
                        url: '/?action=new',
                        icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
                    },
                    {
                        name: 'Search Notes',
                        short_name: 'Search',
                        description: 'Search through your notes',
                        url: '/?action=search',
                        icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
                    }
                ],
                screenshots: [
                    {
                        src: '/og-image.png',
                        sizes: '1200x630',
                        type: 'image/png',
                        form_factor: 'wide',
                        label: 'G-Note - Note Taking App'
                    }
                ],
                handle_links: 'preferred',
                launch_handler: {
                    client_mode: ['navigate-existing', 'auto']
                }
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json}'],
                maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB limit
                // Cache strategies for different resources
                runtimeCaching: [
                    {
                        // Cache Google Fonts
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // Cache Google Fonts stylesheets
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'gstatic-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // Cache user avatars from Google
                        urlPattern: /^https:\/\/lh3\.googleusercontent\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'avatar-cache',
                            expiration: {
                                maxEntries: 20,
                                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // Network first for Google Drive API calls (with fallback)
                        urlPattern: /^https:\/\/www\.googleapis\.com\/drive\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'drive-api-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 // 1 day
                            },
                            networkTimeoutSeconds: 10,
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // Network first for other Google API calls
                        urlPattern: /^https:\/\/.*\.googleapis\.com\/.*$/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-cache',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60 * 24 // 1 day
                            },
                            networkTimeoutSeconds: 10,
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // Cache images from external sources
                        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'image-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    }
                ],
                // Skip waiting and claim clients immediately
                skipWaiting: true,
                clientsClaim: true,
                // Clean up old caches
                cleanupOutdatedCaches: true,
                // Offline fallback
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/api/]
            }
        })
    ],
    resolve: {
        alias: {
            '@': '/src'
        }
    }
});

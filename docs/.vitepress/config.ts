import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Control Plane',
  description: 'Self-hosted mini-PaaS documentation',
  base: '/',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'control.xamidullo.uz', link: 'https://control.xamidullo.uz' },
    ],
    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/guide/getting-started' },
        ],
      },
      {
        text: 'Projects',
        items: [
          { text: 'Projects & Environments', link: '/guide/projects' },
          { text: 'Environment Variables', link: '/guide/env-vars' },
        ],
      },
      {
        text: 'Deployments',
        items: [
          { text: 'Deploy Pipeline', link: '/guide/deployments' },
        ],
      },
      {
        text: 'Infrastructure',
        items: [
          { text: 'Databases', link: '/guide/databases' },
          { text: 'Domains', link: '/guide/domains' },
        ],
      },
      {
        text: 'Observability',
        items: [
          { text: 'Logs & Monitoring', link: '/guide/observability' },
        ],
      },
      {
        text: 'Operations',
        items: [
          { text: 'Notifications & Backup', link: '/guide/operations' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/ARX-SOLUTION/control-plane' },
    ],
    search: { provider: 'local' },
  },
})

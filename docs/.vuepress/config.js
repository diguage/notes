import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress'
import { viteBundler } from '@vuepress/bundler-vite'

export default defineUserConfig({
  lang: 'zh-CN',

  title: '极客日志',
  description: '极客日志的笔记仓库',

  theme: defaultTheme({
    logo: 'https://vuejs.press/images/hero.png',

    navbar: ['/', 
             '/get-started', 
              {
                text: "学习笔记",
                icon: "circle-info",
                children: [
                      {text: 'MySQL 学习笔记', link: 'https://notes.diguage.com/mysql/' },
                      {text: '深入学习设计模式', link: 'https://notes.diguage.com/design-patterns/' },
                      {text: 'Java 并发学习笔记', link: 'https://notes.diguage.com/java-concurrency/' }
                  ]
              }
            ],
  }),

  bundler: viteBundler(),
})

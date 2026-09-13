import { defineConfig } from 'vite';

// 多页面入口:竞技场 / 战绩榜 / 玩法指南
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        records: 'records.html',
        guide: 'guide.html',
      },
    },
  },
});

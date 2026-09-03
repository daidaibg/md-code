<script setup lang="ts">
import { ref } from 'vue';
import ScrollArea from '../../../src/components/scroll/ScrollArea.vue';
const expanded = ref(false);
const compact = ref(false);
</script>

<template>
  <main>
    <h1>ScrollArea 交互测试</h1>
    <button @click="expanded = !expanded">切换内容高度</button>
    <button @click="compact = !compact">切换容器宽度</button>
    <ScrollArea class="fixture" :style="{ width: compact ? '300px' : '600px' }" label="双向测试">
      <div class="wide" :style="{ height: expanded ? '2400px' : '1200px' }">
        <p>宽内容起点：轨道下方应与正文一致，没有背景条。</p>
        <p class="end">宽内容终点</p>
      </div>
    </ScrollArea>
    <ScrollArea class="empty" label="无溢出测试"><p>短内容不显示滑块</p></ScrollArea>
  </main>
</template>

<style scoped>
main { font: 16px sans-serif; }
button { margin: 0 12px 16px 0; }
.fixture { height: 350px; background: #fff; border: 1px solid #ddd; }
.wide { width: 1400px; background: linear-gradient(135deg, #eef6ff, white); }
p { margin: 0; padding: 20px; }
.end { text-align: right; }
.empty { width: 300px; height: 100px; margin-top: 20px; border: 1px solid #ddd; }
</style>

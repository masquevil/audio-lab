<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <nav
    class="app-navigation"
    aria-label="主导航"
  >
    <RouterLink
      class="navigation-link brand-link"
      to="/"
    >
      ∿ AUDIO LAB <span class="brand-caption">/ 首页</span>
    </RouterLink>
    <div class="navigation-links">
      <RouterLink
        class="navigation-link"
        to="/instruments"
      >
        乐器演奏
      </RouterLink>
      <RouterLink
        class="navigation-link"
        to="/voice"
      >
        人声模拟
      </RouterLink>
      <RouterLink
        class="navigation-link"
        to="/ambience"
      >
        环境音模拟
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped lang="scss">
// 导航容器与链接状态
.app-navigation {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 20px;
  max-width: 1060px;
  margin: auto;
  padding: 16px 28px;
  font-size: 12px;
  border-bottom: 1px solid var(--color-border);

  .navigation-link {
    color: var(--color-text-muted);
    text-decoration: none;

    &.router-link-exact-active {
      color: var(--color-accent);
    }
  }
}

// 品牌与首页提示
.brand-link {
  font-weight: 650;
  letter-spacing: 0.06em;
  .brand-caption {
    color: var(--color-text-muted);
    font-weight: 400;
    margin-left: 8px;
  }
}

.navigation-links {
  display: flex;
  align-items: center;
  gap: 24px;
}
</style>

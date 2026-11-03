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
// 导航容器：固定高度，水平内边距与页面容器一致
.app-navigation {
  // 导航高度：组件内维护的固定尺寸
  --navigation-height: 48px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  height: var(--navigation-height);
  max-width: var(--page-max-width);
  margin-inline: auto;
  padding-inline: var(--page-gutter-horizontal);

  font-size: var(--font-size-caption);
  border-bottom: 1px solid var(--color-border);

  .navigation-link {
    display: inline-flex;
    align-items: center;

    height: var(--navigation-height);
    padding-inline: var(--space-3);

    color: var(--color-text-secondary);
    text-decoration: none;

    &:hover {
      color: var(--color-text-primary);
    }

    &.router-link-exact-active {
      color: var(--color-accent);
    }
  }
}

// 品牌与首页提示
.brand-link {
  // 链接内边距向外扩展热区，负外边距让文字回到页面栅格
  margin-inline: calc(-1 * var(--space-3));

  font-weight: 600;
  letter-spacing: 0.06em;

  .brand-caption {
    color: var(--color-text-secondary);
    font-weight: 400;
    margin-left: var(--space-2);
  }
}

.navigation-links {
  display: flex;
  align-items: center;

  margin-inline: calc(-1 * var(--space-3));
}

// 窄屏：隐藏品牌副标题，保持导航单行
@media (max-width: 700px) {
  .brand-caption {
    display: none;
  }
}

// 极窄屏：链接内边距再收一档，避免导航溢出
@media (max-width: 359px) {
  .app-navigation .navigation-link {
    padding-inline: var(--space-1);
  }

  .brand-link,
  .navigation-links {
    margin-inline: calc(-1 * var(--space-1));
  }
}
</style>

<script setup lang="ts">
import LabRouteView from '@/components/LabRouteView.vue';

const viewLoader = () => import('@/views/home/HomeView.vue');
</script>

<template>
  <LabRouteView :loader="viewLoader" />
</template>

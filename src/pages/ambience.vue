<script setup lang="ts">
import LabRouteView from '@/components/LabRouteView.vue';

const viewLoader = () => import('@/views/ambience/AmbienceView.vue');
</script>

<template>
  <LabRouteView :loader="viewLoader" />
</template>

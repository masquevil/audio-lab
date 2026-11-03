<script setup lang="ts">
import LabRouteView from '@/components/LabRouteView.vue';

const viewLoader = () => import('@/views/instruments/InstrumentsView.vue');
</script>

<template>
  <LabRouteView :loader="viewLoader" />
</template>

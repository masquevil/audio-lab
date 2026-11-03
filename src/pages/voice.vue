<script setup lang="ts">
import LabRouteView from '@/components/LabRouteView.vue';

const viewLoader = () => import('@/views/voice/VoiceView.vue');
</script>

<template>
  <LabRouteView :loader="viewLoader" />
</template>

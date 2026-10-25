<template>
  <UApp>
    <div class="distribution-website">
      <div class="website-grid-fragments" aria-hidden="true">
        <div class="grid-fragment website-grid-layer" />
      </div>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>
  </UApp>
</template>

<style scoped>
.website-grid-layer {
  position: absolute;
  inset: 0;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 0%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 0%, transparent 70%);
}
</style>

<script setup lang="ts">
defineProps<{ name: 'grid' | 'rows' | 'undo' | 'redo' | 'eye' | 'save' | 'chevron' | 'plus' | 'close' | 'device' | 'arrow' | 'duplicate' | 'trash' | 'up' | 'down' | 'image' | 'layers' | 'blocks' | 'link' | 'type' | 'external' | 'alert' | 'check' | 'upload' | 'search' | 'archive' | 'edit' | 'lock' | 'globe' }>();
</script>

<template>
  <svg class="bd-icon" :class="`bd-icon-${name}`" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'grid'"><rect x="3.8" y="3.8" width="6.3" height="6.3" rx="1"/><rect x="13.9" y="3.8" width="6.3" height="6.3" rx="1"/><rect x="3.8" y="13.9" width="6.3" height="6.3" rx="1"/><rect x="13.9" y="13.9" width="6.3" height="6.3" rx="1"/></template>
    <template v-else-if="name === 'rows'"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".7" fill="currentColor"/><circle cx="4.5" cy="12" r=".7" fill="currentColor"/><circle cx="4.5" cy="18" r=".7" fill="currentColor"/></template>
    <template v-else-if="name === 'undo'"><path d="M9 14 4 9l5-5"/><path d="M5 9h9a6 6 0 0 1 0 12h-2"/></template>
    <template v-else-if="name === 'redo'"><path d="m15 14 5-5-5-5"/><path d="M19 9h-9a6 6 0 0 0 0 12h2"/></template>
    <template v-else-if="name === 'eye'"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></template>
    <template v-else-if="name === 'save'"><path d="M5 3.8h12l3 3V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M8 4v5h8V4M8 21v-8h8v8"/></template>
    <template v-else-if="name === 'chevron'"><path d="m9 18 6-6-6-6"/></template>
    <template v-else-if="name === 'plus'"><path d="M12 5v14M5 12h14"/></template>
    <template v-else-if="name === 'close'"><path d="m6 6 12 12M18 6 6 18"/></template>
    <template v-else-if="name === 'device'"><rect x="3.5" y="4.2" width="17" height="11.8" rx="1.7"/><path d="M8 20h8m-4-4v4"/></template>
    <template v-else-if="name === 'arrow'"><path d="M5 12h14m-6-6 6 6-6 6"/></template>
    <template v-else-if="name === 'duplicate'"><rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></template>
    <template v-else-if="name === 'trash'"><path d="M4 7h16m-13 0 .8 13h8.4L17 7M9 7V4h6v3m-5 4v5m4-5v5"/></template>
    <template v-else-if="name === 'archive'"><path d="M4 5h16v4H4zM6 9v10h12V9m-8 4h4"/></template>
    <template v-else-if="name === 'edit'"><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Z"/><path d="m13.8 6.7 3.5 3.5M4 20.8h16"/></template>
    <template v-else-if="name === 'lock'"><rect x="4.5" y="10" width="15" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></template>
    <template v-else-if="name === 'up'"><path d="m6 14 6-6 6 6"/></template>
    <template v-else-if="name === 'down'"><path d="m6 10 6 6 6-6"/></template>
    <template v-else-if="name === 'image'"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 3-4 5 6"/></template>
    <template v-else-if="name === 'layers'"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5m-18 5 9 5 9-5"/></template>
    <template v-else-if="name === 'blocks'"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></template>
    <template v-else-if="name === 'link'"><path d="M10 13.8a4.6 4.6 0 0 0 6.7 0l2.2-2.2a4.7 4.7 0 0 0-6.7-6.7l-1.3 1.3"/><path d="M14 10.2a4.6 4.6 0 0 0-6.7 0L5.1 12.4a4.7 4.7 0 0 0 6.7 6.7l1.3-1.3"/></template>
    <template v-else-if="name === 'type'"><path d="M4 6V4h16v2M12 4v16m-4 0h8"/></template>
    <template v-else-if="name === 'external'"><path d="M14 4h6v6m0-6-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></template>
    <template v-else-if="name === 'alert'"><path d="M12 3 2.6 20h18.8L12 3Z"/><path d="M12 9v5m0 3h.01"/></template>
    <template v-else-if="name === 'check'"><path d="m5 12 4 4L19 6"/></template>
    <template v-else-if="name === 'upload'"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/></template>
    <template v-else-if="name === 'search'"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.2 4.2"/></template>
    <template v-else-if="name === 'globe'"><circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3c2.3 2.5 3.4 5.5 3.4 9S14.3 18.5 12 21c-2.3-2.5-3.4-5.5-3.4-9S9.7 5.5 12 3Z"/></template>
  </svg>
</template>

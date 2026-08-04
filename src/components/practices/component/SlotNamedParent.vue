<script setup>
import SlotNamedChild from './SlotNamedChild.vue'
</script>

<template>
  <div class="practice-section">
    <h2>Named Slot 주입 실습</h2>
    <SlotNamedChild>
      <template v-slot:header>
        <h3>Child 주입 제목</h3>
      </template>
      <p>"이름을 안 붙인 것은 이름 없는 slot 자리로 들어간다."</p>
    </SlotNamedChild>
  </div>
</template>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between gap-2">
      <FieldLabel :html-for="id" :label="label" :description="description" />
      <span
        class="shrink-0 text-xs tabular-nums text-muted-foreground"
        :data-testid="`${id}-value`"
      >
        {{ valueText }}
      </span>
    </div>
    <Slider
      :id="id"
      :model-value="[modelValue]"
      :min="min"
      :max="max"
      :step="step"
      class="py-2"
      :aria-label="label"
      :aria-valuetext="valueText"
      @update:model-value="onUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import FieldLabel from "@/components/ai-radio/FieldLabel.vue";
import { Slider } from "@/components/ui/slider";

defineProps<{
  id: string;
  label: string;
  description?: string;
  min: number;
  max: number;
  step: number;
  // the value as read out next to the label, e.g. "-8 dB · clearly quieter"
  valueText: string;
}>();

const modelValue = defineModel<number>({ required: true });

function onUpdate(value: number[] | undefined) {
  if (value && value.length) modelValue.value = value[0];
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{
          $t("providers.ai_radio.wish.title", [showName])
        }}</DialogTitle>
        <DialogDescription>
          {{ $t("providers.ai_radio.wish.description") }}
        </DialogDescription>
      </DialogHeader>
      <Input
        id="ai-radio-show-wish"
        v-model="wish"
        :placeholder="$t('providers.ai_radio.wish.placeholder')"
        :aria-label="$t('providers.ai_radio.wish.label')"
        maxlength="500"
        @keydown.enter.prevent="submit"
      />
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          {{ $t("cancel") }}
        </Button>
        <Button @click="submit">
          <Play class="h-4 w-4" />
          {{ $t("providers.ai_radio.wish.start") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { $t } from "@/plugins/i18n";
import { Play } from "@lucide/vue";
import { ref, watch } from "vue";

const props = defineProps<{ open: boolean; showName: string }>();

const emit = defineEmits<{
  "update:open": [open: boolean];
  start: [wish: string];
}>();

const wish = ref("");

// a wish belongs to one show, so every opening starts from an empty field
watch(
  () => props.open,
  (open) => {
    if (open) wish.value = "";
  },
);

function submit() {
  emit("update:open", false);
  emit("start", wish.value.trim());
}
</script>

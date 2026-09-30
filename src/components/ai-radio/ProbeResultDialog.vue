<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{
          $t("providers.ai_radio.probe.title", [segmentName])
        }}</DialogTitle>
        <DialogDescription>
          {{ $t("providers.ai_radio.probe.description") }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="busy" class="flex items-center gap-3 py-6">
        <Spinner class="size-5 text-muted-foreground" />
        <span class="text-sm text-muted-foreground">
          {{ $t("providers.ai_radio.probe.working") }}
        </span>
      </div>
      <div v-else-if="result" class="space-y-2">
        <p class="text-xs text-muted-foreground">
          {{
            result.jingle
              ? $t("providers.ai_radio.probe.meta_jingle", [
                  seconds,
                  jingleName,
                ])
              : $t("providers.ai_radio.probe.meta", [seconds])
          }}
        </p>
        <p
          class="max-h-[40vh] overflow-y-auto whitespace-pre-line rounded-md border p-3 text-sm"
          data-testid="probe-script"
        >
          {{ result.text }}
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          {{ $t("close") }}
        </Button>
        <Button :disabled="busy" @click="emit('again')">
          <RefreshCw class="h-4 w-4" />
          {{ $t("providers.ai_radio.probe.again") }}
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
import { Spinner } from "@/components/ui/spinner";
import { jingleFileName } from "@/helpers/ai_radio";
import type { AIRadioProbeResult } from "@/plugins/api/interfaces";
import { $t, i18n } from "@/plugins/i18n";
import { RefreshCw } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  open: boolean;
  segmentName: string;
  busy: boolean;
  result: AIRadioProbeResult | null;
}>();

const emit = defineEmits<{ "update:open": [open: boolean]; again: [] }>();

const seconds = computed(() =>
  Math.round(props.result?.seconds ?? 0).toLocaleString(
    i18n.global.locale.value,
  ),
);
const jingleName = computed(
  () =>
    jingleFileName(props.result?.jingle ?? "") ||
    $t("providers.ai_radio.effects.builtin"),
);
</script>

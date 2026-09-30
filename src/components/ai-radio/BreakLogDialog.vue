<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[640px]">
      <DialogHeader>
        <DialogTitle>{{
          $t("providers.ai_radio.log.title", [showName])
        }}</DialogTitle>
        <DialogDescription>
          {{ $t("providers.ai_radio.log.description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="max-h-[60vh] min-h-40 space-y-2 overflow-y-auto pr-1">
        <div v-if="loading" class="flex justify-center py-10">
          <Spinner class="size-6 text-muted-foreground" />
        </div>
        <p
          v-else-if="entries.length === 0"
          class="py-10 text-center text-sm text-muted-foreground"
        >
          {{ $t("providers.ai_radio.log.empty") }}
        </p>
        <div
          v-for="entry in entries"
          v-else
          :key="entry.queue_item_id"
          class="space-y-1.5 rounded-md border p-3"
          data-testid="break-log-entry"
        >
          <div class="flex items-center gap-2">
            <span class="text-xs tabular-nums text-muted-foreground">
              {{ formatTime(entry.at) }}
            </span>
            <span class="min-w-0 flex-1 truncate text-sm font-medium">
              {{ entry.section }}
            </span>
            <Badge v-if="entry.skipped" variant="destructive">
              {{ $t("providers.ai_radio.log.skipped") }}
            </Badge>
          </div>

          <p v-if="entry.skipped" class="text-xs text-destructive">
            {{ skipText(entry.skipped.code) }}
          </p>
          <template v-else>
            <p class="text-xs">
              <span class="text-muted-foreground">
                {{ $t("providers.ai_radio.log.from_song") }}
              </span>
              {{ transitionText("from", entry.from_song) }}
            </p>
            <p class="text-xs">
              <span class="text-muted-foreground">
                {{ $t("providers.ai_radio.log.into_song") }}
              </span>
              {{ transitionText("into", entry.into_song, entry.jingle_after) }}
            </p>
            <p v-if="entry.jingle_before" class="text-xs">
              <span class="text-muted-foreground">
                {{ $t("providers.ai_radio.log.opener") }}
              </span>
              {{ jingleName(entry.jingle_before) }}
            </p>
            <details v-if="entry.text" class="text-sm">
              <summary
                class="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
              >
                {{ $t("providers.ai_radio.log.script") }}
              </summary>
              <p class="mt-1 whitespace-pre-line">{{ entry.text }}</p>
            </details>
          </template>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" :disabled="loading" @click="load">
          <RefreshCw class="h-4 w-4" />
          {{ $t("providers.ai_radio.log.refresh") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
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
import { useShows } from "@/composables/ai-radio/useShows";
import { errorMessage, jingleFileName } from "@/helpers/ai_radio";
import type {
  AIRadioBreakLogEntry,
  AIRadioBreakTransition,
} from "@/plugins/api/interfaces";
import { $t, i18n } from "@/plugins/i18n";
import { RefreshCw } from "@lucide/vue";
import { ref, watch } from "vue";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  stationId: string;
  showName: string;
}>();

const emit = defineEmits<{ "update:open": [open: boolean] }>();

const { loadBreakLog } = useShows();
const entries = ref<AIRadioBreakLogEntry[]>([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    entries.value = await loadBreakLog(props.stationId);
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) void load();
  },
  { immediate: true },
);

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(i18n.global.locale.value, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function seconds(value: number | undefined): string {
  return (value ?? 0).toLocaleString(i18n.global.locale.value, {
    maximumFractionDigits: 1,
  });
}

function jingleName(source: string): string {
  return jingleFileName(source) || $t("providers.ai_radio.effects.builtin");
}

/** A reason the server logged, or its code when this client does not know it yet. */
function reasonText(transition: AIRadioBreakTransition): string {
  const reason = transition.reason;
  if (!reason) return "";
  const key = `providers.ai_radio.log.reasons.${reason.code}`;
  const text = $t(key, [seconds(reason.seconds)]);
  return text === key ? reason.code : text;
}

function transitionText(
  side: "from" | "into",
  transition: AIRadioBreakTransition,
  closer = "",
): string {
  const kind = $t(`providers.ai_radio.log.${side}_kinds.${transition.kind}`, [
    seconds(transition.seconds),
    closer ? jingleName(closer) : "",
  ]);
  const why = reasonText(transition);
  return why ? `${kind} – ${why}` : kind;
}

function skipText(code: string): string {
  const key = `providers.ai_radio.log.skip_reasons.${code}`;
  const text = $t(key);
  return text === key ? $t("providers.ai_radio.log.skip_reasons.failed") : text;
}
</script>

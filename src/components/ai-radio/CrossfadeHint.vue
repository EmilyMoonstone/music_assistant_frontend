<template>
  <Alert v-if="queue && !queue.crossfade_enabled" variant="warning">
    <TriangleAlert class="h-4 w-4" />
    <AlertTitle>{{ $t("providers.ai_radio.crossfade_hint.title") }}</AlertTitle>
    <AlertDescription>
      <p>
        {{ $t("providers.ai_radio.crossfade_hint.description", [playerName]) }}
      </p>
      <Button variant="outline" size="sm" class="mt-2" @click="enable">
        {{ $t("providers.ai_radio.crossfade_hint.enable") }}
      </Button>
    </AlertDescription>
  </Alert>
</template>

<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import api from "@/plugins/api";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { TriangleAlert } from "@lucide/vue";
import { computed } from "vue";

// the player the show plays on; the active one when the show leaves it open
const props = defineProps<{ playerId?: string }>();

const targetId = computed(() => props.playerId || store.activePlayerId || "");
const queue = computed(() =>
  targetId.value ? api.queues?.[targetId.value] : undefined,
);
const playerName = computed(
  () => api.players?.[targetId.value]?.name || targetId.value,
);

function enable() {
  if (queue.value) api.queueCommandCrossfade(queue.value.queue_id, true);
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex items-center gap-3">
      <Button
        variant="ghost-icon"
        size="icon-sm"
        :aria-label="$t('back')"
        @click="handleBack"
      >
        <ArrowLeft class="h-4 w-4" />
      </Button>
      <div class="min-w-0 flex-1">
        <p class="text-xs text-muted-foreground">
          {{ $t("providers.ai_radio.customize.title") }}
        </p>
        <h1 class="truncate text-xl font-semibold tracking-tight">
          {{ draft?.basics.name || $t("providers.ai_radio.customize.title") }}
        </h1>
      </div>
      <span
        v-if="dirty"
        class="hidden text-xs text-muted-foreground sm:inline"
        data-testid="unsaved-changes"
      >
        {{ $t("providers.ai_radio.actions.unsaved") }}
      </span>
      <Button :disabled="!draft || saving || !dirty" @click="handleSave">
        {{
          saving
            ? $t("providers.ai_radio.actions.saving")
            : $t("providers.ai_radio.customize.save")
        }}
      </Button>
    </header>

    <div v-if="loading" class="flex justify-center py-16">
      <Spinner class="size-8 text-muted-foreground" />
    </div>

    <div
      v-else-if="!draft"
      class="rounded-xl border border-dashed py-16 text-center"
    >
      <p class="text-sm text-muted-foreground">{{ loadError }}</p>
      <Button variant="outline" class="mt-4" @click="emit('back')">
        {{ $t("back") }}
      </Button>
    </div>

    <template v-else>
      <Card class="rounded-[6px]">
        <CardHeader>
          <CardTitle>{{
            $t("providers.ai_radio.customize.basics_title")
          }}</CardTitle>
        </CardHeader>
        <CardContent class="grid gap-4 md:grid-cols-2">
          <div class="flex flex-col gap-1.5 md:col-span-2">
            <Label for="customize-show-name">
              {{ $t("providers.ai_radio.create.name_label") }}
            </Label>
            <Input id="customize-show-name" v-model="draft.basics.name" />
          </div>

          <div class="flex flex-col gap-1.5">
            <Label>{{ $t("providers.ai_radio.create.playlist_label") }}</Label>
            <AiRadioPlaylistPicker v-model="playlistSelection" />
          </div>

          <div class="flex flex-col gap-1.5">
            <Label for="customize-show-host">
              {{ $t("providers.ai_radio.fields.host") }}
            </Label>
            <Select v-model="hostSelectValue">
              <SelectTrigger id="customize-show-host" class="w-full">
                <SelectValue
                  :placeholder="
                    $t('providers.ai_radio.customize.host_placeholder')
                  "
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="host in hosts"
                  :key="host.id"
                  :value="host.id"
                >
                  {{ host.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="hosts.length === 0" class="text-xs text-muted-foreground">
              {{ $t("providers.ai_radio.customize.no_hosts_hint") }}
              <button
                type="button"
                class="underline underline-offset-2 hover:text-foreground"
                @click="emit('open-hosts')"
              >
                {{ $t("providers.ai_radio.customize.create_host_cta") }}
              </button>
            </p>
          </div>

          <div class="flex flex-col gap-1.5">
            <Label for="customize-default-player">
              {{ $t("providers.ai_radio.fields.default_playback_device") }}
            </Label>
            <Select v-model="defaultPlayerSelectValue">
              <SelectTrigger id="customize-default-player" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="NONE_SELECT_VALUE">
                  {{ $t("providers.ai_radio.customize.use_current_player") }}
                </SelectItem>
                <SelectItem
                  v-for="player in orderedPlayers"
                  :key="player.player_id"
                  :value="player.player_id"
                >
                  {{ player.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <CrossfadeHint
              :player-id="draft.basics.defaultPlayerId || undefined"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <FieldLabel
              html-for="customize-track-order"
              :label="$t('providers.ai_radio.running_order.label')"
              :description="$t('providers.ai_radio.running_order.help')"
            />
            <Select v-model="trackOrder">
              <SelectTrigger id="customize-track-order" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shuffle">
                  {{ $t("providers.ai_radio.running_order.shuffle") }}
                </SelectItem>
                <SelectItem value="playlist">
                  {{ $t("providers.ai_radio.running_order.playlist") }}
                </SelectItem>
                <SelectItem value="ai">
                  {{ $t("providers.ai_radio.running_order.ai") }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <template v-if="trackOrder === 'ai'">
            <div class="flex flex-col gap-1.5">
              <FieldLabel
                html-for="customize-ai-order-max-tracks"
                :label="$t('providers.ai_radio.running_order.max_tracks')"
                :description="
                  $t('providers.ai_radio.running_order.max_tracks_help')
                "
              />
              <Input
                id="customize-ai-order-max-tracks"
                v-model.number="draft.basics.aiOrderMaxTracks"
                type="number"
                :min="AI_ORDER_MAX_TRACKS_RANGE.min"
                :max="AI_ORDER_MAX_TRACKS_RANGE.max"
              />
            </div>
            <div class="flex flex-col gap-1.5 md:col-span-2">
              <FieldLabel
                html-for="customize-ai-order-prompt"
                :label="$t('providers.ai_radio.running_order.prompt')"
                :description="
                  $t('providers.ai_radio.running_order.prompt_help', [
                    '<timestamp>',
                  ])
                "
              />
              <Textarea
                id="customize-ai-order-prompt"
                v-model="draft.basics.aiOrderPrompt"
                rows="4"
                :placeholder="
                  $t('providers.ai_radio.running_order.prompt_placeholder')
                "
              />
            </div>
          </template>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible>
        <AccordionItem
          value="advanced"
          class="rounded-[6px] border bg-card px-6 shadow-sm"
        >
          <AccordionTrigger>
            {{ $t("providers.ai_radio.customize.advanced") }}
          </AccordionTrigger>
          <AccordionContent class="grid gap-4 pt-2 md:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <FieldLabel
                :label="$t('providers.ai_radio.fields.source_playtime_cap')"
                :description="
                  $t(
                    'providers.ai_radio.field_descriptions.source_playtime_cap',
                  )
                "
              />
              <NumberField v-model="draft.basics.maxDurationMinutes" :min="0">
                <NumberFieldContent>
                  <NumberFieldDecrement />
                  <NumberFieldInput />
                  <NumberFieldIncrement />
                </NumberFieldContent>
              </NumberField>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </template>
  </div>
</template>

<script setup lang="ts">
import AiRadioPlaylistPicker, {
  type PlaylistSelection,
} from "@/components/ai-radio/AiRadioPlaylistPicker.vue";
import CrossfadeHint from "@/components/ai-radio/CrossfadeHint.vue";
import FieldLabel from "@/components/ai-radio/FieldLabel.vue";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useOrderedPlayers } from "@/composables/useOrderedPlayers";
import { useHosts } from "@/composables/ai-radio/useHosts";
import { useShows } from "@/composables/ai-radio/useShows";
import {
  AI_ORDER_MAX_TRACKS_RANGE,
  compileShow,
  decompileStation,
  DEFAULT_AI_ORDER_MAX_TRACKS,
  errorMessage,
  NONE_SELECT_VALUE,
  showTrackOrder,
  type ShowDraft,
} from "@/helpers/ai_radio";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { ArrowLeft } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Textarea } from "@/components/ui/textarea";
import type { AIRadioTrackOrder } from "@/plugins/api/interfaces";

const props = defineProps<{
  stationId: string;
}>();

const emit = defineEmits<{
  back: [];
  saved: [];
  "open-hosts": [];
}>();

const router = useRouter();
const { getShow, saveShow, playlistFor } = useShows();
const { hosts, loadHosts } = useHosts();
const orderedPlayers = useOrderedPlayers();

const loading = ref(true);
const loadError = ref("");
const saving = ref(false);
const draft = ref<ShowDraft | null>(null);
/** How the show orders its songs; picking one keeps the old shuffle switch in step. */
const trackOrder = computed<AIRadioTrackOrder>({
  get: () => (draft.value ? showTrackOrder(draft.value.basics) : "shuffle"),
  set: (value) => {
    if (!draft.value) return;
    draft.value.basics.trackOrder = value;
    draft.value.basics.shuffleSourceTracks = value !== "playlist";
    draft.value.basics.aiOrderMaxTracks ??= DEFAULT_AI_ORDER_MAX_TRACKS;
  },
});
let originalSnapshot = "";

const dirty = computed(
  () => !!draft.value && JSON.stringify(draft.value) !== originalSnapshot,
);

const playlistSelection = computed<PlaylistSelection | undefined>({
  get: () => {
    if (!draft.value) return undefined;
    const { sourcePlaylistId, sourcePlaylistProvider } = draft.value.basics;
    if (!sourcePlaylistId) return undefined;
    const playlist = playlistFor(sourcePlaylistProvider, sourcePlaylistId);
    return {
      itemId: sourcePlaylistId,
      provider: sourcePlaylistProvider,
      name: playlist?.name || sourcePlaylistId,
    };
  },
  set: (value) => {
    if (!draft.value || !value) return;
    draft.value.basics.sourcePlaylistId = value.itemId;
    draft.value.basics.sourcePlaylistProvider = value.provider;
  },
});

const hostSelectValue = computed({
  get: () => draft.value?.hostId || "",
  set: (value: string) => {
    if (!draft.value) return;
    draft.value.hostId = value;
  },
});

const defaultPlayerSelectValue = computed({
  get: () => draft.value?.basics.defaultPlayerId || NONE_SELECT_VALUE,
  set: (value: string) => {
    if (!draft.value) return;
    draft.value.basics.defaultPlayerId =
      value === NONE_SELECT_VALUE ? "" : value;
  },
});

function confirmDiscard(onConfirm: () => void) {
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("providers.ai_radio.confirm.discard_changes_title"),
    message: $t("providers.ai_radio.confirm.discard_changes"),
    confirmLabel: $t("providers.ai_radio.actions.discard"),
    onConfirm,
  });
}

function handleBack() {
  if (!dirty.value) {
    emit("back");
    return;
  }
  confirmDiscard(() => emit("back"));
}

async function handleSave() {
  if (!draft.value) return;
  if (!draft.value.hostId) {
    toast.error($t("providers.ai_radio.customize.host_required"));
    return;
  }
  saving.value = true;
  try {
    const station = compileShow(draft.value);
    await saveShow(station);
    originalSnapshot = JSON.stringify(draft.value);
    emit("saved");
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

onBeforeRouteLeave((to) => {
  if (!dirty.value) return true;
  confirmDiscard(() => {
    void router.push(to.fullPath);
  });
  return false;
});

onMounted(async () => {
  try {
    // Always refresh: a cached list still renders instantly, but host names
    // edited elsewhere would otherwise show up stale in the picker.
    await loadHosts();
    const station = await getShow(props.stationId);
    const decompiled = decompileStation(station);
    draft.value = { basics: decompiled.basics, hostId: decompiled.hostId };
    originalSnapshot = JSON.stringify(draft.value);
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div
    class="rounded-[6px] border bg-card/40 transition-colors hover:bg-card"
    :class="{ 'border-destructive': invalid }"
  >
    <div class="flex items-start gap-2 px-3 py-2 sm:items-center">
      <div class="flex shrink-0 flex-col">
        <Button
          variant="ghost-icon"
          size="icon-xs"
          :disabled="!canMoveUp"
          :aria-label="$t('providers.ai_radio.actions.up')"
          @click="emit('move-up')"
        >
          <ChevronUp class="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost-icon"
          size="icon-xs"
          :disabled="!canMoveDown"
          :aria-label="$t('providers.ai_radio.actions.down')"
          @click="emit('move-down')"
        >
          <ChevronDown class="h-3.5 w-3.5" />
        </Button>
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            v-model="name"
            class="h-8 min-w-0 flex-1"
            :aria-label="$t('providers.ai_radio.customize.segment_name')"
          />

          <div
            class="flex w-full items-center gap-1 sm:w-[240px] sm:shrink-0 sm:gap-2"
          >
            <Select v-model="playsKind">
              <SelectTrigger class="h-8 min-w-0 flex-1 px-2 text-xs sm:px-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in playsKindOptions"
                  :key="option.kind"
                  :value="option.kind"
                  class="text-xs"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>

            <NumberField
              v-if="needsN"
              v-model="playsN"
              class="w-12 shrink-0 sm:w-16"
              :min="1"
              :format-options="{ useGrouping: false, maximumFractionDigits: 0 }"
            >
              <NumberFieldContent>
                <NumberFieldInput class="h-8 text-xs" />
              </NumberFieldContent>
            </NumberField>
            <NumberField
              v-if="needsPercent"
              v-model="playsPercent"
              class="w-12 shrink-0 sm:w-16"
              :min="0"
              :max="100"
              :format-options="{ useGrouping: false, maximumFractionDigits: 0 }"
            >
              <NumberFieldContent>
                <NumberFieldInput class="h-8 text-xs" />
              </NumberFieldContent>
            </NumberField>
          </div>
        </div>

        <div
          v-if="!expanded && badges.length"
          class="flex flex-wrap gap-1"
          data-testid="segment-badges"
        >
          <Badge
            v-for="badge in badges"
            :key="badge"
            variant="secondary"
            class="text-[11px] font-normal"
          >
            {{ badge }}
          </Badge>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        class="shrink-0"
        :disabled="probing || !segment.prompt.trim()"
        :title="$t('providers.ai_radio.probe.button_help')"
        data-testid="segment-probe"
        @click="emit('probe')"
      >
        <Spinner v-if="probing" class="size-4" />
        <Headphones v-else class="h-4 w-4" />
        <span class="hidden sm:inline">
          {{ $t("providers.ai_radio.probe.button") }}
        </span>
      </Button>

      <Button
        variant="ghost-icon"
        size="icon-sm"
        class="shrink-0"
        :aria-label="expanded ? $t('show_less') : $t('show_more')"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <ChevronDown
          class="h-4 w-4 transition-transform"
          :class="{ 'rotate-180': expanded }"
        />
      </Button>
    </div>

    <div v-if="expanded" class="space-y-5 border-t px-3 py-3">
      <section class="space-y-3">
        <h4
          class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {{ $t("providers.ai_radio.customize.group_content") }}
        </h4>
        <div class="flex flex-col gap-1.5">
          <Label :for="`segment-prompt-${segment.id}`">
            {{ $t("providers.ai_radio.fields.prompt") }}
          </Label>
          <div ref="promptBox">
            <Textarea
              :id="`segment-prompt-${segment.id}`"
              v-model="prompt"
              rows="4"
              class="text-sm"
              :aria-invalid="invalid"
            />
          </div>
          <p v-if="invalid" class="text-xs text-destructive">
            {{
              $t(
                "providers.ai_radio.hosts.editor.validation.segment_prompt_required",
              )
            }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ $t("providers.ai_radio.customize.prompt_placeholders_label") }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <Badge
              v-for="token in PROMPT_PLACEHOLDERS"
              :key="token"
              as="button"
              type="button"
              variant="outline"
              class="cursor-pointer gap-1.5 hover:bg-accent hover:text-accent-foreground"
              :aria-label="
                $t('providers.ai_radio.customize.prompt_placeholder_insert', [
                  token,
                ])
              "
              :title="token"
              @click="insertPlaceholder(token)"
            >
              <Plus class="h-3 w-3" />
              {{
                $t(`providers.ai_radio.placeholders.${placeholderKey(token)}`)
              }}
            </Badge>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <Label :for="`segment-web-${segment.id}`">
              {{ $t("providers.ai_radio.fields.web_search_mode") }}
            </Label>
            <Select v-model="webSearch">
              <SelectTrigger :id="`segment-web-${segment.id}`" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">
                  {{ $t("providers.ai_radio.web_search.disabled") }}
                </SelectItem>
                <SelectItem value="allow">
                  {{ $t("providers.ai_radio.web_search.allow") }}
                </SelectItem>
                <SelectItem value="force">
                  {{ $t("providers.ai_radio.web_search.force") }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">
              {{ $t("providers.ai_radio.web_search.help") }}
            </p>
          </div>

          <div class="flex flex-col gap-1.5">
            <Label :for="`segment-length-${segment.id}`">
              {{ $t("providers.ai_radio.fields.character_limit") }}
            </Label>
            <NumberField
              :id="`segment-length-${segment.id}`"
              v-model="maxChars"
              :min="0"
              :step="50"
            >
              <NumberFieldContent>
                <NumberFieldDecrement />
                <NumberFieldInput />
                <NumberFieldIncrement />
              </NumberFieldContent>
            </NumberField>
            <p class="text-xs text-muted-foreground">
              {{
                segment.maxChars > 0
                  ? $t("providers.ai_radio.customize.spoken_seconds", [
                      spokenSeconds(segment.maxChars),
                    ])
                  : $t("providers.ai_radio.customize.no_length_limit")
              }}
            </p>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <h4
          class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {{ $t("providers.ai_radio.customize.group_transitions") }}
        </h4>
        <div class="grid gap-4 sm:grid-cols-2">
          <div
            v-for="side in SIDES"
            :key="side.slot"
            class="flex flex-col gap-3 rounded-md border p-3"
          >
            <p class="text-sm font-medium">
              {{ $t(`providers.ai_radio.customize.${side.title}`) }}
            </p>
            <div
              v-if="api.supportsAIRadioAllowPost"
              class="flex items-center gap-3"
            >
              <FieldLabel
                :html-for="`${side.switchId}-${segment.id}`"
                :label="$t(`providers.ai_radio.fields.${side.field}`)"
                :description="
                  $t(`providers.ai_radio.field_descriptions.${side.field}`)
                "
              />
              <Switch
                :id="`${side.switchId}-${segment.id}`"
                :model-value="switchValue(side.flag)"
                @update:model-value="setSwitch(side.flag, $event)"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label :for="`segment-${side.slot}-${segment.id}`">
                {{ $t(`providers.ai_radio.effects.${side.label}`) }}
              </Label>
              <Select
                :model-value="segment[side.slot] ?? 'auto'"
                @update:model-value="setJingleMode(side.slot, $event)"
              >
                <SelectTrigger
                  :id="`segment-${side.slot}-${segment.id}`"
                  class="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="mode in JINGLE_MODES"
                    :key="mode"
                    :value="mode"
                  >
                    {{ jingleModeLabel(side.label, mode) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p class="text-xs text-muted-foreground">
                {{
                  $t(
                    `providers.ai_radio.effects.${side.label}_modes_help.${segment[side.slot] ?? "auto"}`,
                  )
                }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div class="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          class="text-destructive hover:text-destructive"
          @click="emit('remove')"
        >
          <Trash2 class="h-4 w-4" />
          {{ $t("providers.ai_radio.actions.remove") }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import FieldLabel from "@/components/ai-radio/FieldLabel.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  playsRuleLabel,
  spokenSeconds,
  type PlaysRule,
  type ShowSegment,
} from "@/helpers/ai_radio";
import { api } from "@/plugins/api";
import type {
  AIRadioJingleMode,
  AIRadioWebSearchMode,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ChevronDown, ChevronUp, Headphones, Plus, Trash2 } from "@lucide/vue";
import { computed, nextTick, ref, watch } from "vue";

// listed literally so translators never handle raw <placeholder> markup
const PROMPT_PLACEHOLDERS = [
  "<prev_songinfo>",
  "<next_songinfo>",
  "<very_next_songinfo>",
  "<timestamp>",
  "<weather_hourly>",
  "<weather_daily>",
  "<recent_breaks>",
  "<recent_news>",
];

const props = defineProps<{
  segment: ShowSegment;
  canMoveUp: boolean;
  canMoveDown: boolean;
  // the segment stopped a save, e.g. for want of a prompt
  invalid?: boolean;
  // a rehearsal of the segment is being made
  probing?: boolean;
}>();

const emit = defineEmits<{
  update: [segment: ShowSegment];
  "move-up": [];
  "move-down": [];
  remove: [];
  probe: [];
}>();

const expanded = ref(false);

// a segment that stopped a save opens up, so what is missing is in view
watch(
  () => props.invalid,
  (invalid) => {
    if (invalid) expanded.value = true;
  },
  { immediate: true },
);

const JINGLE_MODES: AIRadioJingleMode[] = [
  "auto",
  "always",
  "no_post",
  "never",
];

// the start of a break meets the song before it, its end the song after it
const SIDES = [
  {
    title: "side_start",
    field: "allow_talk_over",
    flag: "allowTalkOver",
    switchId: "allow-talk-over",
    slot: "jingleBefore",
    label: "jingle_before",
  },
  {
    title: "side_end",
    field: "allow_post",
    flag: "allowPost",
    switchId: "allow-post",
    slot: "jingleAfter",
    label: "jingle_after",
  },
] as const;

type JingleSlot = (typeof SIDES)[number]["slot"];
type TalkFlag = (typeof SIDES)[number]["flag"];

function jingleModeLabel(label: string, mode: AIRadioJingleMode): string {
  // "no post" means something else at each end, so it is named for its side
  return mode === "no_post"
    ? $t(`providers.ai_radio.effects.${label}_mode_no_post`)
    : $t(`providers.ai_radio.effects.jingle_mode_${mode}`);
}

function setJingleMode(key: JingleSlot, value: unknown) {
  if (!JINGLE_MODES.includes(value as AIRadioJingleMode)) return;
  emit("update", { ...props.segment, [key]: value as AIRadioJingleMode });
}

function switchValue(flag: TalkFlag): boolean {
  return props.segment[flag] ?? false;
}

function setSwitch(flag: TalkFlag, value: boolean) {
  emit("update", { ...props.segment, [flag]: value });
}

/** The short names the segment's settings show under it while it is folded. */
const badges = computed(() => {
  const { segment } = props;
  const list: string[] = [];
  if (segment.allowTalkOver)
    list.push($t("providers.ai_radio.badges.talk_over"));
  if (segment.allowPost) list.push($t("providers.ai_radio.badges.post"));
  for (const side of SIDES) {
    const mode = segment[side.slot];
    if (mode && mode !== "auto") {
      list.push(
        $t(`providers.ai_radio.badges.${side.label}`, [
          jingleModeLabel(side.label, mode),
        ]),
      );
    }
  }
  if (segment.webSearch !== "disabled") {
    list.push($t(`providers.ai_radio.badges.web_${segment.webSearch}`));
  }
  return list;
});

function placeholderKey(token: string): string {
  return token.replace(/[<>]/g, "");
}

const promptBox = ref<HTMLElement | null>(null);

/** Puts a placeholder where the cursor stands in the prompt, or at its end. */
async function insertPlaceholder(token: string) {
  const textarea = promptBox.value?.querySelector("textarea");
  const text = props.segment.prompt;
  const start = textarea?.selectionStart ?? text.length;
  const end = textarea?.selectionEnd ?? text.length;
  const before = text.slice(0, start);
  // a placeholder glued to a word would read as part of it
  const spaced = before && !/\s$/.test(before) ? ` ${token}` : token;
  emit("update", {
    ...props.segment,
    prompt: `${before}${spaced}${text.slice(end)}`,
  });
  await nextTick();
  if (textarea) {
    const cursor = before.length + spaced.length;
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
  }
}

const DEFAULT_EVERY_N_SONGS = 3;
const DEFAULT_EVERY_N_MIN = 60;
const DEFAULT_OCCASIONALLY_PERCENT = 20;

const PLAYS_KINDS: PlaysRule["kind"][] = [
  "start",
  "end",
  "every_song",
  "every_n_songs",
  "every_n_min",
  "occasionally",
];

/** A representative rule per kind, used to render the Select's option labels via playsRuleLabel. */
function representativeRule(kind: PlaysRule["kind"]): PlaysRule {
  if (props.segment.plays.kind === kind) return props.segment.plays;
  switch (kind) {
    case "every_n_songs":
      return { kind, n: DEFAULT_EVERY_N_SONGS };
    case "every_n_min":
      return { kind, n: DEFAULT_EVERY_N_MIN };
    case "occasionally":
      return { kind, percent: DEFAULT_OCCASIONALLY_PERCENT };
    default:
      return { kind };
  }
}

const playsKindOptions = computed(() =>
  PLAYS_KINDS.map((kind) => ({
    kind,
    label: playsRuleLabel(representativeRule(kind)),
  })),
);

const needsN = computed(
  () =>
    props.segment.plays.kind === "every_n_songs" ||
    props.segment.plays.kind === "every_n_min",
);
const needsPercent = computed(
  () => props.segment.plays.kind === "occasionally",
);

const name = computed({
  get: () => props.segment.name,
  set: (value: string) => emit("update", { ...props.segment, name: value }),
});

const prompt = computed({
  get: () => props.segment.prompt,
  set: (value: string) => emit("update", { ...props.segment, prompt: value }),
});

const webSearch = computed({
  get: () => props.segment.webSearch,
  set: (value: AIRadioWebSearchMode) =>
    emit("update", { ...props.segment, webSearch: value }),
});

const maxChars = computed({
  get: () => props.segment.maxChars,
  set: (value: number) =>
    emit("update", { ...props.segment, maxChars: Math.max(0, value) }),
});

const playsKind = computed({
  get: () => props.segment.plays.kind,
  set: (kind: PlaysRule["kind"]) => {
    emit("update", { ...props.segment, plays: representativeRule(kind) });
  },
});

const playsN = computed({
  get: () => {
    const { plays } = props.segment;
    return plays.kind === "every_n_songs" || plays.kind === "every_n_min"
      ? plays.n
      : 0;
  },
  set: (value: number) => {
    const { plays } = props.segment;
    if (plays.kind !== "every_n_songs" && plays.kind !== "every_n_min") return;
    emit("update", {
      ...props.segment,
      plays: { kind: plays.kind, n: Math.max(1, value) },
    });
  },
});

const playsPercent = computed({
  get: () => {
    const { plays } = props.segment;
    return plays.kind === "occasionally" ? plays.percent : 0;
  },
  set: (value: number) => {
    if (props.segment.plays.kind !== "occasionally") return;
    emit("update", {
      ...props.segment,
      plays: {
        kind: "occasionally",
        percent: Math.min(100, Math.max(0, value)),
      },
    });
  },
});
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="(jingle, index) in jingles"
      :key="index"
      class="rounded-md border"
      data-testid="jingle-row"
    >
      <div class="flex items-center gap-2 px-2 py-1.5">
        <Button
          variant="ghost-icon"
          size="icon-sm"
          class="shrink-0"
          :disabled="!jingle.source.trim()"
          :aria-label="$t('providers.ai_radio.effects.preview')"
          :title="$t('providers.ai_radio.effects.preview')"
          @click="previewJingle(jingle.source.trim())"
        >
          <Play class="h-4 w-4" />
        </Button>
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-2 text-left"
          :aria-expanded="isOpen(index)"
          @click="toggleOpen(index)"
        >
          <span class="truncate text-sm" data-testid="jingle-name">
            {{ displayName(jingle) }}
          </span>
          <span
            v-if="jingle.source.trim() && !jingle.text.trim()"
            role="img"
            class="shrink-0 text-amber-500"
            :title="$t('providers.ai_radio.effects.no_text_warning')"
            :aria-label="$t('providers.ai_radio.effects.no_text_warning')"
            data-testid="jingle-no-text"
          >
            <TriangleAlert class="h-3.5 w-3.5" />
          </span>
          <span
            v-if="!isOpen(index)"
            class="hidden min-w-0 truncate text-xs text-muted-foreground sm:inline"
          >
            {{ tagSummary(jingle) }}
          </span>
        </button>
        <Button
          variant="ghost-icon"
          size="icon-sm"
          class="shrink-0"
          :aria-label="isOpen(index) ? $t('show_less') : $t('show_more')"
          @click="toggleOpen(index)"
        >
          <ChevronDown
            class="h-4 w-4 transition-transform"
            :class="{ 'rotate-180': isOpen(index) }"
          />
        </Button>
        <Button
          variant="ghost-icon"
          size="icon-sm"
          class="shrink-0 text-destructive hover:text-destructive"
          :aria-label="$t('providers.ai_radio.effects.remove_jingle')"
          @click="removeJingle(index)"
        >
          <Trash2 class="h-4 w-4" />
        </Button>
      </div>

      <div v-if="isOpen(index)" class="space-y-2 border-t p-3">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            v-model="jingle.source"
            class="h-8 min-w-0 sm:flex-1"
            :placeholder="$t('providers.ai_radio.effects.source_placeholder')"
            :aria-label="$t('providers.ai_radio.effects.jingle_source')"
          />
          <div class="flex shrink-0 gap-1">
            <Button
              variant="outline"
              size="sm"
              :disabled="!jingle.source.trim() || reading === index"
              :title="$t('providers.ai_radio.effects.read_from_file_help')"
              @click="readFromFile(index)"
            >
              <Spinner v-if="reading === index" class="size-4" />
              <FileAudio v-else class="h-4 w-4" />
              {{ $t("providers.ai_radio.effects.read_from_file") }}
            </Button>
            <Button
              variant="outline"
              size="sm"
              :disabled="!canAnalyze(jingle) || analyzing === index"
              :title="$t('providers.ai_radio.effects.analyze_style_help')"
              @click="analyzeStyle(index)"
            >
              <Spinner v-if="analyzing === index" class="size-4" />
              <Sparkles v-else class="h-4 w-4" />
              {{ $t("providers.ai_radio.effects.analyze_style") }}
            </Button>
          </div>
        </div>

        <div class="flex flex-wrap gap-1.5">
          <Badge
            v-for="tag in PRESET_TAGS"
            :key="tag"
            as="button"
            type="button"
            :variant="jingle.tags.includes(tag) ? 'default' : 'outline'"
            class="cursor-pointer"
            :aria-pressed="jingle.tags.includes(tag)"
            @click="toggleTag(jingle, tag)"
          >
            {{ $t(`providers.ai_radio.effects.tags.${tag}`) }}
          </Badge>
          <Badge
            v-for="tag in freeTags(jingle)"
            :key="tag"
            as="button"
            type="button"
            variant="secondary"
            class="cursor-pointer"
            :aria-label="$t('providers.ai_radio.effects.remove_tag', [tag])"
            @click="toggleTag(jingle, tag)"
          >
            {{ tag }}
            <X class="h-3 w-3" />
          </Badge>
          <Input
            class="h-6 w-36 text-xs"
            :placeholder="$t('providers.ai_radio.effects.add_tag')"
            :aria-label="$t('providers.ai_radio.effects.add_tag')"
            @keydown.enter.prevent="addTag(jingle, $event)"
            @blur="addTag(jingle, $event)"
          />
        </div>

        <Textarea
          v-model="jingle.text"
          rows="1"
          class="min-h-8 py-1.5 text-sm"
          :placeholder="
            $t('providers.ai_radio.effects.jingle_text_placeholder')
          "
          :aria-label="$t('providers.ai_radio.effects.jingle_text')"
        />
      </div>
    </div>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button size="sm" variant="outline">
          <Plus class="h-4 w-4" />
          {{ $t("providers.ai_radio.effects.add_jingle") }}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem @click="browserOpen = true">
          <FolderOpen class="h-4 w-4" />
          {{ $t("providers.ai_radio.effects.browse") }}
        </DropdownMenuItem>
        <DropdownMenuItem @click="addJingle('')">
          <Link class="h-4 w-4" />
          {{ $t("providers.ai_radio.effects.add_by_path") }}
        </DropdownMenuItem>
        <DropdownMenuItem @click="addJingle(BUILTIN_JINGLE)">
          <Bell class="h-4 w-4" />
          {{ $t("providers.ai_radio.effects.builtin") }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <JingleBrowserDialog v-model:open="browserOpen" @add="addPicked" />
  </div>
</template>

<script setup lang="ts">
import JingleBrowserDialog from "@/components/ai-radio/JingleBrowserDialog.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useHosts } from "@/composables/ai-radio/useHosts";
import {
  BUILTIN_JINGLE,
  errorMessage,
  JINGLE_OCCASION_TAGS,
  JINGLE_TIME_TAGS,
  jingleFileName,
  normalizeJingleTag,
  type HostJingle,
} from "@/helpers/ai_radio";
import { $t } from "@/plugins/i18n";
import {
  Bell,
  ChevronDown,
  FileAudio,
  FolderOpen,
  Link,
  Play,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from "@lucide/vue";
import { ref } from "vue";
import { toast } from "vue-sonner";

const PRESET_TAGS: readonly string[] = [
  ...JINGLE_OCCASION_TAGS,
  ...JINGLE_TIME_TAGS,
];

const jingles = defineModel<HostJingle[]>({ required: true });
// the language the host speaks, so a jingle is listened to in it
const props = defineProps<{ language?: string }>();

const { analyzeJingle, inspectJingle, previewJingle } = useHosts();
const reading = ref<number | null>(null);
const analyzing = ref<number | null>(null);
const browserOpen = ref(false);
// the rows unfolded to edit; a jingle is a single line otherwise
const openRows = ref(new Set<number>());

function isOpen(index: number): boolean {
  return openRows.value.has(index);
}

function toggleOpen(index: number) {
  const rows = new Set(openRows.value);
  if (rows.has(index)) rows.delete(index);
  else rows.add(index);
  openRows.value = rows;
}

function displayName(jingle: HostJingle): string {
  if (jingle.source === BUILTIN_JINGLE) {
    return $t("providers.ai_radio.effects.builtin");
  }
  return (
    jingleFileName(jingle.source) || $t("providers.ai_radio.effects.new_jingle")
  );
}

/** The jingle's tags as one line, the named ones in their own words. */
function tagSummary(jingle: HostJingle): string {
  return jingle.tags
    .map((tag) =>
      PRESET_TAGS.includes(tag)
        ? $t(`providers.ai_radio.effects.tags.${tag}`)
        : tag,
    )
    .join(" · ");
}

function freeTags(jingle: HostJingle): string[] {
  return jingle.tags.filter((tag) => !PRESET_TAGS.includes(tag));
}

function toggleTag(jingle: HostJingle, tag: string) {
  const index = jingle.tags.indexOf(tag);
  if (index >= 0) jingle.tags.splice(index, 1);
  else jingle.tags.push(tag);
}

function addTag(jingle: HostJingle, event: Event) {
  const input = event.target as HTMLInputElement;
  const tag = normalizeJingleTag(input.value);
  if (tag && !jingle.tags.includes(tag)) jingle.tags.push(tag);
  input.value = "";
}

/** Appends the jingles picked from the media folder, skipping ones already in the library. */
function addPicked(picked: HostJingle[]) {
  const known = new Set(jingles.value.map((jingle) => jingle.source));
  jingles.value.push(...picked.filter((jingle) => !known.has(jingle.source)));
}

/** Adds a jingle and unfolds it, as it still needs its file, tags or words. */
function addJingle(source: string) {
  jingles.value.push({ source, tags: [], text: "" });
  openRows.value = new Set([...openRows.value, jingles.value.length - 1]);
}

function removeJingle(index: number) {
  jingles.value.splice(index, 1);
  // the rows after it move up one, so what was unfolded is not kept by position
  openRows.value = new Set();
}

/** Only a file in the media folder can be sent to the AI, not the gong or a URL. */
function canAnalyze(jingle: HostJingle): boolean {
  return jingle.source.trim().startsWith("/");
}

/**
 * Lets the AI listen to the jingle: adds the tags it suggests to the ones set,
 * fills in its words when none are typed, and says what it heard.
 */
async function analyzeStyle(index: number) {
  const jingle = jingles.value[index];
  analyzing.value = index;
  try {
    const analysis = await analyzeJingle(
      jingle.source.trim(),
      props.language || undefined,
    );
    const added = analysis.tags
      .map(normalizeJingleTag)
      .filter((tag) => tag && !jingle.tags.includes(tag));
    jingle.tags.push(...added);
    if (!jingle.text.trim() && analysis.text) jingle.text = analysis.text;
    toast.success(
      added.length
        ? $t("providers.ai_radio.effects.analyze_style_done", [
            added.join(", "),
            analysis.style,
          ])
        : $t("providers.ai_radio.effects.analyze_style_nothing_new", [
            analysis.style,
          ]),
    );
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    analyzing.value = null;
  }
}

/**
 * Fills in the words the file says, from its lyrics tag or else by listening to
 * it, keeping any typed ones when neither finds words.
 */
async function readFromFile(index: number) {
  const jingle = jingles.value[index];
  reading.value = index;
  try {
    const info = await inspectJingle(jingle.source.trim(), {
      transcribe: true,
      language: props.language || undefined,
    });
    if (info.text) {
      jingle.text = info.text;
      if (info.text_source === "speech") {
        toast.info($t("providers.ai_radio.effects.words_from_speech"));
      }
    } else {
      toast.info($t("providers.ai_radio.effects.no_words_in_file"));
    }
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    reading.value = null;
  }
}
</script>

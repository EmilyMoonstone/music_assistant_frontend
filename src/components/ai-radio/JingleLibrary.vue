<template>
  <div class="space-y-3">
    <div
      v-for="(jingle, index) in jingles"
      :key="index"
      class="space-y-2 rounded-md border p-3"
      data-testid="jingle-row"
    >
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
            size="icon-sm"
            :disabled="!jingle.source.trim()"
            :aria-label="$t('providers.ai_radio.effects.preview')"
            :title="$t('providers.ai_radio.effects.preview')"
            @click="previewJingle(jingle.source.trim())"
          >
            <Play class="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            @click="jingle.source = BUILTIN_JINGLE"
          >
            {{ $t("providers.ai_radio.effects.builtin") }}
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="!jingle.source.trim() || reading === index"
            @click="readFromFile(index)"
          >
            <FileAudio class="h-4 w-4" />
            {{ $t("providers.ai_radio.effects.read_from_file") }}
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="!canAnalyze(jingle) || analyzing === index"
            :title="$t('providers.ai_radio.effects.analyze_style_help')"
            @click="analyzeStyle(index)"
          >
            <Sparkles class="h-4 w-4" />
            {{ $t("providers.ai_radio.effects.analyze_style") }}
          </Button>
          <Button
            variant="ghost-icon"
            size="icon-sm"
            class="text-destructive hover:text-destructive"
            :aria-label="$t('providers.ai_radio.effects.remove_jingle')"
            @click="jingles.splice(index, 1)"
          >
            <Trash2 class="h-4 w-4" />
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
        :placeholder="$t('providers.ai_radio.effects.jingle_text_placeholder')"
        :aria-label="$t('providers.ai_radio.effects.jingle_text')"
      />
    </div>

    <div class="flex flex-wrap gap-2">
      <Button size="sm" @click="browserOpen = true">
        <FolderOpen class="h-4 w-4" />
        {{ $t("providers.ai_radio.effects.browse") }}
      </Button>
      <Button variant="outline" size="sm" @click="addJingle">
        <Plus class="h-4 w-4" />
        {{ $t("providers.ai_radio.effects.add_jingle") }}
      </Button>
    </div>
    <JingleBrowserDialog v-model:open="browserOpen" @add="addPicked" />
  </div>
</template>

<script setup lang="ts">
import JingleBrowserDialog from "@/components/ai-radio/JingleBrowserDialog.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useHosts } from "@/composables/ai-radio/useHosts";
import {
  BUILTIN_JINGLE,
  errorMessage,
  JINGLE_OCCASION_TAGS,
  JINGLE_TIME_TAGS,
  normalizeJingleTag,
  type HostJingle,
} from "@/helpers/ai_radio";
import { $t } from "@/plugins/i18n";
import {
  FileAudio,
  FolderOpen,
  Play,
  Plus,
  Sparkles,
  Trash2,
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

function addJingle() {
  jingles.value.push({ source: "", tags: [], text: "" });
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

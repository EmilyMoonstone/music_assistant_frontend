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
        rows="2"
        class="text-sm"
        :placeholder="$t('providers.ai_radio.effects.jingle_text_placeholder')"
        :aria-label="$t('providers.ai_radio.effects.jingle_text')"
      />
    </div>

    <Button variant="outline" size="sm" @click="addJingle">
      <Plus class="h-4 w-4" />
      {{ $t("providers.ai_radio.effects.add_jingle") }}
    </Button>
  </div>
</template>

<script setup lang="ts">
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
import { FileAudio, Plus, Trash2, X } from "@lucide/vue";
import { ref } from "vue";
import { toast } from "vue-sonner";

const PRESET_TAGS: readonly string[] = [
  ...JINGLE_OCCASION_TAGS,
  ...JINGLE_TIME_TAGS,
];

const jingles = defineModel<HostJingle[]>({ required: true });

const { inspectJingle } = useHosts();
const reading = ref<number | null>(null);

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

function addJingle() {
  jingles.value.push({ source: "", tags: [], text: "" });
}

/** Fills in the words the file says (from its lyrics tag), keeping any typed ones. */
async function readFromFile(index: number) {
  const jingle = jingles.value[index];
  reading.value = index;
  try {
    const info = await inspectJingle(jingle.source.trim());
    if (info.text) {
      jingle.text = info.text;
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

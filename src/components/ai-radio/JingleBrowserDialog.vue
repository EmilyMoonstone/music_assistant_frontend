<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[560px]">
      <DialogHeader>
        <DialogTitle>{{
          $t("providers.ai_radio.effects.browse_title")
        }}</DialogTitle>
        <DialogDescription>
          {{ $t("providers.ai_radio.effects.browse_description") }}
        </DialogDescription>
      </DialogHeader>

      <p
        class="truncate font-mono text-xs text-muted-foreground"
        data-testid="jingle-browser-path"
      >
        {{ folder?.path }}
      </p>

      <div class="max-h-[50vh] min-h-40 overflow-y-auto rounded-md border">
        <div v-if="loading" class="flex justify-center py-10">
          <Spinner class="size-6 text-muted-foreground" />
        </div>
        <template v-else-if="folder">
          <button
            v-if="folder.parent"
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
            @click="browse(folder.parent)"
          >
            <CornerLeftUp class="h-4 w-4 shrink-0" />
            {{ $t("providers.ai_radio.effects.browse_up") }}
          </button>
          <button
            v-for="item in folder.folders"
            :key="item.path"
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
            @click="browse(item.path)"
          >
            <Folder class="h-4 w-4 shrink-0" />
            <span class="truncate">{{ item.name }}</span>
          </button>
          <div
            v-for="item in folder.files"
            :key="item.path"
            class="flex items-center hover:bg-accent"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
              :aria-pressed="selected.has(item.path)"
              @click="toggle(item.path)"
            >
              <SquareCheck
                v-if="selected.has(item.path)"
                class="h-4 w-4 shrink-0 text-primary"
              />
              <Square v-else class="h-4 w-4 shrink-0 text-muted-foreground" />
              <FileAudio class="h-4 w-4 shrink-0" />
              <span class="truncate">{{ item.name }}</span>
            </button>
            <Button
              variant="ghost-icon"
              size="icon-sm"
              class="mr-2 shrink-0"
              :aria-label="
                $t('providers.ai_radio.effects.preview_file', [item.name])
              "
              :title="$t('providers.ai_radio.effects.preview')"
              @click="previewJingle(item.path)"
            >
              <Play class="h-4 w-4" />
            </Button>
          </div>
          <p
            v-if="!folder.folders.length && !folder.files.length"
            class="px-3 py-6 text-center text-sm text-muted-foreground"
          >
            {{ $t("providers.ai_radio.effects.browse_empty") }}
          </p>
        </template>
      </div>

      <DialogFooter class="gap-2 sm:justify-between">
        <Button
          variant="outline"
          :disabled="!folder?.files.length"
          @click="selectAll"
        >
          {{ $t("providers.ai_radio.effects.browse_select_all") }}
        </Button>
        <Button :disabled="!selected.size || adding" @click="add">
          <Spinner v-if="adding" class="size-4" />
          {{ $t("providers.ai_radio.effects.browse_add", [selected.size]) }}
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
import { useHosts } from "@/composables/ai-radio/useHosts";
import { errorMessage, type HostJingle } from "@/helpers/ai_radio";
import type { AIRadioJingleFolder } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import {
  CornerLeftUp,
  FileAudio,
  Folder,
  Play,
  Square,
  SquareCheck,
} from "@lucide/vue";
import { ref, watch } from "vue";
import { toast } from "vue-sonner";

const props = defineProps<{ open: boolean }>();

const emit = defineEmits<{
  "update:open": [open: boolean];
  add: [jingles: HostJingle[]];
}>();

const { browseJingles, inspectJingle, previewJingle } = useHosts();

const folder = ref<AIRadioJingleFolder | null>(null);
const selected = ref(new Set<string>());
const loading = ref(false);
const adding = ref(false);
// reopening the picker returns to the folder the last jingles came from
const lastPath = ref<string | undefined>(undefined);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    selected.value = new Set();
    void browse(lastPath.value);
  },
  { immediate: true },
);

async function browse(path?: string) {
  loading.value = true;
  try {
    folder.value = await browseJingles(path);
    lastPath.value = folder.value.path;
  } catch (error) {
    toast.error(errorMessage(error));
    // a remembered folder that is gone falls back to the media folder
    if (path) {
      lastPath.value = undefined;
      folder.value = await browseJingles().catch(() => null);
    }
  } finally {
    loading.value = false;
  }
}

function toggle(path: string) {
  const next = new Set(selected.value);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  selected.value = next;
}

function selectAll() {
  selected.value = new Set([
    ...selected.value,
    ...(folder.value?.files.map((file) => file.path) || []),
  ]);
}

/** Adds the picked files with the words their lyrics tags carry, in the listed order. */
async function add() {
  adding.value = true;
  try {
    const jingles: HostJingle[] = [];
    for (const source of selected.value) {
      const info = await inspectJingle(source).catch(() => null);
      jingles.push({ source, tags: [], text: info?.text || "" });
    }
    emit("add", jingles);
    emit("update:open", false);
  } finally {
    adding.value = false;
  }
}
</script>

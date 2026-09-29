import { useShows } from "@/composables/ai-radio/useShows";
import { errorMessage } from "@/helpers/ai_radio";
import { canUseQueueDj } from "@/helpers/ai_radio_access";
import api from "@/plugins/api";
import type {
  AIRadioHost,
  AIRadioJingleFolder,
  AIRadioJingleInfo,
  AIRadioSection,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";

export interface AIRadioTtsEngine {
  uid: string;
  name: string;
}

/** A bundled persona: a ready-made host plus the section content it references. */
export interface AIRadioHostPreset {
  host: AIRadioHost;
  sections: AIRadioSection[];
}

const hosts = ref<AIRadioHost[]>([]);
const ttsEngines = ref<AIRadioTtsEngine[]>([]);
const presets = ref<AIRadioHostPreset[]>([]);
// queue_id -> host_id, for queues that currently have a DJ host assigned.
const queueDjStatus = ref<Record<string, string>>({});

const loadingHosts = ref(false);
const loadingTtsEngines = ref(false);
const loadingPresets = ref(false);
const loadingQueueDjStatus = ref(false);
const savingHost = ref(false);
// Host id currently being deleted, so only that row reflects it.
const deletingHostId = ref("");

let queueDjStatePrefetched = false;

// Submenu only shown when the ai_radio provider is loaded.
const aiRadioAvailable = computed(() => store.enabledPlugins.has("ai_radio"));

// Prefetch as soon as the provider is there, including when it already is, for
// the roles that get the queue DJ menu.
watch(
  () => aiRadioAvailable.value && canUseQueueDj(),
  (ready) => {
    // Session-scoped sessions lack the config scopes this needs and never open the queue DJ menu.
    if (ready && authManager.guestSessionKind() === null)
      prefetchQueueDjState();
  },
  { immediate: true },
);

const sortByName = <T extends { name: string }>(items: T[]): T[] => {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
};

async function loadHosts(): Promise<AIRadioHost[]> {
  loadingHosts.value = true;
  try {
    const result = await api.sendCommand<AIRadioHost[]>("ai_radio/hosts/list");
    hosts.value = sortByName(result || []);
    return hosts.value;
  } finally {
    loadingHosts.value = false;
  }
}

async function getHost(hostId: string): Promise<AIRadioHost> {
  return api.sendCommand<AIRadioHost>("ai_radio/hosts/get", {
    host_id: hostId,
  });
}

/**
 * Persists a host's sections (call before saveHost) and refreshes the shared
 * sections cache so a later decompile doesn't read back stale content.
 */
async function saveSections(sections: AIRadioSection[]): Promise<void> {
  for (const section of sections) {
    await api.sendCommand("ai_radio/sections/save", { section });
  }
  await useShows().loadSections();
}

async function saveHost(host: AIRadioHost): Promise<AIRadioHost> {
  savingHost.value = true;
  try {
    const saved = await api.sendCommand<AIRadioHost>("ai_radio/hosts/save", {
      host,
    });
    toast.success($t("providers.ai_radio.toast.host_saved"));
    await loadHosts();
    return saved;
  } finally {
    savingHost.value = false;
  }
}

async function deleteHost(hostId: string): Promise<void> {
  deletingHostId.value = hostId;
  try {
    await api.sendCommand("ai_radio/hosts/delete", { host_id: hostId });
    toast.success($t("providers.ai_radio.toast.host_deleted"));
    await loadHosts();
  } finally {
    deletingHostId.value = "";
  }
}

/** Lists a folder of the media folder to pick jingles from; the media folder itself when omitted. */
async function browseJingles(path?: string): Promise<AIRadioJingleFolder> {
  return api.sendCommand<AIRadioJingleFolder>(
    "ai_radio/jingles/browse",
    path ? { path } : {},
  );
}

/**
 * Plays a jingle on the active player as an announcement, so it can be heard before it
 * is tagged. Tells the user when no player is active instead of failing silently.
 */
async function previewJingle(source: string): Promise<void> {
  const playerId = store.activePlayerId;
  if (!playerId) {
    toast.error($t("providers.ai_radio.effects.preview_no_player"));
    return;
  }
  try {
    await api.sendCommand("ai_radio/jingles/preview", {
      source,
      player_id: playerId,
    });
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

/**
 * Reads a jingle file's length, title and the words from its lyrics tag. With
 * `transcribe`, a file without lyrics is listened to by a speech-to-text engine.
 */
async function inspectJingle(
  source: string,
  options: { transcribe?: boolean; language?: string } = {},
): Promise<AIRadioJingleInfo> {
  return api.sendCommand<AIRadioJingleInfo>("ai_radio/jingles/inspect", {
    source,
    ...(options.transcribe ? { transcribe_speech: true } : {}),
    ...(options.language ? { language: options.language } : {}),
  });
}

async function loadHostTemplate(): Promise<AIRadioHost> {
  return api.sendCommand<AIRadioHost>("ai_radio/hosts/template");
}

async function loadTtsEngines(): Promise<AIRadioTtsEngine[]> {
  loadingTtsEngines.value = true;
  try {
    const result = await api.sendCommand<AIRadioTtsEngine[]>(
      "ai_radio/engines/tts/list",
    );
    ttsEngines.value = result || [];
    return ttsEngines.value;
  } finally {
    loadingTtsEngines.value = false;
  }
}

async function loadPresets(): Promise<AIRadioHostPreset[]> {
  loadingPresets.value = true;
  try {
    const result = await api.sendCommand<AIRadioHostPreset[]>(
      "ai_radio/hosts/presets/list",
    );
    presets.value = result || [];
    return presets.value;
  } finally {
    loadingPresets.value = false;
  }
}

/** Assigns (or, with hostId null, clears) the DJ host for a queue; returns the updated queue_id -> host_id map. */
async function setQueueDj(
  queueId: string,
  hostId: string | null,
): Promise<Record<string, string>> {
  const result = await api.sendCommand<Record<string, string>>(
    "ai_radio/queue_dj/set",
    { queue_id: queueId, host_id: hostId },
  );
  queueDjStatus.value = result || {};
  return queueDjStatus.value;
}

/**
 * Warms the AI DJ submenu's caches. It's handed to the eventbus as a plain
 * array, so without this the first open shows no hosts and a wrong "Off" check.
 */
function prefetchQueueDjState(): void {
  if (queueDjStatePrefetched) return;
  queueDjStatePrefetched = true;
  Promise.all([loadHosts(), loadQueueDjStatus()]).catch(() => {
    // Best effort: allow a later availability flip to try again.
    queueDjStatePrefetched = false;
  });
}

async function loadQueueDjStatus(): Promise<Record<string, string>> {
  loadingQueueDjStatus.value = true;
  try {
    const result = await api.sendCommand<Record<string, string>>(
      "ai_radio/queue_dj/status",
    );
    queueDjStatus.value = result || {};
    return queueDjStatus.value;
  } finally {
    loadingQueueDjStatus.value = false;
  }
}

export function useHosts() {
  return {
    hosts,
    ttsEngines,
    presets,
    queueDjStatus,
    aiRadioAvailable,
    loadingHosts,
    loadingTtsEngines,
    loadingPresets,
    loadingQueueDjStatus,
    savingHost,
    deletingHostId,
    loadHosts,
    getHost,
    saveSections,
    saveHost,
    deleteHost,
    loadHostTemplate,
    loadTtsEngines,
    loadPresets,
    setQueueDj,
    loadQueueDjStatus,
    inspectJingle,
    previewJingle,
    browseJingles,
  };
}

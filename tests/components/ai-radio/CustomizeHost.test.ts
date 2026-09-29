import CustomizeHost from "@/components/ai-radio/CustomizeHost.vue";
import { useHosts } from "@/composables/ai-radio/useHosts";
import { compileHost, GENERIC_SEGMENT_TEMPLATES } from "@/helpers/ai_radio";
import type { HostDraft } from "@/helpers/ai_radio";
import type { AIRadioHost } from "@/plugins/api/interfaces";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

type SendCommand = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

const { sendCommand } = vi.hoisted(() => ({
  sendCommand: vi.fn<SendCommand>(async () => []),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    // useHosts derives ai_radio availability from the provider list.
    providers: {},
    sendCommand,
  },
}));

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  onBeforeRouteLeave: vi.fn(),
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: { emit: vi.fn() },
}));

vi.mock("vue-sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

/** Mounts the editor in create mode (a new host seeded with one generic example segment per placement). */
async function mountEditor() {
  const wrapper = mount(CustomizeHost);
  await flushPromises();
  return wrapper;
}

function saveButton(wrapper: VueWrapper) {
  return wrapper
    .findAll("button")
    .find((candidate) => /^Save host|Saving/.test(candidate.text()));
}

async function save(wrapper: VueWrapper) {
  await saveButton(wrapper)?.trigger("click");
  await flushPromises();
}

const aiRadioCommands = () =>
  sendCommand.mock.calls
    .map(([command]) => command)
    .filter((command) => command.startsWith("ai_radio/"));

afterEach(() => {
  vi.clearAllMocks();
  sendCommand.mockImplementation(async () => []);
  useHosts().hosts.value = [];
});

describe("CustomizeHost save", () => {
  it("writes every section before the host that references them", async () => {
    const wrapper = await mountEditor();
    await wrapper.find("#customize-host-name").setValue("Morning Crew");

    await save(wrapper);

    const commands = aiRadioCommands();
    const lastSectionSave = commands.lastIndexOf("ai_radio/sections/save");
    expect(lastSectionSave).toBeGreaterThan(-1);
    expect(commands.indexOf("ai_radio/hosts/save")).toBeGreaterThan(
      lastSectionSave,
    );
  });

  it("writes nothing when the draft fails validation", async () => {
    const { toast } = await import("vue-sonner");
    // The name is empty on a fresh draft, and sections are written before the
    // host, so a save that can't succeed must not reach the server at all.
    const wrapper = await mountEditor();

    await save(wrapper);

    expect(aiRadioCommands()).not.toContain("ai_radio/sections/save");
    expect(aiRadioCommands()).not.toContain("ai_radio/hosts/save");
    expect(toast.error).toHaveBeenCalledWith("Host name is required");
  });

  it("refuses to create a host that would overwrite one with the same name", async () => {
    const { toast } = await import("vue-sonner");
    const existing: AIRadioHost = {
      id: "morning_crew",
      name: "Morning Crew",
      instructions: "",
      tts_engine: "",
      language: "",
      options: {},
      section_ids: [],
      section_order: [],
      merge_section_id: "",
    };
    sendCommand.mockImplementation(async (command) =>
      command === "ai_radio/hosts/list" ? [existing] : [],
    );
    const wrapper = await mountEditor();
    await wrapper.find("#customize-host-name").setValue("Morning Crew");

    await save(wrapper);

    expect(aiRadioCommands()).not.toContain("ai_radio/hosts/save");
    expect(toast.error).toHaveBeenCalledWith(
      "A host named «Morning Crew» already exists",
    );
  });

  it("refuses to save a new host when the uniqueness check can't be verified", async () => {
    const { toast } = await import("vue-sonner");
    sendCommand.mockImplementation(async (command) => {
      if (command === "ai_radio/hosts/list") {
        throw new Error("network down");
      }
      return [];
    });
    const wrapper = await mountEditor();
    await wrapper.find("#customize-host-name").setValue("Morning Crew");

    await save(wrapper);

    expect(aiRadioCommands()).not.toContain("ai_radio/hosts/save");
    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't verify the name is unique. Nothing was saved",
    );
    // The button must recover to a clickable, non-stuck state.
    expect(saveButton(wrapper)?.text()).toBe("Save host");
    expect(saveButton(wrapper)?.attributes("disabled")).toBeUndefined();
  });

  it("still refuses a colliding name once the pre-save refresh reveals it", async () => {
    const { toast } = await import("vue-sonner");
    const existing: AIRadioHost = {
      id: "morning_crew",
      name: "Morning Crew",
      instructions: "",
      tts_engine: "",
      language: "",
      options: {},
      section_ids: [],
      section_order: [],
      merge_section_id: "",
    };
    // Create mode no longer preloads hosts at mount, so this collision can
    // only be caught by the pre-save refresh itself.
    sendCommand.mockImplementation(async (command) =>
      command === "ai_radio/hosts/list" ? [existing] : [],
    );
    const wrapper = await mountEditor();
    await wrapper.find("#customize-host-name").setValue("Morning Crew");

    await save(wrapper);

    expect(aiRadioCommands()).not.toContain("ai_radio/hosts/save");
    expect(toast.error).toHaveBeenCalledWith(
      "A host named «Morning Crew» already exists",
    );
  });

  it("saves an edited host without requiring an extra hosts refresh", async () => {
    const { toast } = await import("vue-sonner");
    const draft: HostDraft = {
      id: "rick",
      name: "Rick",
      instructions: "Persona.",
      ttsEngine: "",
      language: "",
      options: {},
      segments: GENERIC_SEGMENT_TEMPLATES.slice(0, 1).map((s) => ({ ...s })),
    };
    const { host, sections } = compileHost(draft);
    sendCommand.mockImplementation(async (command) => {
      if (command === "ai_radio/hosts/get") return host;
      if (command === "ai_radio/sections/list") return sections;
      return [];
    });
    const wrapper = mount(CustomizeHost, { props: { hostId: host.id } });
    await flushPromises();

    await save(wrapper);

    const commands = aiRadioCommands();
    expect(commands).toContain("ai_radio/hosts/save");
    // Any hosts/list call in edit mode can only be saveHost's post-save
    // refresh, never a pre-save uniqueness check (edit keeps its own id).
    const listIndex = commands.indexOf("ai_radio/hosts/list");
    const saveIndex = commands.indexOf("ai_radio/hosts/save");
    if (listIndex !== -1) {
      expect(listIndex).toBeGreaterThan(saveIndex);
    }
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("CustomizeHost effects", () => {
  const savedHost = () =>
    sendCommand.mock.calls.find(
      ([command]) => command === "ai_radio/hosts/save",
    )?.[1]?.host as AIRadioHost | undefined;

  it("saves a jingle with its tags and words, the chance and the bed", async () => {
    const wrapper = await mountEditor();
    await wrapper.find("#customize-host-name").setValue("Mika");
    const addJingle = wrapper
      .findAll("button")
      .find((button) => button.text() === "Add jingle");
    await addJingle?.trigger("click");
    await wrapper
      .find('input[aria-label="Jingle file or URL"]')
      .setValue("/media/ai_radio/untergrund.mp3");
    const newsTag = wrapper
      .findAll("button")
      .find((button) => button.text() === "News");
    await newsTag?.trigger("click");
    await wrapper
      .find('textarea[aria-label="What the jingle says"]')
      .setValue("Neues aus dem Untergrund.");
    await wrapper.find("#customize-host-jingle-chance").setValue("35");
    await wrapper.find("#customize-host-music-bed").setValue("/media/bed.mp3");

    await save(wrapper);

    expect(savedHost()?.effects).toEqual({
      jingles: [
        {
          source: "/media/ai_radio/untergrund.mp3",
          tags: ["news"],
          text: "Neues aus dem Untergrund.",
        },
      ],
      jingle_chance: 35,
      jingle_selection: "ai",
      jingle_after_gap_minutes: 30,
      music_bed: "/media/bed.mp3",
      music_bed_level: -18,
      lead_in: "cut",
      lead_in_seconds: 3,
      post_gap_seconds: 0.4,
      post_max_seconds: 0,
      post_duck_percent: 60,
    });
  });

  it("only offers the bed level once a bed is set", async () => {
    const wrapper = await mountEditor();

    expect(wrapper.find("#customize-host-music-bed-level").exists()).toBe(
      false,
    );
    await wrapper.find("#customize-host-music-bed").setValue("/media/bed.mp3");

    expect(wrapper.find("#customize-host-music-bed-level").exists()).toBe(true);
  });

  it("shows an edited host's jingles for editing", async () => {
    const draft: HostDraft = {
      id: "mika",
      name: "Mika",
      instructions: "Persona.",
      ttsEngine: "",
      language: "",
      options: {},
      segments: GENERIC_SEGMENT_TEMPLATES.slice(0, 1).map((s) => ({ ...s })),
      effects: {
        jingles: [
          {
            source: "/media/ai_radio/floskeln.mp3",
            tags: ["general", "indie"],
            text: "Keine Floskeln.",
          },
        ],
        jingleChance: 20,
        jingleSelection: "ai",
        jingleAfterGapMinutes: 30,
        musicBed: "",
        musicBedLevel: -18,
        leadIn: "talk_up",
        leadInSeconds: 4,
        postGapSeconds: 1.5,
        postMaxSeconds: 0,
        postDuckPercent: 60,
      },
    };
    const { host, sections } = compileHost(draft);
    sendCommand.mockImplementation(async (command) => {
      if (command === "ai_radio/hosts/get") return host;
      if (command === "ai_radio/sections/list") return sections;
      return [];
    });

    const wrapper = mount(CustomizeHost, { props: { hostId: host.id } });
    await flushPromises();

    expect(
      (
        wrapper.find('input[aria-label="Jingle file or URL"]')
          .element as HTMLInputElement
      ).value,
    ).toBe("/media/ai_radio/floskeln.mp3");
    expect(wrapper.find('button[aria-label="Remove tag indie"]').exists()).toBe(
      true,
    );
    const leadInSeconds = wrapper.find("#customize-host-lead-in-seconds");
    expect((leadInSeconds.element as HTMLInputElement).value).toBe("4");
    const postGap = wrapper.find("#customize-host-post-gap");
    expect((postGap.element as HTMLInputElement).value).toBe("1.5");
  });

  it("hides the transition length while the song cuts into the break", async () => {
    const wrapper = await mountEditor();

    expect(wrapper.find("#customize-host-lead-in-seconds").exists()).toBe(
      false,
    );
  });
});

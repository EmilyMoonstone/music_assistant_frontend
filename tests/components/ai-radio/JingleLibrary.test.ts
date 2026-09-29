import JingleBrowserDialog from "@/components/ai-radio/JingleBrowserDialog.vue";
import JingleLibrary from "@/components/ai-radio/JingleLibrary.vue";
import type { HostJingle } from "@/helpers/ai_radio";
import { store } from "@/plugins/store";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

type SendCommand = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

const { sendCommand } = vi.hoisted(() => ({
  sendCommand: vi.fn<SendCommand>(async () => []),
}));

vi.mock("@/plugins/api", () => ({
  default: { providers: {}, sendCommand },
}));

vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
  sendCommand.mockImplementation(async () => []);
});

function mountLibrary(jingles: HostJingle[], language?: string) {
  return mount(JingleLibrary, {
    props: {
      language,
      modelValue: jingles,
      "onUpdate:modelValue": (value: HostJingle[]) => {
        jingles.splice(0, jingles.length, ...value);
      },
    },
  });
}

const button = (wrapper: ReturnType<typeof mountLibrary>, text: string) =>
  wrapper.findAll("button").find((candidate) => candidate.text() === text);

describe("JingleLibrary", () => {
  it("toggles preset tags and adds a free tag in the stored form", async () => {
    const jingles: HostJingle[] = [
      { source: "/media/a.mp3", tags: [], text: "" },
    ];
    const wrapper = mountLibrary(jingles);

    await button(wrapper, "Late night")?.trigger("click");
    const tagInput = wrapper.find('input[aria-label="Add tag, e.g. indie"]');
    await tagInput.setValue("Indie Rock");
    await tagInput.trigger("keydown.enter");
    await button(wrapper, "Late night")?.trigger("click");

    expect(jingles[0].tags).toEqual(["indie_rock"]);
  });

  it("fills in the words the file carries", async () => {
    sendCommand.mockImplementation(async (command) =>
      command === "ai_radio/jingles/inspect"
        ? { duration: 9.3, title: "Keine Floskeln", text: "Keine Floskeln." }
        : [],
    );
    const jingles: HostJingle[] = [
      { source: "/media/floskeln.mp3", tags: [], text: "" },
    ];
    const wrapper = mountLibrary(jingles);

    await button(wrapper, "Read from file")?.trigger("click");
    await flushPromises();

    expect(sendCommand).toHaveBeenCalledWith("ai_radio/jingles/inspect", {
      source: "/media/floskeln.mp3",
      transcribe_speech: true,
    });
    expect(jingles[0].text).toBe("Keine Floskeln.");
  });

  it("listens in the host's language and says the words were heard", async () => {
    const { toast } = await import("vue-sonner");
    sendCommand.mockImplementation(async () => ({
      duration: 6,
      title: "",
      text: "Das Radio für Musikentdecker",
      text_source: "speech",
    }));
    const jingles: HostJingle[] = [
      { source: "/media/id.mp3", tags: [], text: "" },
    ];
    const wrapper = mountLibrary(jingles, "de-DE");

    await button(wrapper, "Read from file")?.trigger("click");
    await flushPromises();

    expect(sendCommand).toHaveBeenCalledWith("ai_radio/jingles/inspect", {
      source: "/media/id.mp3",
      transcribe_speech: true,
      language: "de-DE",
    });
    expect(jingles[0].text).toBe("Das Radio für Musikentdecker");
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining("recognised by listening"),
    );
  });

  it("keeps typed words when the file carries none", async () => {
    const { toast } = await import("vue-sonner");
    sendCommand.mockImplementation(async () => ({
      duration: 8,
      title: "",
      text: "",
    }));
    const jingles: HostJingle[] = [
      { source: "/media/calm.mp3", tags: [], text: "Mika hier." },
    ];
    const wrapper = mountLibrary(jingles);

    await button(wrapper, "Read from file")?.trigger("click");
    await flushPromises();

    expect(jingles[0].text).toBe("Mika hier.");
    expect(toast.info).toHaveBeenCalled();
  });

  it("adds the tags the AI hears and keeps typed words", async () => {
    const { toast } = await import("vue-sonner");
    sendCommand.mockImplementation(async () => ({
      tags: ["news", "Indie Pop", "calm"],
      text: "Neues aus dem Untergrund.",
      style: "Ruhiger Indie-Pop.",
    }));
    const jingles: HostJingle[] = [
      { source: "/media/news.mp3", tags: ["news"], text: "Getippt." },
    ];
    const wrapper = mountLibrary(jingles, "de-DE");

    await button(wrapper, "Analyze style")?.trigger("click");
    await flushPromises();

    expect(sendCommand).toHaveBeenCalledWith("ai_radio/jingles/analyze", {
      source: "/media/news.mp3",
      language: "de-DE",
    });
    expect(jingles[0].tags).toEqual(["news", "indie_pop", "calm"]);
    expect(jingles[0].text).toBe("Getippt.");
    expect(toast.success).toHaveBeenCalledWith(
      "Tags added: indie_pop, calm. Ruhiger Indie-Pop.",
    );
  });

  it("only offers the analysis for files in the media folder", () => {
    const wrapper = mountLibrary([
      { source: "builtin", tags: [], text: "" },
      { source: "https://example.test/j.mp3", tags: [], text: "" },
    ]);

    const analyze = wrapper
      .findAll("button")
      .filter((candidate) => candidate.text() === "Analyze style");
    expect(analyze.map((b) => b.attributes("disabled"))).toEqual(["", ""]);
  });

  it("adds, sets to the gong and removes jingles", async () => {
    const jingles: HostJingle[] = [];
    const wrapper = mountLibrary(jingles);

    await button(wrapper, "Add jingle")?.trigger("click");
    await button(wrapper, "Built-in gong")?.trigger("click");
    expect(jingles).toEqual([{ source: "builtin", tags: [], text: "" }]);

    await wrapper.find('button[aria-label="Remove jingle"]').trigger("click");
    expect(jingles).toEqual([]);
  });

  it("adds jingles picked from the media folder, skipping ones it already has", async () => {
    const jingles: HostJingle[] = [
      { source: "/media/a.mp3", tags: ["news"], text: "Kept." },
    ];
    sendCommand.mockImplementation(async () => ({
      path: "/media",
      parent: null,
      folders: [],
      files: [],
    }));
    const wrapper = mountLibrary(jingles);

    await button(wrapper, "Pick from media folder")?.trigger("click");
    const dialog = wrapper.findComponent(JingleBrowserDialog);
    expect(dialog.props("open")).toBe(true);
    dialog.vm.$emit("add", [
      { source: "/media/a.mp3", tags: [], text: "" },
      { source: "/media/b.mp3", tags: [], text: "New." },
    ]);
    await flushPromises();

    expect(jingles).toEqual([
      { source: "/media/a.mp3", tags: ["news"], text: "Kept." },
      { source: "/media/b.mp3", tags: [], text: "New." },
    ]);
  });

  it("plays a jingle on the active player", async () => {
    store.activePlayerId = "kitchen";
    const wrapper = mountLibrary([
      { source: "/media/a.mp3", tags: [], text: "" },
    ]);

    await wrapper
      .find('button[aria-label="Play on the active player"]')
      .trigger("click");
    await flushPromises();

    expect(sendCommand).toHaveBeenCalledWith("ai_radio/jingles/preview", {
      source: "/media/a.mp3",
      player_id: "kitchen",
    });
  });

  it("asks for a player instead of previewing into the void", async () => {
    const { toast } = await import("vue-sonner");
    store.activePlayerId = undefined;
    const wrapper = mountLibrary([
      { source: "/media/a.mp3", tags: [], text: "" },
    ]);

    await wrapper
      .find('button[aria-label="Play on the active player"]')
      .trigger("click");
    await flushPromises();

    expect(sendCommand).not.toHaveBeenCalledWith(
      "ai_radio/jingles/preview",
      expect.anything(),
    );
    expect(toast.error).toHaveBeenCalled();
  });
});

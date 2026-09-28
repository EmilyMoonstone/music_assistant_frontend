import JingleBrowserDialog from "@/components/ai-radio/JingleBrowserDialog.vue";
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

const MEDIA = {
  path: "/media",
  parent: null,
  folders: [{ name: "ai_radio", path: "/media/ai_radio" }],
  files: [],
};
const JINGLES = {
  path: "/media/ai_radio",
  parent: "/media",
  folders: [],
  files: [
    { name: "Keine Floskeln.mp3", path: "/media/ai_radio/Keine Floskeln.mp3" },
    { name: "calm.mp3", path: "/media/ai_radio/calm.mp3" },
  ],
};

function answer(command: string, args?: Record<string, unknown>) {
  if (command === "ai_radio/jingles/browse") {
    return args?.path === "/media/ai_radio" ? JINGLES : MEDIA;
  }
  if (command === "ai_radio/jingles/inspect") {
    return {
      duration: 9,
      title: "",
      text: String(args?.source).includes("Floskeln") ? "Keine Floskeln." : "",
    };
  }
  return [];
}

async function mountOpen() {
  sendCommand.mockImplementation(async (command, args) =>
    answer(command, args),
  );
  const wrapper = mount(JingleBrowserDialog, {
    props: { open: true },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

// the dialog renders into a portal on the body, outside the wrapper
async function click(text: string) {
  const target = [...document.body.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.includes(text),
  );
  expect(target, `button "${text}"`).toBeDefined();
  target!.click();
  await flushPromises();
}

let mounted: Awaited<ReturnType<typeof mountOpen>> | undefined;

afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  vi.clearAllMocks();
});

describe("JingleBrowserDialog", () => {
  it("opens at the media folder and walks into a folder", async () => {
    const wrapper = (mounted = await mountOpen());

    expect(sendCommand).toHaveBeenCalledWith("ai_radio/jingles/browse", {});
    await click("ai_radio");

    expect(sendCommand).toHaveBeenCalledWith("ai_radio/jingles/browse", {
      path: "/media/ai_radio",
    });
    expect(
      document.body.querySelector('[data-testid="jingle-browser-path"]')
        ?.textContent,
    ).toContain("/media/ai_radio");
    await click("Up one folder");
    expect(sendCommand).toHaveBeenLastCalledWith("ai_radio/jingles/browse", {
      path: "/media",
    });
  });

  it("adds the picked files with the words their tags carry", async () => {
    const wrapper = (mounted = await mountOpen());
    await click("ai_radio");

    await click("Select all in this folder");
    await click("Add selected (2)");

    expect(wrapper.emitted("add")).toEqual([
      [
        [
          {
            source: "/media/ai_radio/Keine Floskeln.mp3",
            tags: [],
            text: "Keine Floskeln.",
          },
          { source: "/media/ai_radio/calm.mp3", tags: [], text: "" },
        ],
      ],
    ]);
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("adds a single file picked by hand", async () => {
    const wrapper = (mounted = await mountOpen());
    await click("ai_radio");

    await click("calm.mp3");
    await click("Add selected (1)");

    expect(wrapper.emitted("add")?.[0][0]).toEqual([
      { source: "/media/ai_radio/calm.mp3", tags: [], text: "" },
    ]);
  });

  it("plays a listed file on the active player without selecting it", async () => {
    store.activePlayerId = "kitchen";
    const wrapper = (mounted = await mountOpen());
    await click("ai_radio");

    const play = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Play calm.mp3 on the active player"]',
    );
    play!.click();
    await flushPromises();

    expect(sendCommand).toHaveBeenCalledWith("ai_radio/jingles/preview", {
      source: "/media/ai_radio/calm.mp3",
      player_id: "kitchen",
    });
    expect(wrapper.emitted("add")).toBeUndefined();
    expect(
      [...document.body.querySelectorAll("button")].some((button) =>
        button.textContent?.includes("Add selected (0)"),
      ),
    ).toBe(true);
  });
});

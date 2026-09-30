import SegmentRow from "@/components/ai-radio/SegmentRow.vue";
import { Select } from "@/components/ui/select";
import type { ShowSegment } from "@/helpers/ai_radio";
import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiStub = vi.hoisted(() => ({ supportsAIRadioAllowPost: true }));

vi.mock("@/plugins/api", () => ({ api: apiStub, default: apiStub }));

vi.mock("vue-sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const PLACEHOLDER_TOKENS = [
  "<prev_songinfo>",
  "<next_songinfo>",
  "<very_next_songinfo>",
  "<timestamp>",
  "<weather_hourly>",
  "<weather_daily>",
  "<recent_breaks>",
  "<recent_news>",
];

const segment: ShowSegment = {
  id: "intro",
  name: "Intro",
  prompt: "Say hello, <next_songinfo>.",
  webSearch: "disabled",
  allowPost: false,
  maxChars: 500,
  plays: { kind: "start" },
};

async function mountExpanded() {
  const wrapper = mount(SegmentRow, {
    props: { segment, canMoveUp: false, canMoveDown: false },
  });
  await wrapper.get('button[aria-label="Show more"]').trigger("click");
  return wrapper;
}

function placeholderChip(wrapper: VueWrapper, token: string) {
  return wrapper
    .findAll("button")
    .find((button) => button.attributes("aria-label") === `Insert ${token}`);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("SegmentRow placeholder chips", () => {
  it("renders one chip per placeholder, named for what it stands for", async () => {
    const wrapper = await mountExpanded();

    for (const token of PLACEHOLDER_TOKENS) {
      expect(placeholderChip(wrapper, token)?.exists()).toBe(true);
    }
    expect(placeholderChip(wrapper, "<prev_songinfo>")?.text()).toBe(
      "Previous song",
    );
  });

  it("inserts the placeholder into the prompt at the cursor", async () => {
    const wrapper = await mountExpanded();
    const textarea = wrapper.get("textarea").element as HTMLTextAreaElement;
    textarea.setSelectionRange(4, 4);

    await placeholderChip(wrapper, "<timestamp>")?.trigger("click");

    expect(wrapper.emitted("update")?.[0]).toEqual([
      { ...segment, prompt: "Say <timestamp>hello, <next_songinfo>." },
    ]);
  });

  it("keeps a placeholder apart from the word before it", async () => {
    const wrapper = await mountExpanded();
    const textarea = wrapper.get("textarea").element as HTMLTextAreaElement;
    textarea.setSelectionRange(segment.prompt.length, segment.prompt.length);

    await placeholderChip(wrapper, "<timestamp>")?.trigger("click");

    expect(wrapper.emitted("update")?.[0]).toEqual([
      { ...segment, prompt: "Say hello, <next_songinfo>. <timestamp>" },
    ]);
  });

  it("lets a segment ask for a closing jingle every time", async () => {
    const wrapper = await mountExpanded();
    // plays, web search, jingle at the start, jingle at the end
    const after = wrapper.findAllComponents(Select)[3];

    expect(wrapper.text()).toContain("Jingle at the end");
    after.vm.$emit("update:modelValue", "always");
    after.vm.$emit("update:modelValue", "sometimes");

    expect(wrapper.emitted("update")).toEqual([
      [{ ...segment, jingleAfter: "always" }],
    ]);
  });

  it("explains only the jingle mode that is chosen", async () => {
    const wrapper = mount(SegmentRow, {
      props: {
        segment: { ...segment, jingleBefore: "no_post" },
        canMoveUp: false,
        canMoveDown: false,
      },
    });
    await wrapper.get('button[aria-label="Show more"]').trigger("click");

    expect(wrapper.text()).toContain(
      "unless the break starts over the outro of the song before it",
    );
    expect(wrapper.text()).not.toContain("This segment never opens");
  });
});

describe("SegmentRow folded row", () => {
  it("names what the segment does while folded", () => {
    const wrapper = mount(SegmentRow, {
      props: {
        segment: {
          ...segment,
          allowPost: true,
          jingleAfter: "no_post",
          webSearch: "force",
        },
        canMoveUp: false,
        canMoveDown: false,
      },
    });

    const badges = wrapper.get('[data-testid="segment-badges"]').text();
    expect(badges).toContain("Talks over intro");
    expect(badges).toContain("End: Only when no post fits");
    expect(badges).toContain("Web always");
  });

  it("asks for a rehearsal", async () => {
    const wrapper = mount(SegmentRow, {
      props: { segment, canMoveUp: false, canMoveDown: false },
    });

    await wrapper.get('[data-testid="segment-probe"]').trigger("click");

    expect(wrapper.emitted("probe")).toHaveLength(1);
  });

  it("opens up and says what is missing when it stopped a save", () => {
    const wrapper = mount(SegmentRow, {
      props: {
        segment: { ...segment, prompt: "" },
        canMoveUp: false,
        canMoveDown: false,
        invalid: true,
      },
    });

    expect(wrapper.find("textarea").exists()).toBe(true);
    expect(wrapper.find(".text-destructive").exists()).toBe(true);
  });
});

describe("SegmentRow talk-over switches", () => {
  it("stay out of the collapsed row and appear once expanded", async () => {
    const wrapper = mount(SegmentRow, {
      props: { segment, canMoveUp: false, canMoveDown: false },
    });

    expect(wrapper.find('[role="switch"]').exists()).toBe(false);

    await wrapper.get('button[aria-label="Show more"]').trigger("click");

    expect(wrapper.findAll('[role="switch"]')).toHaveLength(2);
  });

  it("stay hidden on a server that does not keep the options", async () => {
    apiStub.supportsAIRadioAllowPost = false;
    try {
      const wrapper = await mountExpanded();
      expect(wrapper.find('[role="switch"]').exists()).toBe(false);
    } finally {
      apiStub.supportsAIRadioAllowPost = true;
    }
  });

  it("emit the segment with the outro and the intro switch set", async () => {
    const wrapper = await mountExpanded();
    const [outro, intro] = wrapper.findAll('[role="switch"]');

    await outro.trigger("click");
    await intro.trigger("click");

    expect(wrapper.emitted("update")).toEqual([
      [{ ...segment, allowTalkOver: true }],
      [{ ...segment, allowPost: true }],
    ]);
  });
});

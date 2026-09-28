import ShowWishDialog from "@/components/ai-radio/ShowWishDialog.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("ShowWishDialog", () => {
  it("hands over the trimmed wish and closes", async () => {
    const wrapper = mount(ShowWishDialog, {
      props: { open: true, showName: "Musikentdecker" },
      attachTo: document.body,
    });
    await flushPromises();
    const input = document.querySelector<HTMLInputElement>(
      "#ai-radio-show-wish",
    );
    expect(input).not.toBeNull();
    input!.value = "  calm, we are cooking  ";
    input!.dispatchEvent(new Event("input"));
    // the input hands its value up a tick later, as it does between typing and Enter
    await flushPromises();
    input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await flushPromises();

    expect(wrapper.emitted("start")).toEqual([["calm, we are cooking"]]);
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
    wrapper.unmount();
  });
});

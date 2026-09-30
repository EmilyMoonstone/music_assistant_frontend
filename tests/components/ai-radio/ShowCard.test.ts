import ShowCard from "@/components/ai-radio/ShowCard.vue";
import ShowWishDialog from "@/components/ai-radio/ShowWishDialog.vue";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useShows } from "@/composables/ai-radio/useShows";
import type { MusicAssistantApi } from "@/plugins/api";
import { i18n } from "@/plugins/i18n";
import type {
  AIRadioSession,
  AIRadioStation,
  Scope,
} from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../../fixtures/scopes";

const { hasScope } = vi.hoisted(() => ({
  hasScope: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/auth", () => ({
  authManager: { guestSessionKind: () => null, hasScope },
}));

vi.mock("@/plugins/api", () => ({
  default: {
    players: {},
    providers: {},
    sendCommand: vi.fn(async () => []),
    getLibraryPlaylists: vi.fn<MusicAssistantApi["getLibraryPlaylists"]>(
      async () => [],
    ),
  },
}));

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const show = {
  id: "party_host_pirates",
  name: "Party host — Pirates",
  source_playlist_id: "42",
  source_playlist_provider: "library",
} as AIRadioStation;

const session = (status: string): AIRadioSession =>
  ({
    session_id: "s1",
    station_id: show.id,
    mode: "dynamic",
    status,
    created_at: "2026-07-29T11:00:00Z",
    ended_at: status === "running" ? null : "2026-07-29T11:30:00Z",
  }) as unknown as AIRadioSession;

const renderCard = (locale: string, sessionStatus: string) => {
  const previous = i18n.global.locale.value;
  i18n.global.locale.value = locale;
  useShows().sessions.value = [session(sessionStatus)];
  try {
    return mount(ShowCard, { props: { show }, shallow: true });
  } finally {
    i18n.global.locale.value = previous;
  }
};

afterEach(() => {
  useShows().sessions.value = [];
});

describe("ShowCard status chip", () => {
  it("renders the last-on-air chip for a stopped show under an underscored locale", () => {
    const wrapper = renderCard("en_GB", "stopped");

    expect(wrapper.find(".show-card__status-chip").exists()).toBe(true);
    expect(wrapper.text()).toContain("Last on air");
  });

  it("renders the chip under a hyphenated locale", () => {
    const wrapper = renderCard("en-GB", "stopped");

    expect(wrapper.text()).toContain("Last on air");
  });

  it("renders no relative-time chip while the show is on air", () => {
    const wrapper = renderCard("en_GB", "running");

    expect(wrapper.find(".show-card__status-chip").exists()).toBe(false);
  });
});

describe("ShowCard editing rights", () => {
  // the stubs render their slots, so the menu entries show up as well
  const mountCard = () =>
    mount(ShowCard, {
      props: { show },
      shallow: true,
      global: { renderStubDefaultSlot: true },
    });

  it("lets an admin customize, look back on, duplicate and delete the show", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
    const wrapper = mountCard();

    const items = wrapper.findAllComponents(DropdownMenuItem);
    expect(items).toHaveLength(4);
    await items[0].trigger("click");
    expect(wrapper.emitted("customize")).toEqual([[show.id]]);
  });

  it("plays the show when the card is clicked, for anyone", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
    const api = (await import("@/plugins/api")).default;
    const wrapper = mount(ShowCard, {
      props: { show: { ...show, default_player_id: "kitchen" } },
      shallow: true,
    });

    expect(wrapper.attributes("role")).toBe("button");
    await wrapper.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("customize")).toBeUndefined();
    expect(
      vi
        .mocked(api.sendCommand)
        .mock.calls.some(([command]) => command === "ai_radio/start"),
    ).toBe(true);
    vi.mocked(api.sendCommand).mockClear();
  });

  it.each([
    ["a member", BUILTIN_ROLE_SCOPES.user],
    ["a guest", BUILTIN_ROLE_SCOPES.guest],
  ])("leaves %s the play button and the log", async (_role, scopes) => {
    hasScope.mockImplementation(scopeChecker(scopes));
    const wrapper = mountCard();

    expect(wrapper.findAllComponents(DropdownMenuItem)).toHaveLength(1);
    expect(wrapper.text()).toContain("Break log");
    expect(wrapper.find('[aria-label="Play"]').exists()).toBe(true);
  });
});

describe("ShowCard wish for an AI running order", () => {
  const startCalls = async () => {
    const api = (await import("@/plugins/api")).default;
    return vi
      .mocked(api.sendCommand)
      .mock.calls.filter(([command]) => command === "ai_radio/start");
  };

  const mountPlayable = (station: AIRadioStation) => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
    return mount(ShowCard, { props: { show: station }, shallow: true });
  };

  afterEach(async () => {
    const api = (await import("@/plugins/api")).default;
    vi.mocked(api.sendCommand).mockClear();
  });

  it("asks for a wish before an AI-ordered show starts, and sends it along", async () => {
    const wrapper = mountPlayable({
      ...show,
      default_player_id: "kitchen",
      track_order: "ai",
    });

    await wrapper.find('[aria-label="Play"]').trigger("click");
    await flushPromises();

    const dialog = wrapper.findComponent(ShowWishDialog);
    expect(dialog.props("open")).toBe(true);
    expect(await startCalls()).toHaveLength(0);

    dialog.vm.$emit("start", "calm, we are cooking");
    await flushPromises();

    expect(await startCalls()).toEqual([
      [
        "ai_radio/start",
        {
          station_id: show.id,
          player_id_override: "kitchen",
          listener_wish: "calm, we are cooking",
        },
      ],
    ]);
  });

  it("starts any other show right away, without a wish", async () => {
    const wrapper = mountPlayable({ ...show, default_player_id: "kitchen" });

    await wrapper.find('[aria-label="Play"]').trigger("click");
    await flushPromises();

    expect(wrapper.findComponent(ShowWishDialog).props("open")).toBe(false);
    expect(await startCalls()).toEqual([
      [
        "ai_radio/start",
        { station_id: show.id, player_id_override: "kitchen" },
      ],
    ]);
  });
});

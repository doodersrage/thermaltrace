import { describe, expect, it } from "vitest";
import { buildOverviewBannerQueue, partitionOverviewBanners } from "./overviewBanners";

const base = {
  lowBattery: false,
  stale: false,
  quietActive: false,
  prioritizeFirstRun: false,
  showTestAlertNudge: false,
  showAlertSetupNudge: false,
  showYoureLive: false,
  showFreezeMapOptInNudge: false,
  showStoryCard: false,
  showMultiPropertyNudge: false,
  upgradeTarget: null as string | null,
};

describe("overviewBanners", () => {
  it("keeps only critical banners as primary", () => {
    const partitioned = partitionOverviewBanners(
      buildOverviewBannerQueue({ ...base, lowBattery: true, showStoryCard: true }),
    );
    expect([...partitioned.primaryBannerIds]).toEqual(["lowBattery"]);
    expect(partitioned.secondaryTipBannerIds).toContain("story");
  });

  it("suppresses non-critical banners while quiet", () => {
    const queue = buildOverviewBannerQueue({
      ...base,
      quietActive: true,
      stale: true,
      showYoureLive: true,
      upgradeTarget: "member",
    });
    const partitioned = partitionOverviewBanners(queue);
    expect([...partitioned.primaryBannerIds]).toEqual(["stale"]);
    expect(partitioned.secondaryTipBannerIds).not.toContain("youreLive");
    expect(partitioned.secondaryTipBannerIds).not.toContain("upgrade");
  });

  it("does not count cold-snap as an Attention strip item", () => {
    const queue = buildOverviewBannerQueue(base);
    expect(queue.map((b) => b.id)).not.toContain("coldSnap");
    expect(partitionOverviewBanners(queue).secondaryOpsBannerIds).not.toContain("coldSnap");
  });
});

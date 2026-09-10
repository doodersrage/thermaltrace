import { isCriticalOverviewBanner, isOpsAttentionBanner } from "./dashboardComfort";

export type OverviewBanner = { id: string; priority: number; show: boolean };

export type OverviewBannerFlags = {
  lowBattery: boolean;
  stale: boolean;
  quietActive: boolean;
  showColdSnapChecklist: boolean;
  prioritizeFirstRun: boolean;
  showTestAlertNudge: boolean;
  showAlertSetupNudge: boolean;
  showYoureLive: boolean;
  showFreezeMapOptInNudge: boolean;
  showStoryCard: boolean;
  showMultiPropertyNudge: boolean;
  upgradeTarget: "member" | "pro" | string | null;
};

export function buildOverviewBannerQueue(flags: OverviewBannerFlags): OverviewBanner[] {
  return [
    { id: "lowBattery", priority: 2, show: flags.lowBattery },
    { id: "stale", priority: 3, show: flags.stale },
    {
      id: "coldSnap",
      priority: 4,
      show: !flags.quietActive && flags.showColdSnapChecklist && !flags.prioritizeFirstRun,
    },
    { id: "testAlert", priority: 5, show: !flags.quietActive && flags.showTestAlertNudge },
    { id: "alertSetup", priority: 6, show: !flags.quietActive && flags.showAlertSetupNudge },
    { id: "youreLive", priority: 7, show: !flags.quietActive && flags.showYoureLive },
    { id: "freezeMap", priority: 8, show: !flags.quietActive && flags.showFreezeMapOptInNudge },
    {
      id: "story",
      priority: 9,
      show: !flags.quietActive && flags.showStoryCard && !flags.prioritizeFirstRun,
    },
    {
      id: "multiProperty",
      priority: 10,
      show: !flags.quietActive && flags.showMultiPropertyNudge,
    },
    {
      id: "freezeReadiness",
      priority: flags.prioritizeFirstRun ? 18 : 11,
      show: !flags.quietActive && !flags.prioritizeFirstRun,
    },
    {
      id: "upgrade",
      priority: 20,
      show:
        !flags.quietActive &&
        (flags.upgradeTarget === "member" || flags.upgradeTarget === "pro"),
    },
  ];
}

export function partitionOverviewBanners(queue: OverviewBanner[]) {
  const active = queue.filter((banner) => banner.show).sort((a, b) => a.priority - b.priority);
  const critical = active.filter((b) => isCriticalOverviewBanner(b.id));
  const primaryBannerIds = new Set(critical.map((b) => b.id));
  const secondaryBannerIds = new Set(
    active.filter((b) => !primaryBannerIds.has(b.id)).map((banner) => banner.id),
  );
  const secondaryOpsBannerIds = [...secondaryBannerIds].filter((id) => isOpsAttentionBanner(id));
  const secondaryTipBannerIds = [...secondaryBannerIds].filter((id) => !isOpsAttentionBanner(id));
  return {
    activeOverviewBanners: active,
    criticalBanners: critical,
    primaryBannerIds,
    secondaryBannerIds,
    secondaryOpsBannerIds,
    secondaryTipBannerIds,
  };
}
